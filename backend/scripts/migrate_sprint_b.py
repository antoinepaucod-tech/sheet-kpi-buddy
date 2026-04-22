"""
SPRINT B — Script de Migration (Nettoyage données fantômes + finition soft delete)

Ce script :
1. Initialise `rent_amount=0.0` et `rent_status="impayé"` sur les coachs qui n'ont pas encore ces champs
2. Archive les membres avec `exit_date` passé (set `archived_at` au now)
3. Gère les doublons (même `name` + `club_id`) :
   - Garde l'entrée avec abonnement actif (pas d'`exit_date` ou `exit_date` futur)
   - Archive les autres entrées sans abo actif
   - Logue les cas ambigus (plusieurs entrées actives OU toutes inactives) SANS rien modifier

USAGE:
    python scripts/migrate_sprint_b.py --dry-run     # Affiche le rapport, aucune modification
    python scripts/migrate_sprint_b.py --apply       # Applique réellement les changements

DRY-RUN EST LE DEFAULT. Sans argument, le script affiche le rapport.
"""
import asyncio
import argparse
import os
import sys
from datetime import datetime, timezone
from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']


async def main(apply: bool = False):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    mode = "APPLY" if apply else "DRY-RUN"
    now_iso = datetime.now(timezone.utc).isoformat()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    print(f"\n{'='*70}")
    print(f"  SPRINT B MIGRATION — Mode: {mode}")
    print(f"  Timestamp: {now_iso}")
    print(f"{'='*70}\n")

    report = {
        "coaches_rent_init": [],
        "members_archived_by_exit_date": [],
        "duplicates_archived": [],
        "duplicates_ambiguous_logged_only": [],
    }

    # ── 1) Coaches: init rent_amount / rent_status ─────────────────────────
    print("[1/3] Initialisation des champs rent_* sur les coachs...")
    coaches = await db.coaches.find({}, {"_id": 0}).to_list(5000)
    for c in coaches:
        needs_update = {}
        if c.get("rent_amount") is None:
            needs_update["rent_amount"] = 0.0
        if c.get("rent_status") is None or c.get("rent_status") == "":
            needs_update["rent_status"] = "impayé"
        if needs_update:
            report["coaches_rent_init"].append({
                "id": c.get("id"),
                "name": c.get("name", "?"),
                "club_id": c.get("club_id"),
                "fields_to_set": needs_update,
            })
            if apply:
                needs_update["updated_at"] = now_iso
                await db.coaches.update_one({"id": c["id"]}, {"$set": needs_update})

    print(f"  → {len(report['coaches_rent_init'])} coach(s) avec rent_* manquant")

    # ── 2) Members: archive ceux avec exit_date passé ────────────────────
    print("\n[2/3] Archivage des membres avec exit_date passé...")
    members = await db.customer_members.find({}, {"_id": 0}).to_list(10000)
    for m in members:
        if m.get("archived_at"):
            continue  # déjà archivé
        exit_d = m.get("exit_date")
        if exit_d and exit_d not in (None, "", "None") and str(exit_d) < today_str:
            report["members_archived_by_exit_date"].append({
                "id": m.get("id"),
                "name": m.get("name", "?"),
                "club_id": m.get("club_id"),
                "exit_date": exit_d,
                "membership": m.get("membership", ""),
            })
            if apply:
                await db.customer_members.update_one(
                    {"id": m["id"]},
                    {"$set": {"archived_at": now_iso, "updated_at": now_iso}}
                )

    print(f"  → {len(report['members_archived_by_exit_date'])} membre(s) à archiver via exit_date")

    # ── 3) Doublons (name + club_id) ────────────────────────────────────
    print("\n[3/3] Détection des doublons (name + club_id)...")

    # Refresh members after section 2 if applied (avoid double-counting)
    members_fresh = await db.customer_members.find({}, {"_id": 0}).to_list(10000)
    groups = defaultdict(list)
    for m in members_fresh:
        key = (m.get("name", "").strip().lower(), m.get("club_id", ""))
        if key[0]:
            groups[key].append(m)

    def is_active(m):
        """Un membre est actif si non archivé ET exit_date non passé."""
        if m.get("archived_at"):
            return False
        exit_d = m.get("exit_date")
        if exit_d and exit_d not in (None, "", "None") and str(exit_d) < today_str:
            return False
        return True

    for (name, club_id), entries in groups.items():
        if len(entries) < 2:
            continue

        active_entries = [m for m in entries if is_active(m)]
        inactive_entries = [m for m in entries if not is_active(m)]

        # Cas simple : 1 seul actif → les inactifs sont déjà archivés ou seront ignorés
        if len(active_entries) == 1 and inactive_entries:
            # Archiver uniquement les inactifs non-déjà-archivés
            to_archive = [m for m in inactive_entries if not m.get("archived_at")]
            if to_archive:
                for m in to_archive:
                    report["duplicates_archived"].append({
                        "id": m.get("id"),
                        "name": m.get("name", "?"),
                        "club_id": m.get("club_id"),
                        "exit_date": m.get("exit_date"),
                        "kept_active_id": active_entries[0].get("id"),
                        "reason": "duplicate_inactive",
                    })
                    if apply:
                        await db.customer_members.update_one(
                            {"id": m["id"]},
                            {"$set": {"archived_at": now_iso, "updated_at": now_iso}}
                        )

        # Cas ambigus : >1 actifs → on ne sait pas lequel garder
        elif len(active_entries) > 1:
            report["duplicates_ambiguous_logged_only"].append({
                "name": name,
                "club_id": club_id,
                "total_entries": len(entries),
                "active_count": len(active_entries),
                "archived_count": sum(1 for m in entries if m.get("archived_at")),
                "entry_ids": [m.get("id") for m in entries],
                "memberships": [m.get("membership", "") for m in entries],
                "exit_dates": [m.get("exit_date") for m in entries],
                "note": "Plusieurs entrées actives pour un même nom → à arbitrer",
            })
        # Cas 0 actif : déjà couvert par l'étape 2 (archivage par exit_date)
        # Pas d'action supplémentaire nécessaire.

    print(f"  → {len(report['duplicates_archived'])} doublon(s) inactifs à archiver")
    print(f"  → {len(report['duplicates_ambiguous_logged_only'])} cas ambigu(s) (LOG ONLY, pas d'action)")

    # ── Rapport final ────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  RAPPORT FINAL — Mode: {mode}")
    print(f"{'='*70}")
    print(f"  Coachs → rent_* init           : {len(report['coaches_rent_init'])}")
    print(f"  Membres → archived (exit_date) : {len(report['members_archived_by_exit_date'])}")
    print(f"  Membres → archived (doublon)   : {len(report['duplicates_archived'])}")
    print(f"  Cas ambigus (non touchés)      : {len(report['duplicates_ambiguous_logged_only'])}")
    print(f"{'='*70}\n")

    # Détails des cas ambigus (pour décision utilisateur)
    if report["duplicates_ambiguous_logged_only"]:
        print("⚠️  CAS AMBIGUS (à arbitrer manuellement) :")
        for i, case in enumerate(report["duplicates_ambiguous_logged_only"], 1):
            print(f"  {i}. {case['name']!r} (club={case['club_id']!r})")
            print(f"     Entries: {case['total_entries']} | actifs: {case['active_count']} | archivés: {case['archived_count']}")
            print(f"     Memberships: {case['memberships']}")
            print(f"     Exit_dates: {case['exit_dates']}")
            print(f"     IDs: {case['entry_ids']}")
            print()

    # Save report to JSON file for review
    import json
    out_path = os.path.join(os.path.dirname(__file__), f"migrate_sprint_b_report_{'apply' if apply else 'dryrun'}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)
    print(f"📄 Rapport détaillé sauvegardé : {out_path}\n")

    if not apply:
        print("💡 Pour APPLIQUER les changements : python scripts/migrate_sprint_b.py --apply")
    else:
        print("✅ Migration APPLIQUÉE en base.")

    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sprint B — Migration nettoyage & soft delete")
    parser.add_argument("--apply", action="store_true", help="Applique les changements (sinon dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="Dry-run (default)")
    args = parser.parse_args()

    apply_mode = args.apply
    if apply_mode:
        # Confirmation obligatoire
        resp = input("\n⚠️  Tu t'apprêtes à APPLIQUER la migration. Tape 'APPLY' pour confirmer : ")
        if resp.strip() != "APPLY":
            print("Annulé.")
            sys.exit(0)

    asyncio.run(main(apply=apply_mode))
