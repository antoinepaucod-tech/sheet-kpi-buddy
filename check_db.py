import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def check():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client['kpibuddy']
    
    for c in ['customer_members', 'accounting_transactions', 'class_attendances', 'payment_schedules', 'monthly_kpis', 'accounting_categories', 'courses']:
        count = await db[c].count_documents({})
        print(f'{c}: {count} docs')
    
    att = await db.class_attendances.find_one({}, {'_id': 0})
    print(f'\nSample class_attendance: {att}')
    
    ps = await db.payment_schedules.find_one({}, {'_id': 0})
    print(f'Sample payment_schedule: {ps}')
    
    # Check members with exit_date
    all_members = await db.customer_members.find({}, {'_id': 0, 'exit_date': 1, 'name': 1}).to_list(5000)
    with_exit = [m for m in all_members if m.get('exit_date') and m['exit_date'] not in [None, '', 'None']]
    print(f'\nMembers with exit_date: {len(with_exit)}')
    for m in with_exit[:5]:
        print(f'  {m["name"]}: exit_date={m["exit_date"]}')
    
    kpi = await db.monthly_kpis.find_one({}, {'_id': 0})
    if kpi:
        print(f'\nSample KPI keys: {sorted(kpi.keys())}')
        for k in ['pt_members', 'active_members', 'total_members', 'total_active_members', 'month']:
            print(f'  {k}: {kpi.get(k)}')
    
    # Check course count in the courses collection
    course = await db.courses.find_one({}, {'_id': 0})
    print(f'\nSample course: {course}')
    
    client.close()

asyncio.run(check())
