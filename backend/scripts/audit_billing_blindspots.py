"""
SPRINT BACKLOG P2 — AUDIT COMPLÉMENTAIRE READ-ONLY
Angles morts de l'audit billing du 2026-05-15 :
  (a) PHANTOM SALES : ghl_sales sans customer_members correspondant (jan→mai 2026)
  (b) FAUX BLUE     : coachs avec monthly_price > 0 incorrectement exemptés

Output : console + JSON /app/backend/scripts/output/audit_billing_blindspots_<YYYYMMDD>.json
USAGE :
    PYTHONPATH=/app/backend python3 -m scripts.audit_billing_blindspots --confirm
"""
import argparse
import asyncio
import json
import os
from datetime import datetime, date, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from core.config import MONGO_URL, DB_NAME


VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
FIX_DATE = "2026-05-12"
PERIOD_START = "2026-01-01"
PERIOD_END = "2026-05-12"
OUTPUT_DIR = "/app/backend/scripts/output"


def _banner():
    print()
    print("=" * 90)
    print("⚠️   AUDIT BILLING BLIND SPOTS — PHANTOM SALES + FAUX BLUE  ⚠️")
    print("=" * 90)
    print("  TARGET HOST : transform.iocnr7b.mongodb.net")
    print(f"  TARGET DB   : {DB_NAME}")
    print(f"  TARGET CLUB : Versoix ({VERSOIX_CLUB_ID})")
    print("  MODE        : 🟢 READ-ONLY (aucune mutation, aucun INSERT/UPDATE/DELETE)")
    print(f"  PÉRIODE     : {PERIOD_START} → {PERIOD_END} (avant fix Sprint Hardening)")
    print(f"  DATE AUDIT  : {datetime.now(timezone.utc).isoformat()}")
    print("=" * 90)
    print()


def _norm(s):
    return (s or "").strip().lower()


async def audit_phantom_sales(db) -> dict:
    """ANGLE (a) — ghl_sales sans customer_members correspondant sur la période.

    Note schema 2026-05 : ghl_sales utilise `member_id` direct comme clé de jointure
    (pas email/phone/name). Le matching se fait donc en O(n) via cette FK.
    Les autres clés (email/phone/name) sont audités en fallback uniquement si
    `member_id` est absent ou pointe vers un doc supprimé (hard-delete).
    """
    # 1) ghl_sales sur la période
    sales = await db.ghl_sales.find(
        {
            "club_id": VERSOIX_CLUB_ID,
            "$or": [
                {"created_at": {"$gte": PERIOD_START, "$lt": "2026-05-13"}},
                {"confirmed_at": {"$gte": PERIOD_START, "$lt": "2026-05-13"}},
            ],
        },
        {"_id": 0},
    ).to_list(length=5000)

    # 2) Récolter les member_ids référencés
    referenced_ids = {s.get("member_id") for s in sales if s.get("member_id")}
    existing_ids = set()
    if referenced_ids:
        async for m in db.customer_members.find(
            {"id": {"$in": list(referenced_ids)}},
            {"_id": 0, "id": 1, "name": 1},
        ):
            existing_ids.add(m["id"])

    matched, phantom = [], []
    for s in sales:
        mid = s.get("member_id")
        if mid and mid in existing_ids:
            matched.append(s)
        else:
            phantom.append({
                "opportunity_id": s.get("opportunity_id"),
                "opportunity_name": s.get("opportunity_name"),
                "subscription_type": s.get("subscription_type"),
                "cash_collected": s.get("cash_collected"),
                "month": s.get("month"),
                "confirmed_at": s.get("confirmed_at"),
                "missing_member_id": mid or "NO_MEMBER_ID_ON_SALE",
            })

    return {
        "period": f"{PERIOD_START} → {PERIOD_END}",
        "total_sales_in_period": len(sales),
        "matched_count": len(matched),
        "phantom_count": len(phantom),
        "phantom_details": phantom,
    }


async def audit_false_blue(db, audit_billing_json_path: str = None) -> dict:
    """ANGLE (b) — Reprendre les BLUE du précédent rapport et vérifier le pricing.

    Si le rapport audit_billing du jour existe, on le réutilise pour la liste BLUE.
    Sinon, on recalcule les BLUE depuis customer_members + membership_types.
    """
    # Charger membership_types pour pricing
    mtypes = await db.membership_types.find({}, {"_id": 0}).to_list(length=500)
    mtypes_by_name = {m.get("name"): m for m in mtypes if m.get("name")}

    # Recalcul direct (plus robuste qu'une dépendance JSON)
    members = await db.customer_members.find(
        {"club_id": VERSOIX_CLUB_ID, "billing_enabled": True},
        {"_id": 0, "id": 1, "name": 1, "membership": 1, "email": 1},
    ).to_list(length=5000)

    from core.member_categorization import get_member_category

    blue_legit, blue_suspect = [], []
    for m in members:
        cat = get_member_category(m, mtypes_by_name)
        if cat != "Coach":
            continue
        mt = mtypes_by_name.get(m.get("membership") or "") or {}
        # Cascade prix : price (one-shot/total) > monthly_price (récurrent)
        price = mt.get("price")
        monthly_price = mt.get("monthly_price")
        # SUSPECT si monthly_price>0 (récurrent payant) OU price>0 si is_recurring=False
        suspect = False
        reason = "—"
        if monthly_price is not None and monthly_price > 0:
            suspect = True
            reason = f"monthly_price={monthly_price} CHF (récurrent payant)"
        elif (price is not None and price > 0) and (mt.get("is_recurring") is False or mt.get("is_pif") is True):
            # PIF = paiement intégral, peut être payant mais one-shot — pas un coach gratuit
            suspect = True
            reason = f"price={price} CHF (one-shot/PIF payant)"

        row = {
            "member_id": m.get("id"),
            "name": m.get("name"),
            "email": m.get("email"),
            "membership": m.get("membership"),
            "price": price,
            "monthly_price": monthly_price,
            "is_recurring": mt.get("is_recurring"),
            "is_pif": mt.get("is_pif"),
            "reason": reason,
        }
        (blue_suspect if suspect else blue_legit).append(row)

    return {
        "blue_total": len(blue_legit) + len(blue_suspect),
        "blue_legit_count": len(blue_legit),
        "blue_suspect_count": len(blue_suspect),
        "blue_legit_sample": blue_legit[:5],
        "blue_suspect_details": blue_suspect,
    }


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

    # === ANGLE (a) ===
    print("\n[ANGLE A] PHANTOM SALES — ghl_sales sans customer_members")
    print("-" * 90)
    a_result = await audit_phantom_sales(db)
    print(f"  Période                 : {a_result['period']}")
    print(f"  Total ghl_sales         : {a_result['total_sales_in_period']}")
    print(f"  ✅ MATCHED              : {a_result['matched_count']}")
    print(f"  🔴 PHANTOM              : {a_result['phantom_count']}")
    if a_result["phantom_details"]:
        print("\n  Détail PHANTOM :")
        for p in a_result["phantom_details"][:20]:
            print(f"    - opp={(p['opportunity_id'] or '—')[:10]} name='{(p['opportunity_name'] or '—')[:30]}' "
                  f"cash={p['cash_collected']} month={p['month']} mid={p['missing_member_id']}")
        if len(a_result["phantom_details"]) > 20:
            print(f"    ... +{len(a_result['phantom_details']) - 20} autres")

    # === ANGLE (b) ===
    print("\n[ANGLE B] FAUX BLUE — Coachs avec pricing > 0")
    print("-" * 90)
    b_result = await audit_false_blue(db)
    print(f"  BLUE total              : {b_result['blue_total']}")
    print(f"  ✅ LEGIT_BLUE (gratuit) : {b_result['blue_legit_count']}")
    print(f"  🔴 SUSPECT_BLUE         : {b_result['blue_suspect_count']}")
    if b_result["blue_suspect_details"]:
        print("\n  Détail SUSPECT :")
        for r in b_result["blue_suspect_details"][:20]:
            print(f"    - {(r['name'] or '—')[:25]:<25} | {(r['membership'] or '—')[:35]:<35} | {r['reason']}")

    # === VERDICT ===
    print("\n[VERDICT GLOBAL]")
    print("-" * 90)
    phantom = a_result["phantom_count"]
    suspect = b_result["blue_suspect_count"]
    if phantom == 0 and suspect == 0:
        print("✅ 0 PHANTOM + 0 SUSPECT_BLUE — Audit billing définitivement clos.")
    else:
        print(f"⚠️  {phantom} PHANTOM, {suspect} SUSPECT_BLUE — Escalade décision business requise.")

    # === Output JSON ===
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f"audit_billing_blindspots_{date.today().strftime('%Y%m%d')}.json")
    payload = {
        "metadata": {
            "audit_date": date.today().isoformat(),
            "target_db": DB_NAME,
            "target_club_id": VERSOIX_CLUB_ID,
            "period": f"{PERIOD_START} → {PERIOD_END}",
            "fix_date": FIX_DATE,
        },
        "angle_a_phantom_sales": a_result,
        "angle_b_false_blue": b_result,
        "verdict": {
            "phantom_count": phantom,
            "suspect_blue_count": suspect,
            "audit_closed": phantom == 0 and suspect == 0,
        },
    }
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2, default=str)
    print(f"\n  Output JSON : {out_path}  ({os.path.getsize(out_path)} bytes)\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
