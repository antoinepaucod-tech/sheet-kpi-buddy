"""
SPRINT HARDENING — F.2 / F.3 Migration des orphelins club_id vers Versoix
Modèle calqué sur migrate_sprint_b.py.

Usage :
  python migrate_orphan_club_id.py              # --dry-run par défaut (REQUIRED)
  python migrate_orphan_club_id.py --apply      # Demande confirmation interactive

Garde-fous :
  - Cible DB affichée en gros au démarrage
  - Mode dry-run par défaut, aucune écriture
  - --apply requiert saisir 'yes' explicitement
  - update_many avec filtre {"club_id": None|absent} uniquement
  - Champ d'audit club_id_migrated_at ajouté pour traçabilité
"""
import argparse
import asyncio
import sys
from datetime import datetime, timezone
from collections import Counter
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME


COLLECTIONS_TO_MIGRATE = ["activity_logs", "member_renewals", "annual_reviews"]
DEFAULT_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"  # Versoix
DEFAULT_CLUB_NAME = "Transform Versoix"

ORPHAN_FILTER = {"$or": [{"club_id": None}, {"club_id": {"$exists": False}}]}


def _banner(dry_run: bool):
    print("=" * 90)
    print("SPRINT HARDENING — F.2/F.3  Migration orphelins club_id")
    print("=" * 90)
    print(f"Cible DB     : {DB_NAME}")
    print(f"Cible URL    : {MONGO_URL[:60]}...")
    print(f"Cible club   : {DEFAULT_CLUB_NAME} ({DEFAULT_CLUB_ID})")
    print(f"Mode         : {'🟢 DRY-RUN (lecture seule)' if dry_run else '🔴 APPLY (écriture)'}")
    print(f"Date         : {datetime.now(timezone.utc).isoformat()}")
    print("=" * 90)
    print()


async def _lookup_member_context(db, member_id):
    if not member_id:
        return ("NO_MEMBER_ID", None)
    m = await db.customer_members.find_one(
        {"id": member_id},
        {"_id": 0, "id": 1, "name": 1, "club_id": 1, "archived_at": 1}
    )
    if not m:
        return ("MEMBER_NOT_FOUND", None)
    return (m.get("club_id") or "MEMBER_HAS_NO_CLUB"), m


async def _analyze_collection(db, collection):
    coll = db[collection]
    orphans = await coll.find(ORPHAN_FILTER, {"_id": 0}).to_list(length=None)
    rows = []
    verdict_counter = Counter()
    for doc in orphans:
        member_club, member = await _lookup_member_context(db, doc.get("member_id"))
        if member_club == DEFAULT_CLUB_ID:
            verdict = "OK_VERSOIX"
        elif member_club in ("MEMBER_NOT_FOUND", "NO_MEMBER_ID", "MEMBER_HAS_NO_CLUB"):
            verdict = f"⚠️ {member_club}"
        else:
            verdict = f"⚠️ CROSS_CLUB({member_club[:8]}...)"
        verdict_counter[verdict] += 1
        rows.append({
            "doc_id": doc.get("id"),
            "member_id": doc.get("member_id"),
            "member_name": (member or {}).get("name", "—"),
            "action": doc.get("action"),
            "renewal_date": doc.get("renewal_date"),
            "review_date": doc.get("review_date"),
            "status": doc.get("status"),
            "created_at": doc.get("created_at"),
            "member_club": member_club,
            "verdict": verdict,
        })
    return rows, verdict_counter


async def _dry_run(db):
    grand_total = 0
    grand_ok = 0
    grand_anomalies = 0

    for collection in COLLECTIONS_TO_MIGRATE:
        print(f"\n=== {collection} ===")
        rows, vcount = await _analyze_collection(db, collection)
        if not rows:
            print("  (aucun orphelin)")
            continue
        for r in rows:
            # Affichage contextuel sélectif
            label_parts = []
            if r["action"]:
                label_parts.append(f"action={r['action']}")
            if r["renewal_date"]:
                label_parts.append(f"renewal_date={r['renewal_date']}")
            if r["review_date"]:
                label_parts.append(f"review_date={r['review_date']}")
            if r["status"]:
                label_parts.append(f"status={r['status']}")
            label = " | ".join(label_parts) or "—"
            print(f"  - member='{r['member_name']}' ({(r['member_id'] or '—')[:8]}) | {label} | created={(r['created_at'] or '—')[:19]} | {r['verdict']}")

        print(f"  Sous-total {collection}: {len(rows)} orphelins | breakdown verdicts: {dict(vcount)}")
        grand_total += len(rows)
        grand_ok += vcount.get("OK_VERSOIX", 0)
        grand_anomalies += sum(v for k, v in vcount.items() if k != "OK_VERSOIX")

    print("\n" + "=" * 90)
    print("RÉSUMÉ DRY-RUN")
    print("=" * 90)
    print(f"Total orphelins analysés     : {grand_total}")
    print(f"  ↳ OK_VERSOIX (à migrer)    : {grand_ok}")
    print(f"  ↳ Anomalies (à examiner)   : {grand_anomalies}")
    if grand_anomalies == 0:
        print("\n✅ Tous les orphelins pointent vers un membre Versoix. Migration safe.")
        print(f"   → Lancer  python {sys.argv[0].split('/')[-1]} --apply  pour migrer.")
    else:
        print("\n⚠️ Anomalies présentes. Examiner case-par-case AVANT --apply.")
    print("=" * 90)
    return grand_total, grand_ok, grand_anomalies


async def _apply(db):
    # Préparer affichage des chiffres avant confirmation
    print("Analyse pré-apply...")
    totals = {}
    for collection in COLLECTIONS_TO_MIGRATE:
        rows, vcount = await _analyze_collection(db, collection)
        totals[collection] = {
            "count": len(rows),
            "ok": vcount.get("OK_VERSOIX", 0),
            "anomalies": sum(v for k, v in vcount.items() if k != "OK_VERSOIX"),
        }
    grand_count = sum(t["count"] for t in totals.values())
    grand_ok = sum(t["ok"] for t in totals.values())
    grand_anom = sum(t["anomalies"] for t in totals.values())

    print()
    print("=" * 90)
    print(f"🔴 APPLY mode — Cible: {DEFAULT_CLUB_NAME} ({DEFAULT_CLUB_ID})")
    print("=" * 90)
    for c, t in totals.items():
        print(f"  {c:<25} : {t['count']} orphelins à toucher (OK_VERSOIX={t['ok']}, anomalies={t['anomalies']})")
    print(f"  {'TOTAL':<25} : {grand_count} (OK={grand_ok}, anomalies={grand_anom})")
    print("=" * 90)

    if grand_anom > 0:
        print("⚠️ ANOMALIES DÉTECTÉES. Le script ne migre QUE les docs dont le membre lié appartient à Versoix.")

    print("\nConfirmation : saisir exactement 'yes' pour appliquer la migration.")
    print("Tout autre input → annulation propre.")
    answer = input("> ").strip().lower()
    if answer != "yes":
        print(f"❌ Annulé (réponse: '{answer}'). Aucune écriture effectuée.")
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    grand_modified = 0
    print()
    for collection in COLLECTIONS_TO_MIGRATE:
        coll = db[collection]
        rows, _ = await _analyze_collection(db, collection)
        ok_ids = [r["doc_id"] for r in rows if r["verdict"] == "OK_VERSOIX" and r["doc_id"]]
        if not ok_ids:
            print(f"  {collection}: 0 doc à migrer (skip)")
            continue
        # Filtre safe : id IN ok_ids AND club_id orphelin (re-vérification)
        result = await coll.update_many(
            {"id": {"$in": ok_ids}, **ORPHAN_FILTER},
            {"$set": {"club_id": DEFAULT_CLUB_ID, "club_id_migrated_at": now_iso}},
        )
        print(f"  {collection}: matched={result.matched_count}, modified={result.modified_count}")
        grand_modified += result.modified_count

    # Vérification post-apply
    print("\n--- Vérification post-apply (orphelins restants) ---")
    remaining_total = 0
    for collection in COLLECTIONS_TO_MIGRATE:
        coll = db[collection]
        remaining = await coll.count_documents(ORPHAN_FILTER)
        remaining_total += remaining
        status = "✅" if remaining == 0 else "⚠️"
        print(f"  {status} {collection}: {remaining} orphelin(s) restant(s)")
    print(f"\nTotal modifié : {grand_modified}")
    print(f"Total orphelins restants : {remaining_total}")
    if remaining_total == 0:
        print("✅ Migration complète. 0 orphelin sur les 3 collections.")
    else:
        print("⚠️ Des orphelins subsistent (probablement des anomalies cross-club non-migrées). Examiner.")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Effectuer les écritures (défaut: dry-run)")
    args = parser.parse_args()
    dry_run = not args.apply

    _banner(dry_run)

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    if dry_run:
        await _dry_run(db)
    else:
        await _apply(db)

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
