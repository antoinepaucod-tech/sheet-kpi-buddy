"""E2E test : create _TEMP_TEST_ expired member → send 1 renewal email → report.

Sécurité :
  - Le doc test a `name="_TEMP_TEST_ Member"` pour identification visuelle DB
  - Si le script échoue avant cleanup, le helper `cleanup_temp_test_member.py`
    permet de retirer le doc par id ou par name="_TEMP_TEST_*"
  - Mutation Atlas explicite : on crée 1 doc customer_members + on update son
    last_renewal_reminder_at après envoi Resend.

Usage :
    python scripts/e2e_test_renewal.py            # create + send + print id
    python scripts/e2e_test_renewal.py --cleanup  # delete by name prefix
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import db, MONGO_URL, DB_NAME  # noqa: E402
from core.notifications import send_renewal_reminder  # noqa: E402


TEST_EMAIL = "antoine.paucod@the-coach.pro"
TEST_NAME = "_TEMP_TEST_ Member"
VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"


def _confirm_target() -> None:
    print("=" * 70)
    print(" CIBLE MONGODB")
    print("=" * 70)
    print(f"  MONGO_URL : {MONGO_URL[:60]}...")
    print(f"  DB_NAME   : {DB_NAME}")
    print(f"  TEST_NAME : {TEST_NAME}")
    print(f"  TEST_EMAIL: {TEST_EMAIL}")
    print("=" * 70)


async def create_test_member() -> dict:
    """Crée le membre test expiré. Retourne le doc inséré (sans _id)."""
    now = datetime.now(timezone.utc)
    past_end_date = (now - timedelta(days=14)).date().isoformat()
    member_id = str(uuid.uuid4())
    doc = {
        "id": member_id,
        "name": TEST_NAME,
        "email": TEST_EMAIL,
        "phone": "+41000000000",
        "membership": "HYBRID GYM",
        "member_type": "Membres Généraux Récurrents",
        "club_id": VERSOIX_CLUB_ID,
        "contract_signed_date": (now - timedelta(days=400)).date().isoformat(),
        "subscription_end_date": past_end_date,  # 14j dans le passé → is_expired=true
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
    doc.pop("_id", None)
    return doc


async def cleanup_by_name() -> int:
    """Supprime TOUS les docs dont name commence par '_TEMP_TEST_'. Idempotent."""
    res = await db.customer_members.delete_many({"name": {"$regex": "^_TEMP_TEST_"}})
    return res.deleted_count


async def send_one(member_id: str, member_name: str) -> dict:
    """Envoie 1 mail réel via send_renewal_reminder + update counters comme l'endpoint."""
    from core.club_branding import get_club_public_name
    club_name = await get_club_public_name(db, VERSOIX_CLUB_ID)
    print(f"  · club_name (public) = {club_name!r}")

    result = await send_renewal_reminder(
        to_email=TEST_EMAIL,
        member_name=member_name,
        member_id=member_id,
        club_name=club_name,
    )
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.customer_members.update_one(
        {"id": member_id},
        {
            "$set": {"last_renewal_reminder_at": now_iso, "updated_at": now_iso},
            "$inc": {"renewal_reminder_count": 1},
        },
    )
    return result


async def main():
    parser = argparse.ArgumentParser(description="E2E test renewal reminder")
    parser.add_argument("--cleanup", action="store_true", help="Delete all _TEMP_TEST_* docs")
    args = parser.parse_args()

    _confirm_target()

    if args.cleanup:
        deleted = await cleanup_by_name()
        print(f"\n[CLEANUP] {deleted} doc(s) _TEMP_TEST_* supprimé(s).")
        return

    # SAFETY : cleanup any leftover before creating
    pre = await cleanup_by_name()
    if pre:
        print(f"\n[PRE-CLEANUP] {pre} doc(s) _TEMP_TEST_* leftover purgé(s).")

    print("\n[1] Création membre test...")
    member = await create_test_member()
    print(f"  · id          = {member['id']}")
    print(f"  · name        = {member['name']}")
    print(f"  · email       = {member['email']}")
    print(f"  · sub_end_date= {member['subscription_end_date']}  (14j dans le passé)")
    print(f"  · marketing_opt_out = {member['marketing_opt_out']}")

    try:
        print("\n[2] Envoi 1 email réel via send_renewal_reminder...")
        result = await send_one(member["id"], member["name"])
        print(f"  · sent  = {result.get('sent')}")
        print(f"  · resend_id = {result.get('resend_id')}")
        print(f"  · subject   = {result.get('subject')!r}")

        print("\n[3] Vérification post-envoi (DB) :")
        updated = await db.customer_members.find_one({"id": member["id"]}, {"_id": 0})
        print(f"  · last_renewal_reminder_at = {updated.get('last_renewal_reminder_at')}")
        print(f"  · renewal_reminder_count   = {updated.get('renewal_reminder_count')}")
        print(f"  · marketing_opt_out        = {updated.get('marketing_opt_out')}")
        print(f"  · MEMBER_ID_FOR_CLEANUP    = {member['id']}")

        print("\n" + "=" * 70)
        print(" TEST ENVOYÉ — ANTOINE VALIDE EN BOÎTE MAIL")
        print("=" * 70)
        print(f"\n  Email destination : {TEST_EMAIL}")
        print(f"  Sujet attendu     : '_TEMP_TEST_, on ne t'a pas vu cette semaine 👀'")
        print(f"  Header attendu    : 'HYBRID GYM GENEVA · TON COACH'")
        print(f"  Signature attendue: 'L'ÉQUIPE HYBRID GYM GENEVA'")
        print(f"\n  Pour cleanup après validation :")
        print(f"    python scripts/e2e_test_renewal.py --cleanup")
        print("=" * 70)

    except Exception as e:
        # Cleanup auto en cas d'erreur
        print(f"\n[ERREUR] {e}")
        print("[AUTO-CLEANUP] Suppression du membre test...")
        await db.customer_members.delete_one({"id": member["id"]})
        raise


if __name__ == "__main__":
    asyncio.run(main())
