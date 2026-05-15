"""
RESTAURATION CIBLÉE — monthly_kpis 2026-04 Versoix
Suite audit zero-overwrite du 2026-05-15 :
  - `total_revenue` (30081) et `active_members` (94) ont SURVÉCU à l'écrasement
  - SEULS `cash_collected` et `funnel_cash` ont été écrasés à None/0
  - `leads`, `scheduled`, `show`, `close` non-reconstructibles (data funnel GHL perdues)

Stratégie :
  - Recalcul `cash_collected` = sum accounting_transactions revenue avril (=30081 CHF)
  - Recalcul `funnel_cash` idem (alias dans le schéma legacy)
  - Préserver `total_revenue`, `active_members`, `recurring_revenue` (survécu)
  - Laisser `close`/`leads`/`scheduled`/`show` à None/0 (non-reconstructibles)
  - Champ d'audit `kpis_restored_at` + `kpis_restored_from` + `kpis_restored_fields`

Pattern Sprint A :
  - Cible DB affichée en gros
  - --dry-run par défaut
  - --apply nécessite confirmation 'yes' interactive
  - Anti-double-restauration via check `kpis_restored_at`
"""
import argparse
import asyncio
import json
import os
from datetime import datetime, date, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from core.config import MONGO_URL, DB_NAME


VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
TARGET_MONTH = "2026-04"
RESTORE_SOURCE = "audit_zero_overwrite_20260515"
OUTPUT_DIR = "/app/backend/scripts/output"


def _banner(dry_run: bool):
    print()
    print("=" * 90)
    print("🔧  RESTAURATION CIBLÉE — monthly_kpis 2026-04 Versoix")
    print("=" * 90)
    print("  TARGET HOST : transform.iocnr7b.mongodb.net")
    print(f"  TARGET DB   : {DB_NAME}")
    print(f"  TARGET CLUB : Versoix ({VERSOIX_CLUB_ID})")
    print(f"  TARGET MONTH: {TARGET_MONTH}")
    print(f"  MODE        : {'🟢 DRY-RUN (aucune écriture)' if dry_run else '🔴 APPLY (écriture réelle)'}")
    print(f"  DATE        : {datetime.now(timezone.utc).isoformat()}")
    print("=" * 90)
    print()


async def _gather_state(db):
    """Read-only: state actuel + recalcul depuis sources de vérité."""
    # 1) monthly_kpis actuel
    current = await db.monthly_kpis.find_one(
        {"club_id": VERSOIX_CLUB_ID, "month": TARGET_MONTH},
        {"_id": 0},
    )
    if not current:
        return None

    # 2) Recalcul cash_collected = sum AT revenue avril
    pipeline = [
        {"$match": {
            "club_id": VERSOIX_CLUB_ID,
            "type": "revenue",
            "date": {"$gte": f"{TARGET_MONTH}-01", "$lte": f"{TARGET_MONTH}-30"},
        }},
        {"$group": {"_id": None, "count": {"$sum": 1}, "sum_amount": {"$sum": "$amount"}}},
    ]
    at_agg = await db.accounting_transactions.aggregate(pipeline).to_list(length=1)
    at_count = at_agg[0]["count"] if at_agg else 0
    at_sum = round(at_agg[0]["sum_amount"], 2) if at_agg else 0.0

    return {"current": current, "at_count": at_count, "at_sum": at_sum}


def _build_diff(current: dict, at_sum: float) -> dict:
    """Calcule la diff AVANT / APRÈS. Préserve champs survécus."""
    # Champs cibles à restaurer (écrasés)
    cc_before = current.get("cash_collected")
    fc_before = current.get("funnel_cash")
    return {
        "cash_collected": {"before": cc_before, "after": at_sum, "delta": at_sum - (cc_before or 0)},
        "funnel_cash":    {"before": fc_before, "after": at_sum, "delta": at_sum - (fc_before or 0)},
        # Préservés (informationnel)
        "total_revenue":     {"before": current.get("total_revenue"), "after": current.get("total_revenue"), "preserved": True},
        "active_members":    {"before": current.get("active_members"), "after": current.get("active_members"), "preserved": True},
        "recurring_revenue": {"before": current.get("recurring_revenue"), "after": current.get("recurring_revenue"), "preserved": True},
        # Non-reconstructibles
        "leads":     {"before": current.get("leads"), "after": current.get("leads"), "unreconstructible": True},
        "scheduled": {"before": current.get("scheduled"), "after": current.get("scheduled"), "unreconstructible": True},
        "show":      {"before": current.get("show"), "after": current.get("show"), "unreconstructible": True},
        "close":     {"before": current.get("close"), "after": current.get("close"), "unreconstructible": True},
    }


def _print_diff_table(diff: dict):
    print(f"\n{'Champ':<22}{'AVANT':>14}{'APRÈS':>14}{'DELTA':>14}  Note")
    print("-" * 90)
    for field, d in diff.items():
        before = d["before"]
        after = d["after"]
        bs = f"{before:.2f}" if isinstance(before, (int, float)) else str(before)
        af = f"{after:.2f}" if isinstance(after, (int, float)) else str(after)
        if d.get("preserved"):
            note = "✅ préservé"
            delta_str = "—"
        elif d.get("unreconstructible"):
            note = "⚪ non-reconstructible (legacy)"
            delta_str = "—"
        else:
            note = "🔧 RESTAURÉ"
            delta_str = f"+{d['delta']:.2f}"
        print(f"{field:<22}{bs:>14}{af:>14}{delta_str:>14}  {note}")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Effectuer l'écriture (défaut: dry-run)")
    args = parser.parse_args()
    dry_run = not args.apply

    _banner(dry_run)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # === 1) Vérification état actuel ===
    state = await _gather_state(db)
    if not state:
        print(f"❌ ERREUR : monthly_kpis introuvable pour club={VERSOIX_CLUB_ID} month={TARGET_MONTH}")
        client.close()
        return

    current = state["current"]
    if current.get("kpis_restored_at"):
        print(f"⚠️  Document DÉJÀ RESTAURÉ le {current['kpis_restored_at']} (champ kpis_restored_at présent).")
        print(f"   Restored from: {current.get('kpis_restored_from')}")
        print(f"   Restored fields: {current.get('kpis_restored_fields')}")
        print("   STOP — refus de double restauration.")
        client.close()
        return

    # Confirmer pattern zero-overwrite
    is_overwrite = (
        (current.get("cash_collected") in (None, 0))
        and (current.get("close") in (None, 0))
        and (current.get("leads") in (None, 0))
    )
    if not is_overwrite:
        print("⚠️  Le doc actuel ne correspond pas au pattern zero-overwrite attendu (cash=0 + close=0 + leads=0).")
        print(f"   cash_collected={current.get('cash_collected')} close={current.get('close')} leads={current.get('leads')}")
        print("   STOP par prudence (utiliser un script ad-hoc pour ce cas).")
        client.close()
        return

    # === 2) Sources de vérité ===
    print(f"[Source] accounting_transactions revenue avril : count={state['at_count']}, sum={state['at_sum']:.2f} CHF")

    diff = _build_diff(current, state["at_sum"])

    # === 3) Diff AVANT/APRÈS ===
    print("\n[Comparatif état AVANT vs APRÈS restauration]")
    _print_diff_table(diff)

    # === 4) APPLY ===
    if dry_run:
        print("\n🟢 DRY-RUN — aucune écriture effectuée.")
        print(f"   → Lancer avec --apply pour appliquer (confirmation 'yes' requise).")
    else:
        print("\n🔴 MODE APPLY — confirmation requise.")
        print("Saisir 'yes' pour appliquer la restauration :")
        ans = input("> ").strip().lower()
        if ans != "yes":
            print(f"❌ Annulé (réponse: '{ans}'). Aucune écriture effectuée.")
            client.close()
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        update = {
            "$set": {
                "cash_collected": state["at_sum"],
                "funnel_cash": state["at_sum"],
                "kpis_restored_at": now_iso,
                "kpis_restored_from": RESTORE_SOURCE,
                "kpis_restored_fields": ["cash_collected", "funnel_cash"],
                "updated_at": now_iso,
            }
        }
        result = await db.monthly_kpis.update_one(
            {"club_id": VERSOIX_CLUB_ID, "month": TARGET_MONTH, "kpis_restored_at": None},
            update,
        )
        print(f"\n  update_one: matched={result.matched_count}, modified={result.modified_count}")

        # Re-read pour vérif
        after = await db.monthly_kpis.find_one(
            {"club_id": VERSOIX_CLUB_ID, "month": TARGET_MONTH}, {"_id": 0}
        )
        print(f"\n[Vérification post-apply]")
        print(f"  cash_collected   : {after.get('cash_collected')}")
        print(f"  funnel_cash      : {after.get('funnel_cash')}")
        print(f"  total_revenue    : {after.get('total_revenue')}  (préservé)")
        print(f"  active_members   : {after.get('active_members')}  (préservé)")
        print(f"  kpis_restored_at : {after.get('kpis_restored_at')}")
        print(f"  kpis_restored_fields: {after.get('kpis_restored_fields')}")

    # === 5) JSON log ===
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f"restore_kpis_2026_04_{date.today().strftime('%Y%m%d')}.json")
    payload = {
        "metadata": {
            "audit_date": datetime.now(timezone.utc).isoformat(),
            "target_db": DB_NAME,
            "target_club_id": VERSOIX_CLUB_ID,
            "target_month": TARGET_MONTH,
            "mode": "dry_run" if dry_run else "apply",
            "restore_source": RESTORE_SOURCE,
        },
        "sources": {
            "at_revenue_count": state["at_count"],
            "at_revenue_sum_chf": state["at_sum"],
        },
        "diff": diff,
    }
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2, default=str)
    print(f"\n  Output JSON : {out_path}  ({os.path.getsize(out_path)} bytes)\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
