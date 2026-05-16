"""Helper pour le test visuel RenewalReminderBadge sur Manon Frick.

Usage:
    python scripts/test_renewal_badge_manon.py set-today
    python scripts/test_renewal_badge_manon.py set-j3
    python scripts/test_renewal_badge_manon.py set-j10
    python scripts/test_renewal_badge_manon.py unset
    python scripts/test_renewal_badge_manon.py verify
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.config import db  # noqa: E402

MANON_ID = "3b780862-4bc7-4d0c-a3c6-d5609b00eb72"


async def set_at(days_ago: int, count: int = 1):
    now = datetime.now(timezone.utc)
    target = now - timedelta(days=days_ago)
    iso = target.replace(hour=10, minute=0, second=0, microsecond=0).isoformat()
    res = await db.customer_members.update_one(
        {"id": MANON_ID},
        {"$set": {"last_renewal_reminder_at": iso, "renewal_reminder_count": count}},
    )
    print(f"SET last_renewal_reminder_at={iso} count={count} (matched={res.matched_count}, modified={res.modified_count})")


async def unset_all():
    res = await db.customer_members.update_one(
        {"id": MANON_ID},
        {"$unset": {"last_renewal_reminder_at": "", "renewal_reminder_count": ""}},
    )
    print(f"UNSET (matched={res.matched_count}, modified={res.modified_count})")


async def verify():
    doc = await db.customer_members.find_one(
        {"id": MANON_ID},
        {"_id": 0, "id": 1, "name": 1, "last_renewal_reminder_at": 1, "renewal_reminder_count": 1, "marketing_opt_out": 1},
    )
    print(f"DB state for {doc.get('name')}:")
    print(f"  · last_renewal_reminder_at = {doc.get('last_renewal_reminder_at', '<<ABSENT>>')!r}")
    print(f"  · renewal_reminder_count   = {doc.get('renewal_reminder_count', '<<ABSENT>>')!r}")
    print(f"  · marketing_opt_out        = {doc.get('marketing_opt_out', '<<ABSENT>>')!r}")
    # Strict check : the 2 fields should be ABSENT post-unset (clean state)
    has_last = "last_renewal_reminder_at" in doc
    has_count = "renewal_reminder_count" in doc
    print(f"  → fields present: last={has_last}, count={has_count}")


async def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "verify"
    if cmd == "set-today":
        await set_at(0, count=1)
    elif cmd == "set-j3":
        await set_at(3, count=1)
    elif cmd == "set-j10":
        await set_at(10, count=2)
    elif cmd == "unset":
        await unset_all()
    elif cmd == "verify":
        await verify()
    else:
        print(f"Unknown cmd: {cmd}")
        sys.exit(1)
    print()
    await verify()


if __name__ == "__main__":
    asyncio.run(main())
