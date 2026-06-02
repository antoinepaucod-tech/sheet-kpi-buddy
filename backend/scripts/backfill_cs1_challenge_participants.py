"""
Backfill CS1 — challenge_participants orphelins (club_id null/absent).

Contexte
--------
Audit du 2026-06-02 a identifié 7 orphelins `challenge_participants` créés le
2026-05-26 entre 11:19 et 11:32 UTC. Cause racine confirmée : oubli de poser
`p_doc["club_id"]` sur l'insert W6 de `create_member` (members.py L839 pré-fix).

Le fix W6 a été déployé en prod le 2026-06-02 (SHA `75cf445f`, tag
`pre-sb-cs1-ext-prod-deploy`). Plus aucun nouvel orphelin possible. Ce script
backfille les 7 docs figés en posant `club_id` sur la base du parent
`customer_members.club_id` (vérification stricte : seuls les orphelins dont le
parent est Versoix sont backfillés).

Pattern Sprint A / Norman (doc 07)
----------------------------------
- Mode par défaut = **--dry-run** (zéro mutation).
- `--apply` requiert confirmation interactive "yes".
- Découverte dynamique des orphelins (pas de hardcoded ids — robuste si le
  count a bougé entre l'audit et le run).
- Classement OK_VERSOIX (parent club_id=Versoix) vs ANOMALIE (parent
  introuvable ou cross-club) — NE backfille QUE les OK_VERSOIX.
- Audit trail : `club_id_migrated_at`, `remediation_reason`, `created_by_*`
  (sémantique distincte de `updated_at`).
- Idempotent : un doc déjà migré (club_id non-null) est SKIP.
- activity_log : 1 entrée par doc migré.
- Re-audit post-apply : compter les orphelins restants → attendu 0.

Usage
-----
    cd /app/backend && python scripts/backfill_cs1_challenge_participants.py
    cd /app/backend && python scripts/backfill_cs1_challenge_participants.py --apply
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.config import db, MONGO_URL, DB_NAME  # noqa: E402


VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
OPERATOR_EMAIL = "antoine.paucod@the-coach.pro"

REMEDIATION_REASON = (
    "CS1_F2_backfill_orphans_20260526 — challenge_participants créés sans "
    "club_id via members.py L839 (pré-fix W6). Source fermée par patch "
    "SHA 75cf445f (deploy prod 2026-06-02). Backfill basé sur parent "
    "customer_members.club_id (vérifié Versoix avant toute mutation)."
)


def _redact_mongo_uri(uri: str) -> str:
    if "@" in uri and "://" in uri:
        scheme, rest = uri.split("://", 1)
        if "@" in rest:
            creds, host = rest.split("@", 1)
            if ":" in creds:
                user, _ = creds.split(":", 1)
                return f"{scheme}://{user}:***@{host}"
    return uri


def _print_db_target():
    print("=" * 72)
    print("CIBLE DB")
    print(f"  MONGO_URL : {_redact_mongo_uri(MONGO_URL)}")
    print(f"  DB_NAME   : {DB_NAME}")
    print("=" * 72)


async def _discover_orphans() -> list[dict]:
    """Découvre dynamiquement les orphelins challenge_participants."""
    return await db.challenge_participants.find(
        {"$or": [{"club_id": None}, {"club_id": {"$exists": False}}]},
        {"_id": 0},
    ).sort("created_at", 1).to_list(length=None)


async def _classify(orphans: list[dict]) -> tuple[list[dict], list[dict]]:
    """Sépare OK_VERSOIX vs ANOMALIE selon le club_id du parent member."""
    ok, anomalies = [], []
    for o in orphans:
        member_id = o.get("member_id")
        parent = None
        if member_id:
            parent = await db.customer_members.find_one(
                {"id": member_id},
                {"_id": 0, "id": 1, "name": 1, "club_id": 1, "archived_at": 1},
            )
        if not parent:
            o["_verdict"] = "ANOMALIE_parent_introuvable"
            o["_parent"] = None
            anomalies.append(o)
        elif parent.get("club_id") != VERSOIX_CLUB_ID:
            o["_verdict"] = f"ANOMALIE_parent_cross_club={parent.get('club_id')}"
            o["_parent"] = parent
            anomalies.append(o)
        else:
            o["_verdict"] = "OK_VERSOIX"
            o["_parent"] = parent
            ok.append(o)
    return ok, anomalies


def _print_table(orphans: list[dict]):
    print(f"\n{'#':<3} {'participant_id':<40} {'member_id':<40} {'parent.name':<30} {'verdict':<35}")
    print("-" * 150)
    for i, o in enumerate(orphans, 1):
        parent = o.get("_parent") or {}
        print(
            f"{i:<3} {(o.get('id') or '—')[:38]:<40} "
            f"{(o.get('member_id') or '—')[:38]:<40} "
            f"{(parent.get('name') or '—')[:28]:<30} "
            f"{o.get('_verdict', '—'):<35}"
        )


async def _resolve_operator() -> dict | None:
    user = await db.users.find_one({"email": OPERATOR_EMAIL}, {"_id": 0})
    if not user:
        print(f"ERREUR : Operator '{OPERATOR_EMAIL}' introuvable. Audit trail créateur non résolvable, abort.")
        return None
    return user


def _confirm_apply() -> bool:
    print()
    print("⚠️  MODE --apply : mutation réelle de challenge_participants sur Atlas.")
    print(f"⚠️  DB cible : {DB_NAME} @ {_redact_mongo_uri(MONGO_URL)}")
    print()
    answer = input('Tape exactement "yes" pour confirmer : ').strip()
    return answer == "yes"


async def _backfill_one(orphan: dict, operator: dict) -> bool:
    """Effectue le $set sur 1 orphelin OK_VERSOIX. Idempotent : skip si déjà migré."""
    fresh = await db.challenge_participants.find_one({"id": orphan["id"]}, {"_id": 0})
    if not fresh:
        print(f"  SKIP id={orphan['id']} (introuvable au moment du write — concurrent delete ?)")
        return False
    if fresh.get("club_id"):
        print(f"  SKIP id={orphan['id']} (déjà migré, club_id={fresh.get('club_id')})")
        return False

    now_iso = datetime.now(timezone.utc).isoformat()
    set_doc = {
        "club_id": VERSOIX_CLUB_ID,
        "club_id_migrated_at": now_iso,
        "remediation_reason": REMEDIATION_REASON,
        "created_by_user_id": operator.get("id"),
        "created_by_email": operator.get("email"),
    }
    result = await db.challenge_participants.update_one(
        {"id": orphan["id"], "$or": [{"club_id": None}, {"club_id": {"$exists": False}}]},
        {"$set": set_doc},
    )
    if result.modified_count != 1:
        print(f"  WARN id={orphan['id']} modified_count={result.modified_count} (race condition ?)")
        return False

    # activity_log per doc
    try:
        await db.activity_log.insert_one({
            "id": str(uuid.uuid4()),
            "action": "challenge_participant_club_id_backfill_cs1",
            "target_collection": "challenge_participants",
            "target_id": orphan["id"],
            "member_id": orphan.get("member_id"),
            "member_name": (orphan.get("_parent") or {}).get("name"),
            "club_id": VERSOIX_CLUB_ID,
            "actor_user_id": operator.get("id"),
            "actor_email": operator.get("email"),
            "notes": "Script backfill_cs1_challenge_participants.py --apply",
            "created_at": now_iso,
        })
    except Exception as exc:
        print(f"  WARN log_activity échec (non-bloquant) : {exc}")

    print(f"  ✅ MIGRÉ id={orphan['id']} → club_id={VERSOIX_CLUB_ID}")
    return True


async def _post_audit() -> int:
    remaining = await db.challenge_participants.count_documents(
        {"$or": [{"club_id": None}, {"club_id": {"$exists": False}}]}
    )
    print()
    print("=" * 72)
    print("RE-AUDIT POST-APPLY")
    print("=" * 72)
    print(f"  Orphelins challenge_participants restants : {remaining}")
    if remaining == 0:
        print("  ✅ ZÉRO orphelin — backfill complet.")
    else:
        print(f"  ⚠️  {remaining} orphelin(s) restant(s) — vérifier ANOMALIES non backfillées.")
        residual = await db.challenge_participants.find(
            {"$or": [{"club_id": None}, {"club_id": {"$exists": False}}]},
            {"_id": 0, "id": 1, "member_id": 1},
        ).to_list(length=None)
        for d in residual:
            print(f"     - id={d['id']} member_id={d.get('member_id')}")
    return remaining


async def main(apply: bool) -> int:
    _print_db_target()
    print()

    orphans = await _discover_orphans()
    print(f"DÉCOUVERTE : {len(orphans)} orphelin(s) challenge_participants (club_id null/absent)")

    if not orphans:
        print("Aucun orphelin à traiter. Exit 0.")
        return 0

    ok, anomalies = await _classify(orphans)
    _print_table(orphans)

    print()
    print(f"Bilan classement : OK_VERSOIX={len(ok)}  ANOMALIES={len(anomalies)}")
    if anomalies:
        print("⚠️  ANOMALIES (NON backfillées) :")
        for a in anomalies:
            print(f"   - id={a['id']} verdict={a['_verdict']}")

    if not apply:
        print()
        print(f"--dry-run : aucune mutation. {len(ok)} doc(s) seraient migrés vers club_id={VERSOIX_CLUB_ID}.")
        print("Relancer avec --apply pour exécuter.")
        return 0

    # Mode --apply
    if not ok:
        print("\nAucun OK_VERSOIX à migrer. Exit 0.")
        return 0

    operator = await _resolve_operator()
    if not operator:
        return 1

    if not _confirm_apply():
        print("Confirmation refusée. Abort.")
        return 2

    print()
    print("=" * 72)
    print(f"APPLY — backfill de {len(ok)} doc(s)")
    print("=" * 72)
    migrated = 0
    for o in ok:
        if await _backfill_one(o, operator):
            migrated += 1
    print()
    print(f"Total migrés : {migrated}/{len(ok)}")

    remaining = await _post_audit()
    return 0 if remaining == 0 else 3


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill CS1 — challenge_participants orphelins.")
    parser.add_argument("--apply", action="store_true", help="Exécuter les mutations (sinon dry-run).")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(apply=args.apply)))
