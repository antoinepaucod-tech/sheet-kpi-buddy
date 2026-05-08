"""
Merge sélectif DB-A dump → Atlas perso (club_management)

Phase 1 — Whitelist : accounting_transactions, weekly_trainings, course_kpis, activity_logs
Stratégie : INSERT si id absent dans Atlas. AUCUN UPDATE, AUCUN DELETE.
"""
import asyncio
import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from core.config import MONGO_URL, DB_NAME, db  # noqa: E402

DUMP_DIR = "/app/backups/db_a_recovery_20260508_143046"
WHITELIST = ["accounting_transactions", "weekly_trainings", "course_kpis", "activity_logs"]


async def main(apply: bool = False):
    host = MONGO_URL.split('@')[1].split('/')[0] if '@' in MONGO_URL else 'localhost'
    print("\n🎯 Cible DB      :", DB_NAME)
    print(f"🎯 MONGO_URL host: {host}")
    print(f"⚠️  Vérifie que c'est bien Atlas (transform.iocnr7b.mongodb.net) avant de continuer !\n")

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"\n{'='*80}\n  MERGE DB-A → Atlas — Mode: {mode}\n{'='*80}\n")

    summary = []
    for coll in WHITELIST:
        path = os.path.join(DUMP_DIR, f"{coll}.json")
        if not os.path.isfile(path):
            print(f"❌ {coll} : fichier dump introuvable, SKIP")
            continue
        with open(path) as f:
            db_a_docs = json.load(f)

        # Charge ids déjà présents Atlas
        atlas_ids = set()
        async for doc in db[coll].find({}, {"_id": 0, "id": 1}):
            if doc.get("id"):
                atlas_ids.add(doc["id"])

        to_insert = [d for d in db_a_docs if d.get("id") and d["id"] not in atlas_ids]

        # Strip _id (string ObjectId) pour laisser Mongo en générer un nouveau
        for d in to_insert:
            d.pop("_id", None)

        n_total = len(db_a_docs)
        n_skip = n_total - len(to_insert)
        n_to_insert = len(to_insert)

        print(f"📌 {coll}")
        print(f"   DB-A total      : {n_total}")
        print(f"   Atlas existants : {len(atlas_ids)}")
        print(f"   À skipper       : {n_skip}")
        print(f"   À insérer       : {n_to_insert}")

        inserted = 0
        if apply and to_insert:
            try:
                result = await db[coll].insert_many(to_insert, ordered=False)
                inserted = len(result.inserted_ids)
                print(f"   ✅ Insérés       : {inserted}")
            except Exception as e:
                print(f"   ❌ Erreur insert: {e}")
        else:
            print(f"   (dry-run, aucun write)")

        summary.append({
            "collection": coll,
            "to_insert": n_to_insert,
            "inserted": inserted,
            "atlas_existing": len(atlas_ids),
            "db_a_total": n_total,
        })
        print()

    print("="*80)
    print("  RÉCAP")
    print("="*80)
    print(f"{'Collection':<32} {'Insérés' if apply else 'À insérer':>12}")
    total = 0
    for s in summary:
        n = s["inserted"] if apply else s["to_insert"]
        total += n
        print(f"{s['collection']:<32} {n:>12}")
    print(f"{'TOTAL':<32} {total:>12}")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.apply:
        resp = input("⚠️  APPLY ? Tape 'APPLY' pour confirmer : ")
        if resp.strip() != "APPLY":
            print("Annulé.")
            sys.exit(0)
    asyncio.run(main(apply=args.apply))
