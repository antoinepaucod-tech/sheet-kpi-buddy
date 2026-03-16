import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["kpibuddy"]
    
    members = await db.customer_members.find({}, {"_id": 0}).to_list(5000)
    
    # Check duo members
    duo_members = [m for m in members if m.get("is_duo")]
    duo_primary = [m for m in members if m.get("duo_primary")]
    duo_partner_id = [m for m in members if m.get("duo_partner_id")]
    
    print(f"Total members: {len(members)}")
    print(f"Members with is_duo=True: {len(duo_members)}")
    print(f"Members with duo_primary=True: {len(duo_primary)}")
    print(f"Members with duo_partner_id set: {len(duo_partner_id)}")
    
    # Check DUO memberships
    duo_memberships = [m for m in members if "DUO" in (m.get("membership") or "").upper()]
    print(f"\nMembers with 'DUO' in membership name: {len(duo_memberships)}")
    
    # Breakdown by membership type
    from collections import Counter
    duo_types = Counter(m.get("membership") for m in duo_memberships)
    for t, c in duo_types.most_common():
        print(f"  {t}: {c}")
    
    # Check if duo members have exit_date
    today = "2026-02-17"
    duo_no_exit = [m for m in duo_memberships if not m.get("exit_date") or m["exit_date"] in [None, "", "None"]]
    duo_active = [m for m in duo_no_exit if not m.get("subscription_end_date") or m["subscription_end_date"] >= today]
    duo_departed = [m for m in duo_memberships if m.get("exit_date") and m["exit_date"] not in [None, "", "None"]]
    
    print(f"\nDUO members still current (no exit_date): {len(duo_no_exit)}")
    print(f"DUO members active (not expired): {len(duo_active)}")
    print(f"DUO members departed: {len(duo_departed)}")
    
    # Show some duo member details
    print("\nSample DUO active members:")
    for m in duo_active[:10]:
        print(f"  {m['name']} | {m['membership']} | is_duo={m.get('is_duo')} | duo_primary={m.get('duo_primary')} | duo_partner_id={m.get('duo_partner_id', 'None')[:8] if m.get('duo_partner_id') else 'None'}... | end={m.get('subscription_end_date')}")
    
    # Check: are duo partner records already in the DB as separate members?
    # Some duo memberships might represent 2 people with just 1 record
    duo_with_partner = [m for m in duo_active if m.get("duo_partner_id")]
    duo_without_partner = [m for m in duo_active if not m.get("duo_partner_id")]
    print(f"\nDUO active with partner_id linked: {len(duo_with_partner)}")
    print(f"DUO active without partner_id (single record for 2 people): {len(duo_without_partner)}")
    
    # Check how many of these have '&' in name (common for duo)
    duo_ampersand = [m for m in duo_memberships if "&" in (m.get("name") or "")]
    print(f"\nDUO members with '&' in name: {len(duo_ampersand)}")
    for m in duo_ampersand[:10]:
        print(f"  {m['name']} | {m['membership']} | exit={m.get('exit_date', 'None')}")
    
    client.close()

asyncio.run(check())
