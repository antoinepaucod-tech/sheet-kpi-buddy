import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

COACH_KW = ["THE COACH", "VIRTUAL COACH"]

def is_coach(membership):
    return any(kw in (membership or "").upper() for kw in COACH_KW)

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["kpibuddy"]
    members = await db.customer_members.find({}, {"_id": 0}).to_list(5000)
    
    today = "2026-03-16"
    
    # Step 1: Separate departed (exit_date set) vs current
    departed = [m for m in members if m.get("exit_date") and m["exit_date"] not in [None, "", "None"]]
    current = [m for m in members if not m.get("exit_date") or m["exit_date"] in [None, "", "None"]]
    
    print(f"=== TOTAL: {len(members)} ===")
    print(f"Partis (exit_date): {len(departed)}")
    print(f"Courants (pas de exit_date): {len(current)}")
    
    # Step 2: Among current, separate coaches vs non-coaches
    current_coaches = [m for m in current if is_coach(m.get("membership", ""))]
    current_non_coaches = [m for m in current if not is_coach(m.get("membership", ""))]
    
    print(f"\n=== COURANTS: {len(current)} ===")
    print(f"Coachs: {len(current_coaches)}")
    print(f"Non-coachs: {len(current_non_coaches)}")
    
    # Step 3: Among current non-coaches, check expiration
    active = []
    expired = []
    no_end_date = []
    
    for m in current_non_coaches:
        end = m.get("subscription_end_date")
        if not end or end in [None, "", "None"]:
            no_end_date.append(m)
            active.append(m)  # No end date = still active
        elif end >= today:
            active.append(m)
        else:
            expired.append(m)
    
    print(f"\n=== NON-COACHS COURANTS: {len(current_non_coaches)} ===")
    print(f"Actifs (end >= today ou pas de date fin): {len(active)}")
    print(f"  - Sans date de fin: {len(no_end_date)}")
    print(f"  - Avec date fin >= {today}: {len(active) - len(no_end_date)}")
    print(f"Expirés (end < today): {len(expired)}")
    
    # Step 4: Show expired details
    print(f"\n=== EXPIRÉS (end < {today}) ===")
    for m in sorted(expired, key=lambda x: x.get("subscription_end_date", "")):
        print(f"  {m['name']} | {m['membership']} | end={m.get('subscription_end_date')} | type={m.get('member_type')}")
    
    # Step 5: Show ALL current non-coach members with their end dates
    print(f"\n=== TOUS LES {len(current_non_coaches)} MEMBRES NON-COACH COURANTS ===")
    for m in sorted(current_non_coaches, key=lambda x: (x.get("subscription_end_date") or "9999", x.get("name", ""))):
        end = m.get("subscription_end_date", "")
        status = "EXPIRÉ" if end and end < today else "ACTIF"
        duo = " [DUO]" if m.get("is_duo") else ""
        print(f"  {status} | {m['name']}{duo} | {m['membership']} | end={end or 'N/A'}")
    
    # Step 6: Coach details
    print(f"\n=== COACHS COURANTS: {len(current_coaches)} ===")
    active_coaches = []
    expired_coaches = []
    for m in current_coaches:
        end = m.get("subscription_end_date")
        if not end or end in [None, "", "None"] or end >= today:
            active_coaches.append(m)
        else:
            expired_coaches.append(m)
    
    print(f"Coachs actifs: {len(active_coaches)}")
    print(f"Coachs expirés: {len(expired_coaches)}")
    for m in expired_coaches:
        print(f"  EXPIRÉ: {m['name']} | {m['membership']} | end={m.get('subscription_end_date')}")
    
    # Final summary
    total_active_persons = len(active) + len(active_coaches)
    print(f"\n=== RÉSUMÉ ===")
    print(f"Membres actifs (non-coach): {len(active)}")
    print(f"Coachs actifs: {len(active_coaches)}")
    print(f"Total personnes actives: {total_active_persons}")
    print(f"Expirés (membres): {len(expired)}")
    print(f"Expirés (coachs): {len(expired_coaches)}")
    print(f"Partis: {len(departed)}")
    print(f"GRAND TOTAL: {total_active_persons + len(expired) + len(expired_coaches) + len(departed)}")
    
    client.close()

asyncio.run(check())
