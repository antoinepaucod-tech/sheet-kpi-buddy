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
    return await db.payment_schedules.find(query, {"_id": 0}).to_list(1000)


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
    """Quick action to mark a payment as paid"""
    existing = await db.payments.find_one({"id": payment_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    
    update = {
        "status": "paid",
        "paid_date": body.get("paid_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "payment_method": body.get("payment_method", existing.get("payment_method")),
        "reference": body.get("reference", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.update_one({"id": payment_id}, {"$set": update})
    return await db.payments.find_one({"id": payment_id}, {"_id": 0})


@router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str):
    result = await db.payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    return {"message": "Paiement supprimé"}


@router.post("/payments/generate/{year}/{month}")
async def generate_monthly_payments(year: int, month: int):
    """Generate payments for a month based on payment schedules"""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mois invalide (1-12)")
    
    schedules = await db.payment_schedules.find({"is_active": True}, {"_id": 0}).to_list(1000)
    if not schedules:
        return {"message": "Aucun planning de paiement actif", "created": 0}
    
    month_str = f"{year}-{month:02d}"
    days_in_month = monthrange(year, month)[1]
    created = []
    
    for sched in schedules:
        existing = await db.payments.find_one({
            "schedule_id": sched["id"],
            "due_date": {"$regex": f"^{month_str}"}
        })
        if existing:
            continue
        
        if sched["recurrence_type"] == "monthly_day":
            day = min(sched["recurrence_value"], days_in_month)
            due_date = f"{month_str}-{day:02d}"
        else:
            start = datetime.fromisoformat(sched["start_date"]).date()
            interval = sched["recurrence_value"]
            
            current = start
            while current.month != month or current.year != year:
                current = current + timedelta(days=interval)
                if current.year > year or (current.year == year and current.month > month):
                    current = None
                    break
            
            if current is None:
                continue
            due_date = current.isoformat()
        
        payment = Payment(
            member_id=sched["member_id"],
            schedule_id=sched["id"],
            amount=sched["amount"],
            due_date=due_date,
            status="pending",
            payment_method=sched.get("payment_method")
        )
        doc = payment.model_dump()
        await db.payments.insert_one(doc)
        doc.pop('_id', None)
        created.append(doc)
    
    return {
        "month": month_str,
        "month_name": MONTHS_FR[month - 1],
        "created": len(created),
        "payments": created
    }
