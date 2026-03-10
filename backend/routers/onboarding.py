"""Onboarding and Alerts routes"""
from fastapi import APIRouter
from datetime import datetime, timezone, timedelta

from core.config import db

router = APIRouter(tags=["onboarding"])


@router.get("/onboarding/pending")
async def get_pending_onboarding():
    """Get members with incomplete onboarding"""
    docs = await db.customer_members.find({
        "onboarding_completed": {"$ne": True},
        "exit_date": None
    }, {"_id": 0}).to_list(500)
    
    for doc in docs:
        steps = [
            doc.get("onboarding_bsport", False),
            doc.get("onboarding_hubfit", False),
            doc.get("onboarding_nutrition", False),
            doc.get("questionnaire_coaching", False),
            doc.get("session_introduction", False)
        ]
        doc["onboarding_progress"] = sum(steps)
        doc["onboarding_total"] = 5
        doc["onboarding_percentage"] = round((sum(steps) / 5) * 100)
    
    docs.sort(key=lambda x: x["onboarding_progress"])
    return docs


@router.get("/alerts/summary")
async def get_alerts_summary():
    """Get summary of all alerts (late payments, missed followups, expiring subscriptions)"""
    today = datetime.now(timezone.utc).date()
    thirty_days = today + timedelta(days=30)
    
    late_payments = await db.payments.count_documents({
        "due_date": {"$lt": today.isoformat()},
        "status": {"$in": ["pending", "late"]}
    })
    
    missed_followups = await db.member_followups.count_documents({
        "followup_date": {"$lt": today.isoformat()},
        "status": {"$in": ["scheduled", "rescheduled"]}
    })
    
    members = await db.customer_members.find({
        "exit_date": None
    }, {"_id": 0, "subscription_end_date": 1}).to_list(1000)
    
    expiring_count = 0
    for m in members:
        if m.get("subscription_end_date"):
            try:
                end_date = datetime.fromisoformat(m["subscription_end_date"]).date()
                if today <= end_date <= thirty_days:
                    expiring_count += 1
            except:
                pass
    
    incomplete_onboarding = await db.customer_members.count_documents({
        "onboarding_completed": {"$ne": True},
        "exit_date": None
    })
    
    seven_days = today + timedelta(days=7)
    upcoming_followups = await db.member_followups.count_documents({
        "followup_date": {"$gte": today.isoformat(), "$lte": seven_days.isoformat()},
        "status": {"$in": ["scheduled", "rescheduled"]}
    })
    
    return {
        "late_payments": late_payments,
        "missed_followups": missed_followups,
        "expiring_subscriptions": expiring_count,
        "incomplete_onboarding": incomplete_onboarding,
        "upcoming_followups": upcoming_followups,
        "total_alerts": late_payments + missed_followups + expiring_count
    }
