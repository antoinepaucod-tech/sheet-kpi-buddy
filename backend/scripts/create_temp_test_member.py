"""Crée un membre test _TEMP_TEST_Antoine pour SB5 cutover validation.

Diffère de `e2e_test_renewal.py` : NE déclenche AUCUN envoi Resend.
Le user pilote l'envoi via l'UI MembersPage (bouton Relancer X expirés).

Usage :
    python scripts/create_temp_test_member.py <email_destination>

Cleanup partagé avec `e2e_test_renewal.py --cleanup` qui delete par regex
`^_TEMP_TEST_` (pattern Sprint A).
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import db, MONGO_URL, DB_NAME  # noqa: E402

TEST_NAME = "_TEMP_TEST_Antoine"
VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"


def _confirm_target(email: str):
    print("=" * 70)
    print(" CRÉATION MEMBRE TEST SB5 — cutover validation")
    print("=" * 70)
    print(f"  MONGO_URL  : {MONGO_URL[:55]}...")
    print(f"  DB_NAME    : {DB_NAME}")
    print(f"  TEST_NAME  : {TEST_NAME}")
    print(f"  EMAIL_DEST : {email}")
    print(f"  CLUB_ID    : {VERSOIX_CLUB_ID} (Versoix)")
    print("=" * 70)


async def cleanup_first() -> int:
    """Pre-cleanup tout doc _TEMP_TEST_* leftover."""
    res = await db.customer_members.delete_many({"name": {"$regex": "^_TEMP_TEST_"}})
    return res.deleted_count


async def create(email: str) -> dict:
    now = datetime.now(timezone.utc)
    past_end_date = (now - timedelta(days=5)).date().isoformat()
    member_id = str(uuid.uuid4())
    doc = {
        "id": member_id,
        "name": TEST_NAME,
        "email": email,
        "phone": "+41000000000",
        "membership": "HYBRID GYM",
        "member_type": "Membres Généraux Récurrents",
        "club_id": VERSOIX_CLUB_ID,
        "contract_signed_date": (now - timedelta(days=400)).date().isoformat(),
        "subscription_end_date": past_end_date,  # 5j passé → is_expired=true
        "exit_date": None,
        "cash_collected": 0,
        "billing_enabled": False,
        "billing_amount": 0,
        "archived_at": None,
        "marketing_opt_out": False,
        "last_renewal_reminder_at": None,
        "renewal_reminder_count": 0,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.customer_members.insert_one(dict(doc))
    return doc


async def main():
    if len(sys.argv) < 2 or "@" not in sys.argv[1]:
        print("Usage: python scripts/create_temp_test_member.py <email>")
        sys.exit(1)
    email = sys.argv[1].strip()

    _confirm_target(email)

    pre = await cleanup_first()
    if pre:
        print(f"\n[PRE-CLEANUP] {pre} doc(s) _TEMP_TEST_* purgé(s).")

    print("\n[CRÉATION]")
    doc = await create(email)
    print(f"  · id                       = {doc['id']}")
    print(f"  · name                     = {doc['name']}")
    print(f"  · email                    = {doc['email']}")
    print(f"  · club_id                  = {doc['club_id']}")
    print(f"  · subscription_end_date    = {doc['subscription_end_date']} (5j passé → is_expired=true)")
    print(f"  · archived_at              = {doc['archived_at']}")
    print(f"  · marketing_opt_out        = {doc['marketing_opt_out']}")
    print(f"  · last_renewal_reminder_at = {doc['last_renewal_reminder_at']}")
    print()
    print("=" * 70)
    print(" PROCHAINES ÉTAPES POUR ANTOINE")
    print("=" * 70)
    print("  1. Ouvre MembersPage (preview), toggle EXPIRÉS ON")
    print(f"  2. Cherche {TEST_NAME} → badge EXPIRÉ rouge visible")
    print("  3. Sélectionne-le seul, clique 📧 Relancer 1 expiré → Confirme")
    print("  4. Vérifie ta boîte mail")
    print()
    print("  CLEANUP final (obligatoire après validation) :")
    print("    python scripts/e2e_test_renewal.py --cleanup")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
