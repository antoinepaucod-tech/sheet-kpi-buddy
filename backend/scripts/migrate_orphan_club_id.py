"""
SPRINT HARDENING — F.2 / F.3 Migration des orphelins club_id vers Versoix
+ PHASE 4 — Extension aux 4 collections détectées 19/05 (post-Phase 3 close).

Modèle calqué sur migrate_sprint_b.py.

Usage :
  python migrate_orphan_club_id.py              # --dry-run F.3 (3 collections)
  python migrate_orphan_club_id.py --apply      # --apply F.3 (3 collections)
  python migrate_orphan_club_id.py --phase4     # --dry-run Phase 4 (4 collections)
  python migrate_orphan_club_id.py --phase4 --apply  # --apply Phase 4

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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME


COLLECTIONS_TO_MIGRATE = ["activity_logs", "member_renewals", "annual_reviews"]

# Phase 4 — 4 collections détectées post-Phase 3 close (2026-05-19)
# (annual_reviews est dans les 2 listes pour qu'un re-run --phase4 couvre tout)
PHASE_4_COLLECTIONS = [
    "payments",                # 2 orphans : Mauricio, Valentina (19/05 09:43)
    "monthly_kpis",            # 1 orphan : month=2026-06 (PAS de member_id)
    "challenge_participants",  # 1 orphan : Julia De Pietro (19/05 07:52)
    "annual_reviews",          # 1 orphan : Christine Wambaa (15/05)
]

# Collections sans member_id → migration directe vers Versoix après vérif unicité
NO_MEMBER_REF_COLLECTIONS = {"monthly_kpis"}

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


async def _forensic_proof_versoix(db, member_id):
    """Cherche un activity_log antérieur ayant un club_id non-null pour ce member_id.
    Retourne le club_id s'il est trouvé, sinon None.
    Permet de migrer un orphelin MEMBER_NOT_FOUND quand son origine est traçable.
    """
    if not member_id:
        return None
    log = await db.activity_logs.find_one(
        {"member_id": member_id, "club_id": {"$ne": None, "$exists": True}},
        {"_id": 0, "club_id": 1, "created_at": 1, "action": 1}
    )
    return (log or {}).get("club_id")


async def _analyze_collection(db, collection):
    coll = db[collection]
    orphans = await coll.find(ORPHAN_FILTER, {"_id": 0}).to_list(length=None)
    rows = []
    verdict_counter = Counter()
    for doc in orphans:
        # Phase 4 — collections sans member_id (ex: monthly_kpis) :
        # migration directe Versoix après vérification d'unicité (month+club_id).
        if collection in NO_MEMBER_REF_COLLECTIONS:
            month = doc.get("month")
            verdict = "OK_VERSOIX_NO_MEMBER_REF"
            if month:
                # Anti-doublon : refuse si un KPI Versoix existe déjà pour ce month
                existing = await db.monthly_kpis.find_one(
                    {"month": month, "club_id": DEFAULT_CLUB_ID},
                    {"_id": 0, "id": 1},
                )
                if existing:
                    verdict = "⚠️ DUPLICATE_KPI_VERSOIX"
            verdict_counter[verdict] += 1
            rows.append({
                "doc_id": doc.get("id"),
                "_id_fallback": doc.get("_id"),  # certains docs n'ont pas de UUID `id`
                "member_id": None,
                "member_name": "—",
                "action": None,
                "renewal_date": None,
                "review_date": None,
                "month": doc.get("month"),
                "amount": doc.get("amount"),
                "status": None,
                "created_at": doc.get("created_at"),
                "member_club": "—",
                "forensic_club": None,
                "verdict": verdict,
            })
            continue

        member_club, member = await _lookup_member_context(db, doc.get("member_id"))
        forensic_club = None
        if member_club == DEFAULT_CLUB_ID:
            verdict = "OK_VERSOIX"
        elif member_club in ("MEMBER_NOT_FOUND", "NO_MEMBER_ID", "MEMBER_HAS_NO_CLUB"):
            # Tente preuve forensique via activity_log antérieur
            forensic_club = await _forensic_proof_versoix(db, doc.get("member_id"))
            if forensic_club == DEFAULT_CLUB_ID:
                verdict = "OK_FORENSIC_VERSOIX"
            elif forensic_club:
                verdict = f"⚠️ FORENSIC_CROSS_CLUB({forensic_club[:8]}...)"
            else:
                verdict = f"⚠️ {member_club}"
        else:
            verdict = f"⚠️ CROSS_CLUB({member_club[:8]}...)"
        verdict_counter[verdict] += 1
        rows.append({
            "doc_id": doc.get("id"),
            "_id_fallback": doc.get("_id"),
            "member_id": doc.get("member_id"),
            "member_name": (member or {}).get("name", "—"),
            "action": doc.get("action"),
            "renewal_date": doc.get("renewal_date"),
            "review_date": doc.get("review_date"),
            "month": doc.get("month"),
            "amount": doc.get("amount"),
            "status": doc.get("status"),
            "created_at": doc.get("created_at"),
            "member_club": member_club,
            "forensic_club": forensic_club,
            "verdict": verdict,
        })
    return rows, verdict_counter


async def _dry_run(db, collections):
    grand_total = 0
    grand_ok = 0
    grand_anomalies = 0
    for collection in collections:
        print(f"\n=== {collection} ===")
        rows, vcount = await _analyze_collection(db, collection)
        if not rows:
            print("  (aucun orphelin)")
            continue
        for r in rows:
            label_parts = []
            if r.get("action"):
                label_parts.append(f"action={r['action']}")
            if r.get("renewal_date"):
                label_parts.append(f"renewal_date={r['renewal_date']}")
            if r.get("review_date"):
                label_parts.append(f"review_date={r['review_date']}")
            if r.get("month"):
                label_parts.append(f"month={r['month']}")
            if r.get("amount") is not None:
                label_parts.append(f"amount={r['amount']}")
            if r.get("status"):
                label_parts.append(f"status={r['status']}")
            label = " | ".join(label_parts) or "—"
            doc_ref = (r['doc_id'] or r.get('_id_fallback') or '—')[:12]
            print(f"  - member='{r['member_name']}' ({(r['member_id'] or '—')[:8]}) | {label} | created={(str(r['created_at']) or '—')[:19]} | doc={doc_ref} | {r['verdict']}")
        print(f"  Sous-total {collection}: {len(rows)} orphelins | breakdown: {dict(vcount)}")
        grand_total += len(rows)
        ok_count = (
            vcount.get("OK_VERSOIX", 0)
            + vcount.get("OK_FORENSIC_VERSOIX", 0)
            + vcount.get("OK_VERSOIX_NO_MEMBER_REF", 0)
        )
        grand_ok += ok_count
        grand_anomalies += len(rows) - ok_count

    print("\n" + "=" * 90)
    print("RÉSUMÉ DRY-RUN")
    print("=" * 90)
    print(f"Total orphelins analysés     : {grand_total}")
    print(f"  ↳ OK_VERSOIX (à migrer)    : {grand_ok}")
    print(f"  ↳ Anomalies (à examiner)   : {grand_anomalies}")
    if grand_anomalies == 0:
        print("\n✅ Tous les orphelins pointent vers Versoix (direct, forensique, ou no-member-ref safe). Migration safe.")
        print(f"   → Lancer  python {sys.argv[0].split('/')[-1]} {'--phase4 ' if 'payments' in collections else ''}--apply  pour migrer.")
    else:
        print("\n⚠️ Anomalies présentes. Examiner case-par-case AVANT --apply.")
    print("=" * 90)
    return grand_total, grand_ok, grand_anomalies


async def _apply(db, collections):
    # Préparer affichage des chiffres avant confirmation
    print("Analyse pré-apply...")
    totals = {}
    for collection in collections:
        rows, vcount = await _analyze_collection(db, collection)
        ok_count = (
            vcount.get("OK_VERSOIX", 0)
            + vcount.get("OK_FORENSIC_VERSOIX", 0)
            + vcount.get("OK_VERSOIX_NO_MEMBER_REF", 0)
        )
        totals[collection] = {
            "count": len(rows),
            "ok": ok_count,
            "anomalies": len(rows) - ok_count,
            "rows": rows,
        }
    grand_count = sum(t["count"] for t in totals.values())
    grand_ok = sum(t["ok"] for t in totals.values())
    grand_anom = sum(t["anomalies"] for t in totals.values())

    print()
    print("=" * 90)
    print(f"🔴 APPLY mode — Cible: {DEFAULT_CLUB_NAME} ({DEFAULT_CLUB_ID})")
    print("=" * 90)
    for c, t in totals.items():
        print(f"  {c:<25} : {t['count']} orphelins à toucher (OK={t['ok']}, anomalies={t['anomalies']})")
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
    OK_VERDICTS = ("OK_VERSOIX", "OK_FORENSIC_VERSOIX", "OK_VERSOIX_NO_MEMBER_REF")
    for collection in collections:
        coll = db[collection]
        rows = totals[collection]["rows"]
        # Séparation : docs avec UUID `id` vs docs avec _id ObjectId fallback
        ok_uuids = [r["doc_id"] for r in rows if r["verdict"] in OK_VERDICTS and r["doc_id"]]
        ok_objectids = [
            r["_id_fallback"] for r in rows
            if r["verdict"] in OK_VERDICTS and not r["doc_id"] and r.get("_id_fallback")
        ]
        forensic_ids = [
            r["doc_id"] for r in rows if r["verdict"] == "OK_FORENSIC_VERSOIX" and r["doc_id"]
        ]
        if not ok_uuids and not ok_objectids:
            print(f"  {collection}: 0 doc à migrer (skip)")
            continue

        modified_total = 0
        if ok_uuids:
            result = await coll.update_many(
                {"id": {"$in": ok_uuids}, **ORPHAN_FILTER},
                {"$set": {"club_id": DEFAULT_CLUB_ID, "club_id_migrated_at": now_iso}},
            )
            modified_total += result.modified_count
        if ok_objectids:
            # Fallback _id pour docs sans UUID (ex: monthly_kpis legacy)
            result2 = await coll.update_many(
                {"_id": {"$in": ok_objectids}, **ORPHAN_FILTER},
                {"$set": {"club_id": DEFAULT_CLUB_ID, "club_id_migrated_at": now_iso}},
            )
            modified_total += result2.modified_count

        forensic_note = f" (dont {len(forensic_ids)} via preuve forensique)" if forensic_ids else ""
        oid_note = f" + {len(ok_objectids)} via _id" if ok_objectids else ""
        print(f"  {collection}: modified={modified_total}{forensic_note}{oid_note}")
        grand_modified += modified_total

    # Vérification post-apply
    print("\n--- Vérification post-apply (orphelins restants) ---")
    remaining_total = 0
    for collection in collections:
        coll = db[collection]
        remaining = await coll.count_documents(ORPHAN_FILTER)
        remaining_total += remaining
        status = "✅" if remaining == 0 else "⚠️"
        print(f"  {status} {collection}: {remaining} orphelin(s) restant(s)")
    print(f"\nTotal modifié : {grand_modified}")
    print(f"Total orphelins restants : {remaining_total}")
    if remaining_total == 0:
        print(f"✅ Migration complète. 0 orphelin sur les {len(collections)} collections.")
    else:
        print("⚠️ Des orphelins subsistent (probablement des anomalies cross-club non-migrées). Examiner.")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Effectuer les écritures (défaut: dry-run)")
    parser.add_argument(
        "--phase4", action="store_true",
        help="Migrer les 4 collections détectées Phase 4 (payments, monthly_kpis, "
             "challenge_participants, annual_reviews) au lieu des 3 F.3."
    )
    args = parser.parse_args()
    dry_run = not args.apply
    collections = PHASE_4_COLLECTIONS if args.phase4 else COLLECTIONS_TO_MIGRATE
    phase_label = "PHASE 4 (post-Phase 3 close)" if args.phase4 else "F.3 (Sprint Hardening)"

    print("=" * 90)
    print(f"SPRINT HARDENING — {phase_label} — Migration orphelins club_id")
    print("=" * 90)
    print(f"Cible DB     : {DB_NAME}")
    print(f"Cible URL    : {MONGO_URL[:60]}...")
    print(f"Cible club   : {DEFAULT_CLUB_NAME} ({DEFAULT_CLUB_ID})")
    print(f"Collections  : {collections}")
    print(f"Mode         : {'🟢 DRY-RUN (lecture seule)' if dry_run else '🔴 APPLY (écriture)'}")
    print(f"Date         : {datetime.now(timezone.utc).isoformat()}")
    print("=" * 90)
    print()

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    if dry_run:
        await _dry_run(db, collections)
    else:
        await _apply(db, collections)

    client.close()

if __name__ == "__main__":
    asyncio.run(main())
