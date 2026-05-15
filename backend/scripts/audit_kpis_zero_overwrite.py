"""
SPRINT BACKLOG P2 — AUDIT FORENSIQUE READ-ONLY
Détection des écrasements zéro silencieux historiques sur `monthly_kpis`.

Contexte : Avant le fix Sprint Hardening 2026-05-12 (garde-fou zero-overwrite
sur `/api/ghl/sync`), un appel GHL retournant 0 opportunités pouvait écraser
des KPIs réels à 0. Cet audit détecte les mois où :
  monthly_kpis.cash_collected=0 + leads=0 + close=0
  MAIS accounting_transactions du même mois ont sum(revenue) > 0.

Sortie : rapport décisionnel pour restauration manuelle (le backup
`/app/backup_production_db.json` du 30/03 fournit la baseline si présent).
READ-ONLY — aucune mutation déclenchée.

Usage:
    PYTHONPATH=/app/backend python3 -m scripts.audit_kpis_zero_overwrite --confirm
"""
import argparse
import asyncio
import json
import os
from collections import defaultdict
from datetime import datetime, date, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from core.config import MONGO_URL, DB_NAME


VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
FIX_DATE = "2026-05-12"
PERIOD_START = "2024-01"
PERIOD_END = "2026-04"  # Inclus
ALREADY_RESTORED_MONTHS = {"2026-01"}  # Restauration ad-hoc du 12/05
OUTPUT_DIR = "/app/backend/scripts/output"
BACKUP_PATH = "/app/backup_production_db.json"


def _banner():
    print()
    print("=" * 90)
    print("⚠️   AUDIT KPIS ZERO-OVERWRITE  ⚠️")
    print("=" * 90)
    print("  TARGET HOST : transform.iocnr7b.mongodb.net")
    print(f"  TARGET DB   : {DB_NAME}")
    print(f"  TARGET CLUB : Versoix ({VERSOIX_CLUB_ID})")
    print("  MODE        : 🟢 READ-ONLY (aucune mutation)")
    print(f"  PÉRIODE     : {PERIOD_START} → {PERIOD_END} (28 mois théoriques)")
    print(f"  FIX DATE    : {FIX_DATE} (garde-fou zero-overwrite GHL /sync)")
    print(f"  DATE AUDIT  : {datetime.now(timezone.utc).isoformat()}")
    print("=" * 90)
    print()


def _iter_months(start_ym: str, end_ym: str):
    y, m = int(start_ym[:4]), int(start_ym[5:7])
    end_y, end_m = int(end_ym[:4]), int(end_ym[5:7])
    while (y, m) <= (end_y, end_m):
        yield f"{y:04d}-{m:02d}"
        m += 1
        if m > 12:
            m = 1
            y += 1


def _load_backup_kpis() -> dict:
    """Try to load `monthly_kpis` snapshot from backup for diff. Tolerant si absent."""
    if not os.path.exists(BACKUP_PATH):
        return {}
    try:
        with open(BACKUP_PATH) as f:
            data = json.load(f)
        # Tolère structures différentes
        candidates = data.get("monthly_kpis") or data.get("collections", {}).get("monthly_kpis") or []
        out = {}
        for doc in candidates:
            if doc.get("club_id") == VERSOIX_CLUB_ID:
                out[doc.get("month")] = {
                    "leads": doc.get("leads"),
                    "cash_collected": doc.get("cash_collected"),
                    "close": doc.get("close"),
                    "scheduled": doc.get("scheduled"),
                    "show": doc.get("show"),
                    "recurring_revenue": doc.get("recurring_revenue"),
                    "funnel_cash": doc.get("funnel_cash"),
                }
        return out
    except Exception as e:
        print(f"  ⚠️  Backup parse error: {e} — continuing sans baseline")
        return {}


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    _banner()
    if not args.confirm:
        ans = input("Lancer l'audit read-only ? Saisir 'yes' pour continuer : ").strip().lower()
        if ans != "yes":
            print("❌ Annulé.")
            return

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # === 1) Charger tous les monthly_kpis Versoix ===
    months_target = list(_iter_months(PERIOD_START, PERIOD_END))
    kpis_by_month = {}
    async for k in db.monthly_kpis.find(
        {"club_id": VERSOIX_CLUB_ID, "month": {"$in": months_target}},
        {"_id": 0},
    ):
        kpis_by_month[k.get("month")] = k

    # === 2) Aggréger accounting_transactions par mois (type=revenue) ===
    # Format date = "YYYY-MM-DD" string
    pipeline = [
        {"$match": {
            "club_id": VERSOIX_CLUB_ID,
            "type": "revenue",
            "date": {"$gte": f"{PERIOD_START}-01", "$lte": f"{PERIOD_END}-31"},
        }},
        {"$project": {"ym": {"$substr": ["$date", 0, 7]}, "amount": 1}},
        {"$group": {"_id": "$ym", "count": {"$sum": 1}, "sum_revenue": {"$sum": "$amount"}}},
    ]
    at_revenue_by_month = {}
    async for r in db.accounting_transactions.aggregate(pipeline):
        at_revenue_by_month[r["_id"]] = {"count": r["count"], "sum_revenue": round(r["sum_revenue"], 2)}

    # === 3) Baseline backup si dispo ===
    backup_kpis = _load_backup_kpis()
    print(f"  Backup KPIs chargés ({len(backup_kpis)} mois Versoix présents dans le snapshot 30/03)\n")

    # === 4) Classification ===
    buckets = defaultdict(list)
    for ym in months_target:
        k = kpis_by_month.get(ym)
        at = at_revenue_by_month.get(ym, {"count": 0, "sum_revenue": 0.0})

        if not k:
            # Mois sans KPI doc — pas considéré comme overwrite (le doc n'existe juste pas)
            buckets["MISSING_KPI_DOC"].append({"month": ym, "at": at})
            continue

        leads = k.get("leads") or 0
        cash = k.get("cash_collected") or 0
        close = k.get("close") or 0
        scheduled = k.get("scheduled") or 0
        show = k.get("show") or 0
        all_zero_major = (leads == 0 and cash == 0 and close == 0)
        partial_zero = (
            not all_zero_major
            and ((leads == 0) + (cash == 0) + (close == 0) + (scheduled == 0) + (show == 0)) >= 3
            and (leads > 0 or cash > 0 or close > 0 or scheduled > 0 or show > 0)
        )

        # Indicateur "real cash" supposé = sum revenue accounting
        est_real_cash = at["sum_revenue"]
        bk = backup_kpis.get(ym)
        bk_cash = (bk or {}).get("cash_collected")
        bk_leads = (bk or {}).get("leads")

        row = {
            "month": ym,
            "kpis": {
                "leads": leads, "cash_collected": cash, "close": close,
                "scheduled": scheduled, "show": show,
                "active_members": k.get("active_members"),
                "recurring_revenue": k.get("recurring_revenue"),
                "funnel_cash": k.get("funnel_cash"),
            },
            "accounting": at,
            "estimated_real_cash_chf": est_real_cash,
            "backup_snapshot": bk,
            "already_restored": ym in ALREADY_RESTORED_MONTHS,
        }

        if all_zero_major and at["count"] > 0 and at["sum_revenue"] > 0:
            # Contradiction → écrasement probable
            buckets["SUSPECT_OVERWRITE"].append(row)
        elif all_zero_major and (at["count"] == 0 or at["sum_revenue"] == 0):
            buckets["LEGIT_ZERO"].append(row)
        elif partial_zero:
            buckets["PARTIAL_ZERO"].append(row)
        else:
            # Note : possible cas où cash_collected > 0 mais accounting sum=0
            # → cash collecté manuellement sans transaction enregistrée (informatif)
            buckets["HEALTHY"].append(row)

    # === 5) Tri des SUSPECT par estimated_real_cash décroissant ===
    buckets["SUSPECT_OVERWRITE"].sort(key=lambda r: r["estimated_real_cash_chf"], reverse=True)

    # === Math invariant ===
    total_classified = sum(len(buckets[k]) for k in ("SUSPECT_OVERWRITE", "LEGIT_ZERO", "PARTIAL_ZERO", "HEALTHY", "MISSING_KPI_DOC"))
    assert total_classified == len(months_target), f"Math invariant broken: {total_classified} vs {len(months_target)}"

    # === Console output ===
    print("[1] CLASSIFICATION PAR BUCKET")
    print("-" * 90)
    print(f"  🔴 SUSPECT_OVERWRITE (KPI=0 mais accounting>0) : {len(buckets['SUSPECT_OVERWRITE']):>3}")
    print(f"  ⚪ LEGIT_ZERO        (vraiment vide)            : {len(buckets['LEGIT_ZERO']):>3}")
    print(f"  🟠 PARTIAL_ZERO      (3+ champs à 0 sur 5)      : {len(buckets['PARTIAL_ZERO']):>3}")
    print(f"  ✅ HEALTHY           (au moins 2 champs majeurs) : {len(buckets['HEALTHY']):>3}")
    print(f"  ❔ MISSING_KPI_DOC   (pas de doc KPI ce mois)    : {len(buckets['MISSING_KPI_DOC']):>3}")
    print(f"  {'TOTAL':<46} : {len(months_target):>3}")

    # === Détail SUSPECT (le plus ancien d'abord pour reconstituer chrono) ===
    if buckets["SUSPECT_OVERWRITE"]:
        print("\n[2] SUSPECT_OVERWRITE — Détail trié par estimated_real_cash décroissant")
        print("-" * 90)
        print(f"{'Month':<10}{'KPI cash':>12}{'AT count':>10}{'AT sum_rev':>14}  {'Backup cash':>14}  Status")
        for r in buckets["SUSPECT_OVERWRITE"]:
            bk_cash = (r["backup_snapshot"] or {}).get("cash_collected")
            bk_str = f"{bk_cash:.0f} CHF" if isinstance(bk_cash, (int, float)) else "—"
            status = "ALREADY_RESTORED" if r["already_restored"] else "TO_REVIEW"
            print(f"{r['month']:<10}{r['kpis']['cash_collected']:>12}{r['accounting']['count']:>10}{r['accounting']['sum_revenue']:>14.0f}  {bk_str:>14}  {status}")
    else:
        print("\n[2] ✅ Aucun SUSPECT_OVERWRITE détecté")

    # === PARTIAL ===
    if buckets["PARTIAL_ZERO"]:
        print("\n[3] PARTIAL_ZERO — Informatif (à investiguer manuellement)")
        print("-" * 90)
        # Tri chrono
        partial_sorted = sorted(buckets["PARTIAL_ZERO"], key=lambda r: r["month"])
        for r in partial_sorted[:15]:
            k = r["kpis"]
            print(f"  {r['month']}: leads={k['leads']} cash={k['cash_collected']} close={k['close']} sched={k['scheduled']} show={k['show']} | AT sum={r['accounting']['sum_revenue']}")
        if len(partial_sorted) > 15:
            print(f"  ... +{len(partial_sorted) - 15} autres")

    # === Stats ===
    suspect_total_lost = sum(r["estimated_real_cash_chf"] for r in buckets["SUSPECT_OVERWRITE"])
    suspect_to_review = sum(r["estimated_real_cash_chf"] for r in buckets["SUSPECT_OVERWRITE"] if not r["already_restored"])
    print("\n[4] STATS GLOBALES")
    print("-" * 90)
    print(f"  Mois scannés                            : {len(months_target)}")
    print(f"  SUSPECT — estimated_real_cash total     : {suspect_total_lost:.0f} CHF")
    print(f"  SUSPECT — TO_REVIEW (hors déjà restauré): {suspect_to_review:.0f} CHF")
    print(f"  Backup baseline disponible              : {'oui' if backup_kpis else 'non'}")

    # === JSON output ===
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f"audit_kpis_zero_{date.today().strftime('%Y%m%d')}.json")
    payload = {
        "metadata": {
            "audit_date": date.today().isoformat(),
            "target_db": DB_NAME,
            "target_club_id": VERSOIX_CLUB_ID,
            "period": f"{PERIOD_START} → {PERIOD_END}",
            "fix_date": FIX_DATE,
            "already_restored_months": sorted(ALREADY_RESTORED_MONTHS),
            "backup_available": bool(backup_kpis),
            "months_scanned": len(months_target),
        },
        "buckets_count": {k: len(v) for k, v in buckets.items()},
        "stats": {
            "suspect_total_lost_chf": round(suspect_total_lost, 2),
            "suspect_to_review_chf": round(suspect_to_review, 2),
        },
        "SUSPECT_OVERWRITE": buckets["SUSPECT_OVERWRITE"],
        "PARTIAL_ZERO": sorted(buckets["PARTIAL_ZERO"], key=lambda r: r["month"]),
        "LEGIT_ZERO_months": [r["month"] for r in buckets["LEGIT_ZERO"]],
        "HEALTHY_months": [r["month"] for r in buckets["HEALTHY"]],
        "MISSING_KPI_DOC_months": [r["month"] for r in buckets["MISSING_KPI_DOC"]],
    }
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2, default=str)
    print(f"\n  Output JSON : {out_path}  ({os.path.getsize(out_path)} bytes)\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
