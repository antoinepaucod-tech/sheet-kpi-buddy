"""
Migration Script: Single-tenant -> Multi-tenant (Multi-Club)
RULE: All existing data belongs to "Transform Versoix"
This script:
1. Creates 4 clubs in a 'clubs' collection
2. Assigns club_id to ALL documents in ALL business collections
3. Updates users with roles and club_ids
"""
import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Define the 4 clubs
CLUBS = [
    {"id": str(uuid.uuid4()), "name": "Transform Versoix", "slug": "transform-versoix", "is_active": True},
    {"id": str(uuid.uuid4()), "name": "Transform Grand Saconnex", "slug": "transform-grand-saconnex", "is_active": True},
    {"id": str(uuid.uuid4()), "name": "Transform Servette", "slug": "transform-servette", "is_active": True},
    {"id": str(uuid.uuid4()), "name": "Transform Lausanne", "slug": "transform-lausanne", "is_active": True},
]

# All business collections that need club_id
BUSINESS_COLLECTIONS = [
    "customer_members",
    "accounting_transactions",
    "accounting_categories",
    "monthly_kpis",
    "payment_schedules",
    "payments",
    "annual_reviews",
    "activity_logs",
    "coaches",
    "instructors",
    "course_kpis",
    "course_types",
    "weekly_trainings",
    "six_weeks_challenges",
    "challenge_participants",
    "member_followups",
    "member_renewals",
    "membership_types",
    "member_types",
    "recurring_transactions",
    "recurring_validations",
    "excluded_recurring_expenses",
    "ghl_sales",
    "ghl_syncs",
    "club_settings",
]


async def migrate():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("=" * 60)
    print("TRANSFORM - Migration Multi-Club")
    print("=" * 60)

    # Step 1: Create clubs collection
    print("\n[1/4] Creating clubs...")
    existing_clubs = await db.clubs.count_documents({})
    if existing_clubs > 0:
        print(f"  -> {existing_clubs} clubs already exist, skipping creation.")
        clubs = await db.clubs.find({}, {"_id": 0}).to_list(10)
        versoix_club = next((c for c in clubs if "versoix" in c["slug"].lower()), clubs[0])
    else:
        from datetime import datetime, timezone
        for club in CLUBS:
            club["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.clubs.insert_one(club)
            print(f"  -> Created: {club['name']} ({club['id']})")
        versoix_club = CLUBS[0]

    versoix_id = versoix_club["id"]
    print(f"\n  Versoix club_id: {versoix_id}")

    # Step 2: Assign club_id to ALL business collections
    print("\n[2/4] Assigning club_id to all business collections...")
    total_updated = 0
    for col_name in BUSINESS_COLLECTIONS:
        col = db[col_name]
        # Only update documents that don't already have a club_id
        count = await col.count_documents({"club_id": {"$exists": False}})
        if count > 0:
            result = await col.update_many(
                {"club_id": {"$exists": False}},
                {"$set": {"club_id": versoix_id}}
            )
            print(f"  -> {col_name}: {result.modified_count} docs updated")
            total_updated += result.modified_count
        else:
            existing = await col.count_documents({})
            if existing > 0:
                print(f"  -> {col_name}: {existing} docs already have club_id")
            else:
                print(f"  -> {col_name}: empty collection")

    print(f"\n  Total documents updated: {total_updated}")

    # Step 3: Update users
    print("\n[3/4] Updating users...")
    all_club_ids = [c["id"] for c in (CLUBS if existing_clubs == 0 else await db.clubs.find({}, {"_id": 0}).to_list(10))]

    # Antoine = Super Admin with access to ALL clubs
    antoine = await db.users.find_one({"email": "antoine.paucod@the-coach.pro"})
    if antoine:
        await db.users.update_one(
            {"email": "antoine.paucod@the-coach.pro"},
            {"$set": {
                "role": "super_admin",
                "club_ids": all_club_ids,
                "active_club_id": versoix_id,
                "club_name": "Transform Versoix",
            }}
        )
        print(f"  -> antoine.paucod@the-coach.pro -> super_admin (all {len(all_club_ids)} clubs)")
    else:
        print("  -> WARNING: antoine.paucod@the-coach.pro not found!")

    # test@crossfit.ch -> Manager of Transform Versoix
    test_user = await db.users.find_one({"email": "test@crossfit.ch"})
    if test_user:
        await db.users.update_one(
            {"email": "test@crossfit.ch"},
            {"$set": {
                "role": "manager",
                "club_ids": [versoix_id],
                "active_club_id": versoix_id,
                "club_name": "Transform Versoix",
            }}
        )
        print(f"  -> test@crossfit.ch -> manager (Transform Versoix only)")

    # Step 4: Create indexes for club_id
    print("\n[4/4] Creating indexes...")
    for col_name in BUSINESS_COLLECTIONS:
        col = db[col_name]
        await col.create_index("club_id")
        print(f"  -> {col_name}: club_id index created")

    # Verification
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)

    for col_name in BUSINESS_COLLECTIONS:
        col = db[col_name]
        total = await col.count_documents({})
        with_club = await col.count_documents({"club_id": {"$exists": True}})
        without_club = await col.count_documents({"club_id": {"$exists": False}})
        status = "OK" if without_club == 0 else "ISSUE"
        print(f"  [{status}] {col_name}: {total} total, {with_club} with club_id, {without_club} without")

    # Verify users
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(10)
    for u in users:
        print(f"  User: {u['email']} | role={u.get('role')} | clubs={len(u.get('club_ids', []))} | active={u.get('active_club_id', 'N/A')}")

    clubs = await db.clubs.find({}, {"_id": 0}).to_list(10)
    print(f"\n  Total clubs: {len(clubs)}")
    for c in clubs:
        print(f"    - {c['name']} ({c['id']})")

    print("\n Migration completed successfully!")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
