"""AUDIT READ-ONLY — Documents `clubs` avec `id` manquant ou vide.

Contexte
--------
Phase 2 trace (2026-05-19) sur `rollover.py:181 _ensure_kpi_exists` a
formulé l'hypothèse suivante : si `run_rollover_all_clubs` itère sur
`db.clubs.find()` et qu'un doc legacy n'a pas de champ `id`, alors
`club_id = club.get("id") = None` est passé à `_ensure_kpi_exists`, qui
insère un `monthly_kpis` orphelin (cas du `2026-06` détecté Phase 1).

Ce script CONFIRME ou INFIRME cette hypothèse SANS toucher la base.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.config import db, client, MONGO_URL, DB_NAME  # noqa: E402


def _redact(uri: str) -> str:
    if "@" in uri and "://" in uri:
        scheme, rest = uri.split("://", 1)
        if "@" in rest:
            creds, host = rest.split("@", 1)
            if ":" in creds:
                user, _ = creds.split(":", 1)
                return f"{scheme}://{user}:***@{host}"
    return uri


async def main() -> int:
    print("=" * 72)
    print("AUDIT READ-ONLY — clubs sans `id`")
    print(f"  Atlas : {_redact(MONGO_URL)}")
    print(f"  DB    : {DB_NAME}")
    print("  MODE  : READ-ONLY STRICT (aucune mutation)")
    print("=" * 72)

    total = await db.clubs.count_documents({})
    print(f"\nTotal docs `clubs` : {total}")

    # Filtre : id absent OR null OR empty string
    null_filter = {
        "$or": [{"id": None}, {"id": {"$exists": False}}, {"id": ""}]
    }
    cursor = db.clubs.find(null_filter)
    rows = await cursor.to_list(length=100)

    print(f"Docs avec id null/missing/empty : {len(rows)}")
    if not rows:
        print("\n✅ Aucun doc legacy détecté. L'hypothèse Phase 2 est INFIRMÉE.")
        print("   → L'orphelin monthly_kpis 2026-06 vient d'une autre source")
        print("     (appel manuel, test, ou code path à identifier).")
        return 0

    print("\n⚠️  HYPOTHÈSE PHASE 2 CONFIRMÉE — Docs legacy détectés :")
    for i, doc in enumerate(rows, 1):
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        # Affiche les clés intéressantes
        compact = {
            k: v for k, v in doc.items()
            if k in ("_id", "id", "name", "slug", "created_at", "owner_id")
        }
        print(f"  [{i}] {json.dumps(compact, default=str)}")
    print("\nNote : ces docs ne sont PAS supprimés ici (action Phase 4 ou Sprint dédié).")
    return 0


if __name__ == "__main__":
    try:
        rc = asyncio.run(main())
    finally:
        client.close()
    sys.exit(rc)
