"""Onboarding and Alerts routes"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from core.config import db, exclude_archived
from core.security import get_club_id

router = APIRouter(tags=["onboarding"])


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


@router.get("/onboarding/pending")
async def get_pending_onboarding(include_paused: Optional[bool] = None, club_id: Optional[str] = Depends(get_club_id)):
    """Get members with incomplete onboarding (excludes coaches, IFRC, and skipped)"""
    COACH_KEYWORDS = ["THE COACH", "VIRTUAL COACH", "VIRTUAL", "IFRC"]
    today_iso_d = datetime.now(timezone.utc).date().isoformat()
    docs = await db.customer_members.find(exclude_archived(_cq(club_id, {
        "onboarding_completed": {"$ne": True},
        "onboarding_skipped": {"$ne": True},
        "$or": [{"exit_date": None}, {"exit_date": ""}, {"exit_date": {"$exists": False}}]
    })), {"_id": 0}).to_list(500)
    
    filtered = []
    for doc in docs:
        membership = (doc.get("membership") or "").upper()
        if any(kw in membership for kw in COACH_KEYWORDS):
            continue
        # Sprint D Phase 2 — flag on_pause + filtre par défaut
        start = doc.get("pause_start_date")
        end = doc.get("pause_end_date")
        is_paused = bool(start) and start <= today_iso_d and (not end or today_iso_d <= end)
        doc["on_pause"] = is_paused
        if is_paused and not include_paused:
            continue
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
        filtered.append(doc)
    
    filtered.sort(key=lambda x: x["onboarding_progress"])
    return filtered


@router.post("/onboarding/{member_id}/skip")
async def skip_onboarding(member_id: str, body: dict = {}):
    """Skip onboarding for a member"""
    member = await db.customer_members.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    
    await db.customer_members.update_one(
        {"id": member_id},
        {"$set": {
            "onboarding_skipped": True,
            "onboarding_skip_reason": body.get("reason", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await db.activity_logs.insert_one({
        "id": str(uuid4()),
        "member_id": member_id,
        "action": "onboarding_skipped",
        "description": f"Onboarding skipé - {body.get('reason', 'Aucune raison')}",
        "user_name": body.get("user_name", "Utilisateur"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"message": "Onboarding skipé"}


@router.get("/onboarding/history")
async def get_onboarding_history(club_id: Optional[str] = Depends(get_club_id)):
    """Get members who completed onboarding"""
    COACH_KEYWORDS = ["THE COACH", "VIRTUAL COACH", "VIRTUAL", "IFRC"]
    docs = await db.customer_members.find(_cq(club_id, {
        "onboarding_completed": True
    }), {"_id": 0}).to_list(500)
    
    filtered = []
    for doc in docs:
        membership = (doc.get("membership") or "").upper()
        if any(kw in membership for kw in COACH_KEYWORDS):
            continue
        filtered.append(doc)
    
    filtered.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return filtered



@router.get("/alerts/summary")
async def get_alerts_summary(club_id: Optional[str] = Depends(get_club_id)):
    """Get summary of all alerts (late payments, missed followups, expiring subscriptions)"""
    today = datetime.now(timezone.utc).date()
    thirty_days = today + timedelta(days=30)
    
    late_payments = await db.payments.count_documents(_cq(club_id, {
        "due_date": {"$lt": today.isoformat()},
        "status": {"$in": ["pending", "late"]}
    }))
    
    missed_followups = await db.member_followups.count_documents(_cq(club_id, {
        "followup_date": {"$lt": today.isoformat()},
        "status": {"$in": ["scheduled", "rescheduled"]}
    }))
    
    members = await db.customer_members.find(exclude_archived(_cq(club_id, {
        "$or": [{"exit_date": None}, {"exit_date": ""}, {"exit_date": {"$exists": False}}]
    })), {"_id": 0, "subscription_end_date": 1}).to_list(1000)
    
    expiring_count = 0
    for m in members:
        if m.get("subscription_end_date"):
            try:
                end_date = datetime.fromisoformat(m["subscription_end_date"]).date()
                if today <= end_date <= thirty_days:
                    expiring_count += 1
            except:
                pass
    
    incomplete_onboarding = await db.customer_members.count_documents(exclude_archived(_cq(club_id, {
        "onboarding_completed": {"$ne": True},
        "$or": [{"exit_date": None}, {"exit_date": ""}, {"exit_date": {"$exists": False}}]
    })))
    
    seven_days = today + timedelta(days=7)
    upcoming_followups = await db.member_followups.count_documents(_cq(club_id, {
        "followup_date": {"$gte": today.isoformat(), "$lte": seven_days.isoformat()},
        "status": {"$in": ["scheduled", "rescheduled"]}
    }))
    
    return {
        "late_payments": late_payments,
        "missed_followups": missed_followups,
        "expiring_subscriptions": expiring_count,
        "incomplete_onboarding": incomplete_onboarding,
        "upcoming_followups": upcoming_followups,
        "total_alerts": late_payments + missed_followups + expiring_count
    }
