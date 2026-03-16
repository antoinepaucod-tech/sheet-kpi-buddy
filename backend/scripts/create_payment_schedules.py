"""Generate payment schedules for all recurring members who don't have one."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import os

COACH_KEYWORDS = ["THE COACH", "VIRTUAL COACH"]

RECURRING_MEMBERSHIPS = [
    "HUBFIT", "HYBRID FULL - PAIEMENT MENSUEL", "HYBRID FULL DUO - PAIEMENT MENSUEL",
    "HYBRID FULL DUO SANS ENGAGEMENT - PAIEMENT MENSUEL",
    "HYBRID FULL SANS ENGAGEMENT - PAIEMENT MENSUEL",
    "HYBRID FULL STUDENT - PAIEMENT MENSUEL", "IFRC",
    "OPEN GYM - PAIEMENT MENSUEL", "THE COACH PASS MENSUEL",
    "UNLIMITED ACCESS - PAIEMENT MENSUEL", "UNLIMITED ACCESS DUO - PAIEMENT MENSUEL",
    "UNLIMITED ACCESS SANS EMGAGEMENT - PAIEMENT MENSUEL", "VIRTUAL COACH",
]


async def generate_schedules():
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client["kpibuddy"]

    members = await db.customer_members.find({}, {"_id": 0}).to_list(5000)
    existing_schedules = await db.payment_schedules.find({}, {"_id": 0, "member_id": 1}).to_list(5000)
    existing_member_ids = {s["member_id"] for s in existing_schedules}

    # Get membership_types for pricing
    membership_types = await db.membership_types.find({}, {"_id": 0}).to_list(100)
    price_map = {mt["name"]: mt.get("price", 0) for mt in membership_types}

    created = 0
    for m in members:
        if m["id"] in existing_member_ids:
            continue
        membership = m.get("membership", "")
        if membership not in RECURRING_MEMBERSHIPS:
            continue
        # Skip departed members
        if m.get("exit_date") and m["exit_date"] not in [None, "", "None"]:
            continue

        amount = price_map.get(membership, m.get("billing_amount", 0))
        if amount <= 0:
            amount = 100  # Default fallback

        schedule = {
            "id": str(uuid.uuid4()),
            "member_id": m["id"],
            "member_name": m.get("name", ""),
            "membership": membership,
            "amount": amount,
            "billing_cycle_type": m.get("billing_cycle_type", "monthly_day"),
            "billing_cycle_value": m.get("billing_cycle_value", 1),
            "billing_payment_method": m.get("billing_payment_method", "prelevement"),
            "start_date": m.get("contract_signed_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "end_date": m.get("subscription_end_date"),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.payment_schedules.insert_one(schedule)
        created += 1

    total = await db.payment_schedules.count_documents({})
    print(f"Created {created} new payment schedules. Total now: {total}")
    client.close()


if __name__ == "__main__":
    asyncio.run(generate_schedules())
