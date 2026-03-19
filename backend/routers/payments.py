"""Payment routes"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta
from calendar import monthrange

from core.config import db, MONTHS_FR
from models.payments import (
    PaymentSchedule, PaymentScheduleCreate,
    Payment, PaymentCreate, PaymentUpdate
)

router = APIRouter(tags=["payments"])


# Payment Schedule Routes
@router.get("/payment-schedules")
async def get_payment_schedules(member_id: Optional[str] = None, active_only: Optional[bool] = None):
    query = {}
    if member_id:
        query["member_id"] = member_id
    if active_only:
        query["is_active"] = True
    schedules = await db.payment_schedules.find(query, {"_id": 0}).to_list(1000)
    # Enrich with member names if missing
    for s in schedules:
        if not s.get("member_name"):
            member = await db.customer_members.find_one({"id": s.get("member_id")}, {"_id": 0, "name": 1})
            s["member_name"] = member.get("name", "Inconnu") if member else "Inconnu"
    return schedules


@router.post("/payment-schedules")
async def create_payment_schedule(data: PaymentScheduleCreate):
    schedule = PaymentSchedule(**data.model_dump())
    doc = schedule.model_dump()
    await db.payment_schedules.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/payment-schedules/{schedule_id}")
async def update_payment_schedule(schedule_id: str, body: dict):
    existing = await db.payment_schedules.find_one({"id": schedule_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Planning de paiement introuvable")
    
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.payment_schedules.update_one({"id": schedule_id}, {"$set": body})
    return await db.payment_schedules.find_one({"id": schedule_id}, {"_id": 0})


@router.delete("/payment-schedules/{schedule_id}")
async def delete_payment_schedule(schedule_id: str):
    result = await db.payment_schedules.delete_one({"id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Planning de paiement introuvable")
    return {"message": "Planning de paiement supprimé"}


@router.post("/payments/sync-with-members")
async def sync_payments_with_members():
    """Full sync: regenerate payment_schedules and payments from billing_enabled members."""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    current_year = now.year
    current_month = now.month
    days_in_month = monthrange(current_year, current_month)[1]
    month_str = f"{current_year}-{current_month:02d}"

    # 1. Get all billing_enabled active members (including coaches)
    all_members = await db.customer_members.find(
        {"billing_enabled": True},
        {"_id": 0}
    ).to_list(5000)

    active_billing = []
    for m in all_members:
        exit_d = m.get("exit_date")
        if exit_d and exit_d not in (None, "", "None") and exit_d < today_str:
            continue
        active_billing.append(m)

    # 2. Sync payment_schedules: clear and recreate (ALL billing members, including amount=0)
    await db.payment_schedules.delete_many({})
    schedules_created = 0
    for m in active_billing:
        cycle_value = m.get("billing_cycle_value") or m.get("billing_day") or 1
        schedule = {
            "id": m["id"],
            "member_id": m["id"],
            "member_name": m.get("name", ""),
            "amount": m.get("billing_amount", 0) or 0,
            "frequency": "monthly",
            "billing_day": cycle_value,
            "payment_method": m.get("billing_payment_method", "prelevement"),
            "is_active": True,
            "start_date": m.get("contract_signed_date", today_str),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        await db.payment_schedules.insert_one(schedule)
        schedules_created += 1

    # 3. Sync payments for current month (including 0 CHF for offerts)
    await db.payments.delete_many({"status": {"$in": ["pending", "late"]}})
    payments_created = 0
    import uuid
    for m in active_billing:
        amt = m.get("billing_amount", 0) or 0
        cycle_value = m.get("billing_cycle_value") or m.get("billing_day") or 1
        day = min(int(cycle_value), days_in_month)
        due_date = f"{month_str}-{day:02d}"

        # For 0 CHF (offerts): auto-mark as paid
        if amt <= 0:
            payment = {
                "id": str(uuid.uuid4()),
                "member_id": m["id"],
                "schedule_id": m["id"],
                "member_name": m.get("name", ""),
                "amount": 0,
                "due_date": due_date,
                "status": "paid",
                "paid_date": due_date,
                "payment_method": m.get("billing_payment_method", "offert"),
                "notes": "Abonnement offert - 0 CHF",
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
        else:
            payment = {
                "id": str(uuid.uuid4()),
                "member_id": m["id"],
                "schedule_id": m["id"],
                "member_name": m.get("name", ""),
                "amount": amt,
                "due_date": due_date,
                "status": "late" if due_date < today_str else "pending",
                "payment_method": m.get("billing_payment_method", "prelevement"),
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
        await db.payments.insert_one(payment)
        payments_created += 1

    return {
        "message": "Synchronisation terminée",
        "schedules_created": schedules_created,
        "payments_created": payments_created,
        "month": month_str,
    }


# Payment Routes
@router.get("/payments")
async def get_payments(
    member_id: Optional[str] = None,
    status: Optional[str] = None,
    due_from: Optional[str] = None,
    due_to: Optional[str] = None
):
    query = {}
    if member_id:
        query["member_id"] = member_id
    if status:
        query["status"] = status
    if due_from or due_to:
        query["due_date"] = {}
        if due_from:
            query["due_date"]["$gte"] = due_from
        if due_to:
            query["due_date"]["$lte"] = due_to
    
    docs = await db.payments.find(query, {"_id": 0}).sort("due_date", -1).to_list(1000)
    
    # Enrich with member names
    for doc in docs:
        member = await db.customer_members.find_one({"id": doc.get("member_id")}, {"_id": 0, "name": 1})
        doc["member_name"] = member.get("name", "Inconnu") if member else "Inconnu"
    
    return docs


@router.get("/payments/late")
async def get_late_payments():
    """Get all late payments (past due and not paid)"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    docs = await db.payments.find({
        "due_date": {"$lt": today},
        "status": {"$in": ["pending", "late"]}
    }, {"_id": 0}).sort("due_date", 1).to_list(500)
    
    for doc in docs:
        if doc["status"] == "pending":
            await db.payments.update_one(
                {"id": doc["id"]},
                {"$set": {"status": "late", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            doc["status"] = "late"
    
    for doc in docs:
        member = await db.customer_members.find_one({"id": doc["member_id"]}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        doc["member_name"] = member.get("name", "Inconnu") if member else "Inconnu"
        doc["member_email"] = member.get("email", "") if member else ""
        doc["member_phone"] = member.get("phone", "") if member else ""
    
    return docs


@router.get("/payments/upcoming")
async def get_upcoming_payments(days: int = 7):
    """Get payments due in the next N days"""
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days)
    
    docs = await db.payments.find({
        "due_date": {"$gte": today.isoformat(), "$lte": end_date.isoformat()},
        "status": "pending"
    }, {"_id": 0}).sort("due_date", 1).to_list(500)
    
    for doc in docs:
        member = await db.customer_members.find_one({"id": doc["member_id"]}, {"_id": 0, "name": 1, "email": 1})
        if member:
            doc["member_name"] = member.get("name", "")
            doc["member_email"] = member.get("email", "")
    
    return docs


@router.post("/payments")
async def create_payment(data: PaymentCreate):
    payment = Payment(**data.model_dump())
    doc = payment.model_dump()
    await db.payments.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/payments/{payment_id}")
async def update_payment(payment_id: str, data: PaymentUpdate):
    existing = await db.payments.find_one({"id": payment_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.payments.update_one({"id": payment_id}, {"$set": update})
    return await db.payments.find_one({"id": payment_id}, {"_id": 0})


@router.post("/payments/{payment_id}/mark-paid")
async def mark_payment_paid(payment_id: str, body: dict = {}):
    """Quick action to mark a payment as paid and create a revenue transaction."""
    existing = await db.payments.find_one({"id": payment_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    
    paid_date = body.get("paid_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    
    update = {
        "status": "paid",
        "paid_date": paid_date,
        "payment_method": body.get("payment_method", existing.get("payment_method")),
        "reference": body.get("reference", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.update_one({"id": payment_id}, {"$set": update})
    
    # Create corresponding accounting transaction (revenue)
    member = await db.customer_members.find_one(
        {"id": existing["member_id"]},
        {"_id": 0, "name": 1, "membership": 1}
    )
    member_name = member.get("name", "Inconnu") if member else "Inconnu"
    membership = (member.get("membership", "") or "") if member else ""
    
    # Determine category based on membership
    coach_kw = ["THE COACH", "VIRTUAL COACH"]
    is_coach = any(kw in membership.upper() for kw in coach_kw)
    category = "THE COACH PASS MENSUEL" if is_coach else "ABONNEMENTS"
    
    import uuid
    tx = {
        "id": str(uuid.uuid4()),
        "date": paid_date,
        "type": "revenue",
        "amount": existing.get("amount", 0),
        "category": category,
        "description": f"Paiement validé - {member_name}",
        "client_name": member_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "payment_validation",
        "payment_id": payment_id,
    }
    await db.accounting_transactions.insert_one(tx)
    
    # Recalculate KPI for the month
    month_str = paid_date[:7]
    from routers.kpis import recalculate_month
    await recalculate_month(month_str)
    
    result = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    result["transaction_created"] = True
    return result


@router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str):
    result = await db.payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    return {"message": "Paiement supprimé"}


@router.post("/payments/generate/{year}/{month}")
async def generate_monthly_payments(year: int, month: int):
    """Generate payments for a month based on active billing-enabled members"""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mois invalide (1-12)")
    
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_str = f"{year}-{month:02d}"
    days_in_month = monthrange(year, month)[1]
    
    # Get billing-enabled members (active, including coaches and offerts, non-departed)
    all_members = await db.customer_members.find(
        {"billing_enabled": True},
        {"_id": 0}
    ).to_list(5000)
    
    members = []
    for m in all_members:
        exit_d = m.get("exit_date")
        if exit_d and exit_d not in (None, "", "None") and exit_d < today_str:
            continue
        members.append(m)
    
    if not members:
        return {"message": "Aucun membre avec facturation active", "created": 0}
    
    created = []
    
    for member in members:
        # Check if payment already exists for this member this month
        existing = await db.payments.find_one({
            "member_id": member["id"],
            "due_date": {"$regex": f"^{month_str}"}
        })
        if existing:
            continue
        
        # Calculate due date from billing cycle
        cycle_type = member.get("billing_cycle_type", "monthly_day")
        cycle_value = member.get("billing_cycle_value", 1)
        
        if cycle_type == "monthly_day":
            day = min(cycle_value or 1, days_in_month)
            due_date = f"{month_str}-{day:02d}"
        else:
            due_date = f"{month_str}-01"
        
        amt = member.get("billing_amount", 0) or 0
        
        # For offerts (0 CHF): auto-mark as paid
        if amt <= 0:
            import uuid
            doc = {
                "id": str(uuid.uuid4()),
                "member_id": member["id"],
                "schedule_id": member["id"],
                "member_name": member.get("name", ""),
                "amount": 0,
                "due_date": due_date,
                "status": "paid",
                "paid_date": due_date,
                "payment_method": member.get("billing_payment_method", "offert"),
                "notes": "Abonnement offert - 0 CHF",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            payment = Payment(
                member_id=member["id"],
                schedule_id=member["id"],
                amount=amt,
                due_date=due_date,
                status="pending",
                payment_method=member.get("billing_payment_method", "prelevement")
            )
            doc = payment.model_dump()
            doc["member_name"] = member["name"]
        
        await db.payments.insert_one(doc)
        doc.pop('_id', None)
        created.append(doc)
    
    return {
        "month": month_str,
        "month_name": MONTHS_FR[month - 1],
        "created": len(created),
        "payments": created
    }
