"""
SPRINT BACKLOG P2 — AUDIT FORENSIQUE READ-ONLY
Membres `billing_enabled=true` SANS `payment_schedules` auto-généré.

Contexte : bug PaymentSchedule import cassé fixé Sprint Hardening 2026-05-12.
Tous les membres créés AVANT cette date via /confirm-sale avec billing_enabled=true
sont suspects par construction.

Classification en 4 buckets :
  - RED    : revenu manqué probable (jamais payé, abonnement actif)
  - ORANGE : schedule manquant mais paiements manuels existent
  - GREY   : archivé/expiré (bénin)
  - BLUE   : catégorie Coach (pas de revenu attendu, bénin)

Output : console + JSON /app/backend/scripts/output/audit_billing_<YYYYMMDD>.json

USAGE:
    PYTHONPATH=/app/backend python3 -m scripts.audit_billing_without_schedules
    PYTHONPATH=/app/backend python3 -m scripts.audit_billing_without_schedules --confirm
"""
import argparse
import asyncio
import json
import os
from collections import Counter, defaultdict
from datetime import datetime, date, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from core.config import MONGO_URL, DB_NAME
from core.member_categorization import get_member_category


VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
FIX_DATE = "2026-05-12"  # Sprint Hardening fix PaymentSchedule import
OUTPUT_DIR = "/app/backend/scripts/output"


def _banner():
    print()
    print("=" * 90)
    print("⚠️   AUDIT BILLING WITHOUT SCHEDULES  ⚠️")
    print("=" * 90)
    print(f"  TARGET HOST : transform.iocnr7b.mongodb.net")
    print(f"  TARGET DB   : {DB_NAME}")
    print(f"  TARGET CLUB : Versoix ({VERSOIX_CLUB_ID})")
    print(f"  MODE        : 🟢 READ-ONLY (aucune mutation, aucun INSERT/UPDATE/DELETE)")
    print(f"  FIX DATE    : {FIX_DATE} (Sprint Hardening PaymentSchedule import)")
    print(f"  DATE AUDIT  : {datetime.now(timezone.utc).isoformat()}")
    print("=" * 90)
    print()


def _months_between(start_iso: str, end_iso: str) -> int:
    """Approximate months elapsed between two ISO dates. Used for lost_revenue estimation."""
    try:
        s = date.fromisoformat(start_iso[:10])
        e = date.fromisoformat(end_iso[:10])
        if e < s:
            return 0
        return max(0, (e.year - s.year) * 12 + (e.month - s.month))
    except Exception:
        return 0


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args()

    _banner()
    if not args.confirm:
        ans = input("Lancer l'audit read-only ? Saisir 'yes' pour continuer : ").strip().lower()
        if ans != "yes":
            print("❌ Annulé.")
            return

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    today_iso = date.today().isoformat()

    # === Préload des membership_types pour catégorisation Sprint C ===
    mtypes = await db.membership_types.find({}, {"_id": 0}).to_list(length=500)
    mtypes_by_name = {m["name"]: m for m in mtypes if m.get("name")}

    # === Charger tous les membres billing_enabled=true sur Versoix ===
    members = await db.customer_members.find(
        {"club_id": VERSOIX_CLUB_ID, "billing_enabled": True},
        {"_id": 0},
    ).to_list(length=5000)
    print(f"[1] Total membres billing_enabled=true sur Versoix : {len(members)}\n")

    # === Pré-agrégation : payment_schedules par member_id ===
    ps_by_member = defaultdict(list)
    async for ps in db.payment_schedules.find(
        {"club_id": VERSOIX_CLUB_ID}, {"_id": 0, "member_id": 1, "is_active": 1, "amount": 1}
    ):
        if ps.get("member_id"):
            ps_by_member[ps["member_id"]].append(ps)

    # === Pré-agrégation : payments par member_id ===
    pay_by_member = defaultdict(list)
    async for p in db.payments.find(
        {"club_id": VERSOIX_CLUB_ID},
        {"_id": 0, "member_id": 1, "amount": 1, "status": 1, "due_date": 1, "paid_date": 1}
    ):
        if p.get("member_id"):
            pay_by_member[p["member_id"]].append(p)

    # === Classification 4 buckets ===
    buckets = {"RED": [], "ORANGE": [], "GREY": [], "BLUE": []}
    for m in members:
        mid = m.get("id")
        category = get_member_category(m, mtypes_by_name)
        schedules = ps_by_member.get(mid, [])
        payments = pay_by_member.get(mid, [])
        is_archived = bool(m.get("archived_at"))
        end = m.get("subscription_end_date")
        is_expired = bool(end and end < today_iso)
        has_active_schedule = any(ps.get("is_active") is not False for ps in schedules)

        # Enrichir contexte
        mt = mtypes_by_name.get(m.get("membership") or "")
        monthly_price = (mt or {}).get("monthly_price") or (mt or {}).get("price") or None
        sub_start = m.get("subscription_start_date") or m.get("created_at", "")[:10]
        months_active = _months_between(sub_start, today_iso) if sub_start else 0
        estimated_lost = (monthly_price * months_active) if (monthly_price and not has_active_schedule) else "UNKNOWN"

        row = {
            "member_id": mid,
            "name": m.get("name"),
            "email": m.get("email"),
            "membership": m.get("membership"),
            "monthly_price": monthly_price,
            "subscription_start_date": sub_start,
            "subscription_end_date": end,
            "created_at": m.get("created_at"),
            "archived_at": m.get("archived_at"),
            "category": category,
            "n_schedules_total": len(schedules),
            "n_schedules_active": sum(1 for ps in schedules if ps.get("is_active") is not False),
            "n_payments": len(payments),
            "sum_payments_amount": round(sum(p.get("amount") or 0 for p in payments), 2),
            "months_active": months_active,
            "estimated_lost_revenue": estimated_lost,
            "created_before_fix": (m.get("created_at") or "")[:10] < FIX_DATE,
        }

        # Classification cascade
        if category == "Coach":
            buckets["BLUE"].append(row)
        elif is_archived or is_expired:
            buckets["GREY"].append(row)
        elif len(schedules) == 0 and len(payments) == 0:
            buckets["RED"].append(row)
        elif len(schedules) == 0 and len(payments) >= 1:
            buckets["ORANGE"].append(row)
        else:
            # Schedules existent → pas un cas à reporter (sain) — on note quand même
            row["_note"] = "has_schedule (not in scope)"
            # Ne pas l'ajouter aux buckets de sortie

    # === Console output ===
    print("[2] CLASSIFICATION PAR BUCKET")
    print("-" * 90)
    print(f"  🔴 RED    (revenu manqué probable)         : {len(buckets['RED']):>4}")
    print(f"  🟠 ORANGE (schedule KO mais paiements ✓)   : {len(buckets['ORANGE']):>4}")
    print(f"  ⚪ GREY   (archivé/expiré, bénin)          : {len(buckets['GREY']):>4}")
    print(f"  🔵 BLUE   (Coach pass, bénin)              : {len(buckets['BLUE']):>4}")
    actionable_total = len(buckets['RED']) + len(buckets['ORANGE']) + len(buckets['GREY']) + len(buckets['BLUE'])
    out_of_scope = len(members) - actionable_total
    print(f"  ⚫ OUT_OF_SCOPE (has active schedule)      : {out_of_scope:>4}")
    print(f"  {'TOTAL':<43}: {len(members):>4}")
    assert actionable_total + out_of_scope == len(members), "Bucket math invariant broken!"

    # === Détails RED (top 10 par lost_revenue) ===
    def _sort_key(r):
        v = r.get("estimated_lost_revenue")
        return v if isinstance(v, (int, float)) else -1
    print("\n[3] TOP 10 RED par estimated_lost_revenue (CHF approximatif)")
    print("-" * 90)
    red_sorted = sorted(buckets["RED"], key=_sort_key, reverse=True)
    if red_sorted:
        print(f"{'Name':<28}{'Membership':<30}{'Months':>8}{'Monthly':>10}{'Lost':>12}  Before fix?")
        for r in red_sorted[:10]:
            lost = r['estimated_lost_revenue']
            lost_str = f"{lost:.0f} CHF" if isinstance(lost, (int, float)) else str(lost)
            mp = r['monthly_price']
            mp_str = f"{mp:.0f}" if isinstance(mp, (int, float)) else "—"
            print(f"{(r['name'] or '—')[:27]:<28}{(r['membership'] or '—')[:29]:<30}{r['months_active']:>8}{mp_str:>10}{lost_str:>12}  {'✓' if r['created_before_fix'] else '✗'}")
    else:
        print("  (aucun)")

    # === Détails ORANGE ===
    print("\n[4] ORANGE — Schedule manquant MAIS paiements manuels existants")
    print("-" * 90)
    if buckets["ORANGE"]:
        print(f"{'Name':<28}{'Membership':<30}{'#Pay':>6}{'Sum':>10}  Before fix?")
        for r in buckets["ORANGE"][:20]:
            print(f"{(r['name'] or '—')[:27]:<28}{(r['membership'] or '—')[:29]:<30}{r['n_payments']:>6}{r['sum_payments_amount']:>10.0f}  {'✓' if r['created_before_fix'] else '✗'}")
        if len(buckets["ORANGE"]) > 20:
            print(f"  ... +{len(buckets['ORANGE'])-20} autres")
    else:
        print("  (aucun)")

    # === Stats globales ===
    print("\n[5] STATS GLOBALES")
    print("-" * 90)
    red_known = [r for r in buckets["RED"] if isinstance(r["estimated_lost_revenue"], (int, float))]
    red_unknown = len(buckets["RED"]) - len(red_known)
    red_lost_sum = sum(r["estimated_lost_revenue"] for r in red_known)
    orange_paid_sum = sum(r["sum_payments_amount"] for r in buckets["ORANGE"])
    print(f"  RED — Revenu manqué estimé           : {red_lost_sum:.0f} CHF (sur {len(red_known)} membres)")
    print(f"  RED — Sans monthly_price (UNKNOWN)    : {red_unknown}")
    print(f"  ORANGE — Paiements manuels encaissés  : {orange_paid_sum:.0f} CHF (sur {len(buckets['ORANGE'])} membres)")
    print(f"  Membres créés AVANT fix (suspects)    : {sum(1 for b in ['RED','ORANGE'] for r in buckets[b] if r['created_before_fix'])}")
    print(f"  Membres créés APRÈS fix               : {sum(1 for b in ['RED','ORANGE'] for r in buckets[b] if not r['created_before_fix'])}")

    # === Output JSON ===
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f"audit_billing_{date.today().strftime('%Y%m%d')}.json")
    payload = {
        "metadata": {
            "audit_date": today_iso,
            "target_db": DB_NAME,
            "target_club_id": VERSOIX_CLUB_ID,
            "fix_date": FIX_DATE,
            "total_members_billing_on": len(members),
        },
        "buckets_count": {
            "RED": len(buckets["RED"]),
            "ORANGE": len(buckets["ORANGE"]),
            "GREY": len(buckets["GREY"]),
            "BLUE": len(buckets["BLUE"]),
            "OUT_OF_SCOPE_has_schedule": out_of_scope,
        },
        "stats": {
            "red_estimated_lost_revenue_chf": round(red_lost_sum, 2),
            "red_unknown_monthly_price": red_unknown,
            "orange_paid_sum_chf": round(orange_paid_sum, 2),
            "created_before_fix_suspects": sum(1 for b in ["RED", "ORANGE"] for r in buckets[b] if r["created_before_fix"]),
            "created_after_fix": sum(1 for b in ["RED", "ORANGE"] for r in buckets[b] if not r["created_before_fix"]),
        },
        "RED": red_sorted,
        "ORANGE": buckets["ORANGE"],
        "GREY": buckets["GREY"],
        "BLUE": buckets["BLUE"],
    }
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2, default=str)
    print(f"\n[6] Output JSON : {out_path}  ({os.path.getsize(out_path)} bytes)\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
