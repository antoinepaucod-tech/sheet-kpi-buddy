import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from collections import Counter

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["kpibuddy"]
    members = await db.customer_members.find({}, {"_id": 0}).to_list(5000)
    
    current = [m for m in members if not m.get("exit_date") or m["exit_date"] in [None, "", "None"]]
    
    # Check for duplicates by name
    names = Counter(m.get("name", "") for m in current)
    dupes = {n: c for n, c in names.items() if c > 1}
    print(f"Noms en double: {len(dupes)} groupes")
    
    for name in sorted(dupes.keys()):
        print(f"\n  === {name} (x{dupes[name]}) ===")
        for m in current:
            if m.get("name") == name:
                print(f"    id={m.get('id','')[:12]} | membership={m.get('membership')} | persons_count={m.get('persons_count')} | is_primary={m.get('is_primary_subscriber')} | is_duo={m.get('is_duo')} | group={str(m.get('subscription_group_id',''))[:12]} | end={m.get('subscription_end_date','N/A')}")
    
    # Count unique persons: for DUO, only count primary with persons_count
    # For duplicates with same name and same group, count only once
    seen_ids = set()
    unique_persons = 0
    for m in current:
        mid = m.get("id", "")
        if mid in seen_ids:
            continue
        seen_ids.add(mid)
        unique_persons += 1
    
    print(f"\nTotal current records: {len(current)}")
    print(f"Unique by ID: {unique_persons}")
    
    # Check which records might be duplicates (same person, different records)
    from collections import defaultdict
    groups = defaultdict(list)
    for m in current:
        gid = m.get("subscription_group_id", "")
        if gid:
            groups[gid].append(m)
    
    print(f"\nGroups with >1 member:")
    for gid, group_members in sorted(groups.items()):
        if len(group_members) > 1:
            print(f"  Group {gid[:12]}:")
            for m in group_members:
                print(f"    {m['name']} | {m['membership']} | primary={m.get('is_primary_subscriber')} | pc={m.get('persons_count')}")
    
    client.close()

asyncio.run(check())
