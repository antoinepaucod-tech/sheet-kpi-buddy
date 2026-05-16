"""Migration : ajoute le champ `public_name` sur les docs `clubs`.

Option C validée par Antoine (2026-05-15) : on stocke un nom member-facing
distinct du `name` interne (qui reste "Transform Versoix" pour le backoffice).

Pattern Sprint A : --dry-run par défaut, --apply pour exécution + confirmation
interactive (`yes`). Aucune mutation sur champ existant : on $set uniquement
`public_name` (et `public_name_migrated_at` pour audit/idempotence).

Scope (validé) : UNIQUEMENT Versoix.
  - 0a327bf5-c759-49eb-87e4-551913f78bdb → "Hybrid Gym Geneva"

Les 3 autres clubs (Servette, Grand-Saconnex, Lausanne) seront migrés
plus tard quand ils seront activés.

Usage :
    python scripts/migrate_add_public_name.py            # dry-run
    python scripts/migrate_add_public_name.py --apply    # apply
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import db, MONGO_URL, DB_NAME  # noqa: E402


# Mapping autorisé (id club → public_name souhaité)
TARGETS = {
    "0a327bf5-c759-49eb-87e4-551913f78bdb": "Hybrid Gym Geneva",
    # Les 3 autres clubs ne sont PAS dans ce mapping : pas touchés.
}


def _confirm_target_db() -> None:
    """Affiche la cible Atlas + demande confirmation visuelle."""
    print("=" * 70)
    print(" CIBLE MONGODB")
    print("=" * 70)
    print(f"  MONGO_URL : {MONGO_URL[:60]}...")
    print(f"  DB_NAME   : {DB_NAME}")
    print("=" * 70)


async def audit() -> list[dict]:
    """Lit l'état actuel des clubs cibles. Aucune mutation."""
    out = []
    for club_id, desired_public_name in TARGETS.items():
        doc = await db.clubs.find_one(
            {"id": club_id},
            {"_id": 0, "id": 1, "name": 1, "public_name": 1, "public_name_migrated_at": 1},
        )
        if not doc:
            out.append({
                "club_id": club_id,
                "status": "NOT_FOUND",
                "current_name": None,
                "current_public_name": None,
                "desired_public_name": desired_public_name,
                "action": "SKIP",
            })
            continue
        current_pn = doc.get("public_name")
        already_migrated = bool(doc.get("public_name_migrated_at"))
        if current_pn == desired_public_name:
            action = "ALREADY_SET"
        elif current_pn:
            action = "SKIP_EXISTING_PUBLIC_NAME"  # safety : ne pas écraser sans intent explicite
        else:
            action = "WILL_SET"
        out.append({
            "club_id": club_id,
            "status": "FOUND",
            "current_name": doc.get("name"),
            "current_public_name": current_pn,
            "desired_public_name": desired_public_name,
            "already_migrated_at": doc.get("public_name_migrated_at"),
            "action": action,
            "already_migrated": already_migrated,
        })
    return out


async def apply(report: list[dict]) -> dict:
    """Applique uniquement les actions WILL_SET. Idempotent grâce au filtre.
    Retourne stats {migrated, skipped, not_found, errors}.
    """
    stats = {"migrated": 0, "skipped": 0, "not_found": 0, "errors": 0, "details": []}
    now_iso = datetime.now(timezone.utc).isoformat()

    for item in report:
        cid = item["club_id"]
        action = item["action"]

        if action == "NOT_FOUND" or item["status"] == "NOT_FOUND":
            stats["not_found"] += 1
            stats["details"].append({"club_id": cid, "outcome": "not_found"})
            continue

        if action != "WILL_SET":
            stats["skipped"] += 1
            stats["details"].append({"club_id": cid, "outcome": f"skip_{action.lower()}"})
            continue

        try:
            res = await db.clubs.update_one(
                {
                    "id": cid,
                    # garde-fou idempotence : n'écrit que si public_name absent
                    "$or": [
                        {"public_name": None},
                        {"public_name": ""},
                        {"public_name": {"$exists": False}},
                    ],
                },
                {
                    "$set": {
                        "public_name": item["desired_public_name"],
                        "public_name_migrated_at": now_iso,
                    }
                },
            )
            if res.modified_count == 1:
                stats["migrated"] += 1
                stats["details"].append({
                    "club_id": cid,
                    "outcome": "migrated",
                    "public_name": item["desired_public_name"],
                })
            else:
                stats["skipped"] += 1
                stats["details"].append({
                    "club_id": cid,
                    "outcome": "skip_already_set_by_concurrent",
                })
        except Exception as e:
            stats["errors"] += 1
            stats["details"].append({"club_id": cid, "outcome": f"error: {e}"})

    return stats


async def main():
    parser = argparse.ArgumentParser(description="Migrate public_name on clubs collection")
    parser.add_argument("--apply", action="store_true", help="Exécute (sinon dry-run)")
    args = parser.parse_args()

    _confirm_target_db()
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"\n  MODE : {mode}")
    print("=" * 70)

    if args.apply:
        ans = input("\nConfirme l'écriture sur cette cible Atlas ? Tape 'yes' pour valider : ").strip().lower()
        if ans != "yes":
            print("Annulé.")
            return

    print("\n[AUDIT] État actuel des clubs cibles :")
    report = await audit()
    for item in report:
        print(json.dumps(item, ensure_ascii=False, indent=2))

    if not args.apply:
        print("\n[DRY-RUN] Actions qui seraient appliquées :")
        for item in report:
            if item["action"] == "WILL_SET":
                print(
                    f"  → SET public_name='{item['desired_public_name']}' "
                    f"sur club_id={item['club_id']} (name='{item['current_name']}')"
                )
        will_set = sum(1 for i in report if i["action"] == "WILL_SET")
        print(f"\nRésumé dry-run : {will_set} doc(s) à migrer.")
        print("\nLance avec --apply (et confirmation 'yes') pour exécuter.")
        return

    print("\n[APPLY] Exécution...")
    stats = await apply(report)
    print("\n[RÉSULTAT]")
    print(json.dumps(stats, ensure_ascii=False, indent=2))

    print("\n[VÉRIFICATION POST-APPLY]")
    final = await audit()
    for item in final:
        print(f"  · club_id={item['club_id']} → public_name='{item.get('current_public_name')}' "
              f"(name='{item.get('current_name')}', migrated_at={item.get('already_migrated_at')})")


if __name__ == "__main__":
    asyncio.run(main())
