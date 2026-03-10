"""Members routes"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta

from core.config import db
from models.members import (
    CustomerMember, CustomerMemberCreate,
    MemberRenewalHistory, WeeklyTraining, WeeklyTrainingUpdate,
    AnnualReview
)
from models.payments import PaymentSchedule

router = APIRouter(prefix="/members", tags=["members"])


@router.get("")
async def get_members(expiring_soon: Optional[bool] = None, member_type: Optional[str] = None):
    query = {}
    if member_type:
        query["member_type"] = member_type
    
    docs = await db.customer_members.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    
    if expiring_soon:
        today = datetime.now(timezone.utc).date()
        thirty_days = today + timedelta(days=30)
        docs = [
            d for d in docs
            if d.get("subscription_end_date") and
            today <= datetime.fromisoformat(d["subscription_end_date"]).date() <= thirty_days
        ]
    
    return docs


@router.get("/expiring")
async def get_expiring_members(days: int = 30):
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days)
    
    docs = await db.customer_members.find({}, {"_id": 0}).to_list(1000)
    expiring = []
    for d in docs:
        if d.get("subscription_end_date") and not d.get("exit_date"):
            sub_end = datetime.fromisoformat(d["subscription_end_date"]).date()
            if today <= sub_end <= end_date:
                d["days_remaining"] = (sub_end - today).days
                expiring.append(d)
    
    expiring.sort(key=lambda x: x.get("days_remaining", 999))
    return expiring


@router.get("/{member_id}")
async def get_member(member_id: str):
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    return doc


@router.post("")
async def create_member(data: CustomerMemberCreate):
    member_data = data.model_dump()
    
    # Calculate annual review date if enabled (1 year from contract date)
    if data.annual_review_enabled and data.contract_signed_date:
        try:
            contract_date = datetime.fromisoformat(data.contract_signed_date)
            annual_date = contract_date.replace(year=contract_date.year + 1)
            member_data["annual_review_date"] = annual_date.strftime("%Y-%m-%d")
        except:
            pass
    
    member = CustomerMember(**member_data)
    doc = member.model_dump()
    await db.customer_members.insert_one(doc)
    doc.pop('_id', None)
    
    # Create payment schedule if billing is enabled
    if data.billing_enabled and data.billing_amount > 0:
        schedule = PaymentSchedule(
            member_id=doc["id"],
            amount=data.billing_amount,
            recurrence_type=data.billing_cycle_type,
            recurrence_value=data.billing_cycle_value,
            start_date=data.contract_signed_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            payment_method=data.billing_payment_method,
            is_active=True
        )
        await db.payment_schedules.insert_one(schedule.model_dump())
    
    # Create annual review if enabled
    if data.annual_review_enabled and doc.get("annual_review_date"):
        annual_review = AnnualReview(
            member_id=doc["id"],
            review_date=doc["annual_review_date"],
            status="scheduled"
        )
        await db.annual_reviews.insert_one(annual_review.model_dump())
    
    return doc


@router.put("/{member_id}")
async def update_member(member_id: str, data: CustomerMemberCreate):
    existing = await db.customer_members.find_one({"id": member_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    
    update_data = data.model_dump()
    
    # Update annual review date if enabled and changed
    if data.annual_review_enabled and data.contract_signed_date:
        try:
            contract_date = datetime.fromisoformat(data.contract_signed_date)
            annual_date = contract_date.replace(year=contract_date.year + 1)
            update_data["annual_review_date"] = annual_date.strftime("%Y-%m-%d")
        except:
            pass
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.customer_members.update_one({"id": member_id}, {"$set": update_data})
    
    # Update payment schedule if billing changed
    existing_schedule = await db.payment_schedules.find_one({"member_id": member_id, "is_active": True})
    
    if data.billing_enabled and data.billing_amount > 0:
        schedule_update = {
            "amount": data.billing_amount,
            "recurrence_type": data.billing_cycle_type,
            "recurrence_value": data.billing_cycle_value,
            "payment_method": data.billing_payment_method,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing_schedule:
            await db.payment_schedules.update_one({"id": existing_schedule["id"]}, {"$set": schedule_update})
        else:
            schedule = PaymentSchedule(
                member_id=member_id,
                amount=data.billing_amount,
                recurrence_type=data.billing_cycle_type,
                recurrence_value=data.billing_cycle_value,
                start_date=data.contract_signed_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                payment_method=data.billing_payment_method,
                is_active=True
            )
            await db.payment_schedules.insert_one(schedule.model_dump())
    elif existing_schedule and not data.billing_enabled:
        await db.payment_schedules.update_one({"id": existing_schedule["id"]}, {"$set": {"is_active": False}})
    
    return await db.customer_members.find_one({"id": member_id}, {"_id": 0})


@router.delete("/{member_id}")
async def delete_member(member_id: str):
    result = await db.customer_members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    await db.weekly_trainings.delete_many({"member_id": member_id})
    await db.challenge_checkins.delete_many({"member_id": member_id})
    await db.member_renewals.delete_many({"member_id": member_id})
    return {"message": "Membre et données associées supprimés"}


@router.post("/{member_id}/renew")
async def renew_membership(member_id: str, body: dict):
    member = await db.customer_members.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    
    new_end_date = body.get("new_end_date")
    if not new_end_date:
        raise HTTPException(status_code=400, detail="new_end_date requis")
    
    renewal = MemberRenewalHistory(
        member_id=member_id,
        previous_end_date=member.get("subscription_end_date"),
        new_end_date=new_end_date,
        renewal_duration=body.get("renewal_duration", "12 mois"),
        notes=body.get("notes", "")
    )
    await db.member_renewals.insert_one(renewal.model_dump())
    
    member_update = {
        "subscription_end_date": new_end_date,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update billing cycle if provided
    if "billing_cycle_type" in body:
        member_update["billing_cycle_type"] = body["billing_cycle_type"]
    if "billing_cycle_value" in body:
        member_update["billing_cycle_value"] = body["billing_cycle_value"]
    if "billing_amount" in body:
        member_update["billing_amount"] = body["billing_amount"]
    if "billing_payment_method" in body:
        member_update["billing_payment_method"] = body["billing_payment_method"]
    
    # Update annual review date if enabled (1 year from renewal)
    if member.get("annual_review_enabled"):
        try:
            end_date = datetime.fromisoformat(new_end_date)
            member_update["annual_review_date"] = end_date.strftime("%Y-%m-%d")
            annual_review = AnnualReview(
                member_id=member_id,
                review_date=member_update["annual_review_date"],
                status="scheduled"
            )
            await db.annual_reviews.insert_one(annual_review.model_dump())
        except:
            pass
    
    await db.customer_members.update_one({"id": member_id}, {"$set": member_update})
    
    # Update payment schedule if billing cycle changed
    if any(k in body for k in ["billing_cycle_type", "billing_cycle_value", "billing_amount", "billing_payment_method"]):
        existing_schedule = await db.payment_schedules.find_one({"member_id": member_id, "is_active": True})
        if existing_schedule:
            schedule_update = {"updated_at": datetime.now(timezone.utc).isoformat()}
            if "billing_cycle_type" in body:
                schedule_update["recurrence_type"] = body["billing_cycle_type"]
            if "billing_cycle_value" in body:
                schedule_update["recurrence_value"] = body["billing_cycle_value"]
            if "billing_amount" in body:
                schedule_update["amount"] = body["billing_amount"]
            if "billing_payment_method" in body:
                schedule_update["payment_method"] = body["billing_payment_method"]
            await db.payment_schedules.update_one({"id": existing_schedule["id"]}, {"$set": schedule_update})
    
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    return {"member": doc, "message": "Abonnement renouvelé"}


@router.get("/{member_id}/renewals")
async def get_member_renewals(member_id: str):
    return await db.member_renewals.find({"member_id": member_id}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.put("/{member_id}/onboarding")
async def update_member_onboarding(member_id: str, body: dict):
    """Update onboarding steps for a member"""
    existing = await db.customer_members.find_one({"id": member_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    
    update = {}
    onboarding_fields = [
        "onboarding_bsport", "onboarding_hubfit", "onboarding_nutrition",
        "questionnaire_coaching", "session_introduction"
    ]
    
    for field in onboarding_fields:
        if field in body:
            update[field] = body[field]
    
    all_steps = [update.get(f, existing.get(f, False)) for f in onboarding_fields]
    if all(all_steps):
        update["onboarding_completed"] = True
        update["onboarding_completed_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    else:
        update["onboarding_completed"] = False
        update["onboarding_completed_date"] = None
    
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.customer_members.update_one({"id": member_id}, {"$set": update})
    return await db.customer_members.find_one({"id": member_id}, {"_id": 0})


@router.get("/{member_id}/annual-reviews")
async def get_member_annual_reviews(member_id: str):
    """Get all annual reviews for a specific member"""
    return await db.annual_reviews.find({"member_id": member_id}, {"_id": 0}).sort("review_date", -1).to_list(50)
