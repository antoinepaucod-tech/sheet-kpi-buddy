"""
Remédiation `payment_schedule` manquant pour Norman Pilller.

Contexte
--------
Audit "billing_enabled=true sans payment_schedule" (2026-05-18) a détecté UN
seul orphelin réel : Norman Pilller (id `d0b6a5d2-9ec4-4609-ba4c-c669c375de27`).
Il a `billing_enabled=true`, `billing_amount=470`, abonnement
"THE COACH PASS MENSUEL" (Coach mensuel), mais aucun `payment_schedule` en DB.

Décision utilisateur (2026-05-18)
---------------------------------
→ Démarrage propre **2026-06-01** (option c).
  - Avril & mai 2026 sont/seront payés manuellement via
    accounting_transactions, pas de rattrapage rétroactif via schedule.
  - billing_day = 1 (1er du mois calendaire, cohérent avec
    `billing_cycle_type=monthly_day` + `billing_cycle_value=1` du membre)
  - amount = 470 CHF (confirmé)
  - frequency = monthly (recurrence_type=monthly_day)

Pattern Sprint A
----------------
- Mode par défaut = **--dry-run** (aucune mutation).
- `--apply` requiert confirmation interactive "yes".
- Idempotent : si Norman a déjà un `payment_schedule.is_active=True`,
  le script log NO_ACTION et exit 0 sans rien insérer.
- Garde-fou cible DB : affiche l'URI Mongo + nom DB avant toute mutation.
- Garde-fou club_id : vérifie que Norman appartient bien au club Versoix
  (`0a327bf5-c759-49eb-87e4-551913f78bdb`).
- Log activity_log.

Usage
-----
    # Dry-run (par défaut)
    cd /app/backend && python scripts/remediate_norman_payment_schedule.py

    # Apply (mutation réelle)
    cd /app/backend && python scripts/remediate_norman_payment_schedule.py --apply
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Permettre l'import depuis /app/backend
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.config import db, client, MONGO_URL, DB_NAME  # noqa: E402

# --- Cibles --------------------------------------------------------------
NORMAN_ID = "d0b6a5d2-9ec4-4609-ba4c-c669c375de27"
VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"

# Plan d'insertion validé par l'utilisateur (option c)
PLANNED_SCHEDULE = {
    "member_id": NORMAN_ID,
    "amount": 470.0,
    "recurrence_type": "monthly_day",
    "recurrence_value": 1,
    "start_date": "2026-06-01",
    "end_date": None,
    "payment_method": "prelevement",
    "is_active": True,
    "notes": (
        "Remédiation manuelle 2026-05-18 : payment_schedule manquant "
        "(détecté par audit billing_without_schedule). Démarrage propre au "
        "2026-06-01, avril+mai facturés en accounting_transactions."
    ),
    "club_id": VERSOIX_CLUB_ID,
}


def _redact_mongo_uri(uri: str) -> str:
    """Masque le password dans l'URI Mongo pour l'affichage."""
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


async def _check_member() -> dict | None:
    """Vérifie que Norman existe, n'est pas archivé et appartient à Versoix."""
    member = await db.customer_members.find_one({"id": NORMAN_ID}, {"_id": 0})
    if not member:
        print(f"ERREUR : Aucun membre avec id={NORMAN_ID}")
        return None
    if member.get("club_id") != VERSOIX_CLUB_ID:
        print(
            f"ERREUR : club_id mismatch (attendu={VERSOIX_CLUB_ID}, "
            f"trouvé={member.get('club_id')})"
        )
        return None
    if member.get("archived_at"):
        print(f"ERREUR : Norman est archivé (archived_at={member['archived_at']})")
        return None
    if not member.get("billing_enabled"):
        print("ERREUR : billing_enabled n'est pas True sur ce membre")
        return None
    return member


async def _check_existing_schedule() -> dict | None:
    """Retourne le schedule actif existant pour Norman, ou None."""
    return await db.payment_schedules.find_one(
        {"member_id": NORMAN_ID, "is_active": True}, {"_id": 0}
    )


def _build_schedule_doc() -> dict:
    """Construit le doc final à insérer (UUID + timestamps frais à chaque run)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid.uuid4()),
        **PLANNED_SCHEDULE,
        "created_at": now_iso,
        "updated_at": now_iso,
    }


async def _log_activity(schedule_id: str) -> None:
    """Log activity_log (best effort, non bloquant)."""
    try:
        await db.activity_log.insert_one({
            "id": str(uuid.uuid4()),
            "action": "payment_schedule_remediation",
            "target_collection": "payment_schedules",
            "target_id": schedule_id,
            "member_id": NORMAN_ID,
            "member_name": "Norman Pilller",
            "club_id": VERSOIX_CLUB_ID,
            "notes": "Script remediate_norman_payment_schedule.py --apply",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:  # pragma: no cover
        print(f"WARN: impossible de logger activity_log : {exc}")


def _confirm_apply() -> bool:
    """Demande confirmation interactive 'yes' (Pattern Sprint A)."""
    print()
    print("⚠️  MODE --apply : une insertion réelle va être effectuée sur Atlas.")
    print(f"⚠️  DB cible : {DB_NAME} @ {_redact_mongo_uri(MONGO_URL)}")
    print()
    answer = input('Tape exactement "yes" pour confirmer : ').strip()
    return answer == "yes"


async def main(apply: bool) -> int:
    _print_db_target()
    print()
    print(f"[1/4] Vérification du membre Norman ({NORMAN_ID})...")
    member = await _check_member()
    if not member:
        return 2
    print(
        f"  → OK : {member['name']} | membership={member['membership']} | "
        f"billing_amount={member['billing_amount']} | "
        f"billing_cycle={member.get('billing_cycle_type')}/{member.get('billing_cycle_value')}"
    )

    print()
    print("[2/4] Vérification de l'absence d'un schedule actif (idempotence)...")
    existing = await _check_existing_schedule()
    if existing:
        print("  → NO_ACTION : Un payment_schedule actif existe déjà.")
        print(json.dumps(existing, default=str, indent=2))
        return 0
    print("  → OK : aucun schedule actif. Insertion nécessaire.")

    print()
    print("[3/4] Document qui sera inséré :")
    planned_doc = _build_schedule_doc()
    print(json.dumps(planned_doc, default=str, indent=2))

    print()
    if not apply:
        print("[4/4] DRY-RUN — aucune insertion effectuée.")
        print("    Pour appliquer : python scripts/remediate_norman_payment_schedule.py --apply")
        return 0

    if not _confirm_apply():
        print("[4/4] ANNULÉ — confirmation 'yes' non reçue.")
        return 1

    print("[4/4] Insertion en cours...")
    await db.payment_schedules.insert_one(planned_doc)
    planned_doc.pop("_id", None)
    await _log_activity(planned_doc["id"])

    # Re-fetch pour confirmation
    inserted = await db.payment_schedules.find_one(
        {"id": planned_doc["id"]}, {"_id": 0}
    )
    print("  → OK : payment_schedule inséré.")
    print(json.dumps(inserted, default=str, indent=2))
    print()
    print("✅ Remédiation Norman Pilller terminée.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Remédie le payment_schedule manquant pour Norman Pilller."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Exécute réellement l'insertion (sinon mode dry-run).",
    )
    args = parser.parse_args()

    try:
        exit_code = asyncio.run(main(apply=args.apply))
    finally:
        client.close()
    sys.exit(exit_code)
