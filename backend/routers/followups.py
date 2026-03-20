"""Follow-up routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

from core.config import db
from core.security import get_club_id
from models.members import MemberFollowUp, MemberFollowUpCreate

router = APIRouter(prefix="/followups", tags=["followups"])


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


@router.get("")
async def get_followups(
    member_id: Optional[str] = None,
    status: Optional[str] = None,
    followup_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    club_id: Optional[str] = Depends(get_club_id)
):
    query = _cq(club_id)
    if member_id:
        query["member_id"] = member_id
    if status:
        query["status"] = status
    if followup_type:
        query["followup_type"] = followup_type
    if from_date or to_date:
        query["followup_date"] = {}
        if from_date:
            query["followup_date"]["$gte"] = from_date
        if to_date:
            query["followup_date"]["$lte"] = to_date
    
    return await db.member_followups.find(query, {"_id": 0}).sort("followup_date", 1).to_list(1000)


@router.get("/upcoming")
async def get_upcoming_followups(days: int = 7):
    """Get follow-ups scheduled in the next N days"""
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days)
    
    docs = await db.member_followups.find({
        "followup_date": {"$gte": today.isoformat(), "$lte": end_date.isoformat()},
        "status": {"$in": ["scheduled", "rescheduled"]}
    }, {"_id": 0}).sort("followup_date", 1).to_list(500)
    
    for doc in docs:
        member = await db.customer_members.find_one({"id": doc["member_id"]}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        if member:
            doc["member_name"] = member.get("name", "")
            doc["member_email"] = member.get("email", "")
            doc["member_phone"] = member.get("phone", "")
    
    return docs


@router.get("/missed")
async def get_missed_followups():
    """Get all missed follow-ups (past date and not completed)"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    docs = await db.member_followups.find({
        "followup_date": {"$lt": today},
        "status": {"$in": ["scheduled", "rescheduled"]}
    }, {"_id": 0}).sort("followup_date", 1).to_list(500)
    
    for doc in docs:
        await db.member_followups.update_one(
            {"id": doc["id"]},
            {"$set": {"status": "missed", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        doc["status"] = "missed"
    
    for doc in docs:
        member = await db.customer_members.find_one({"id": doc["member_id"]}, {"_id": 0, "name": 1, "email": 1})
        if member:
            doc["member_name"] = member.get("name", "")
            doc["member_email"] = member.get("email", "")
    
    return docs


@router.post("")
async def create_followup(data: MemberFollowUpCreate, club_id: Optional[str] = Depends(get_club_id)):
    followup = MemberFollowUp(**data.model_dump())
    doc = followup.model_dump()
    if club_id:
        doc["club_id"] = club_id
    await db.member_followups.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/{followup_id}")
async def update_followup(followup_id: str, body: dict):
    existing = await db.member_followups.find_one({"id": followup_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Suivi introuvable")
    
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.member_followups.update_one({"id": followup_id}, {"$set": body})
    return await db.member_followups.find_one({"id": followup_id}, {"_id": 0})


@router.post("/{followup_id}/complete")
async def complete_followup(followup_id: str, body: dict = {}):
    """Mark a follow-up as completed"""
    existing = await db.member_followups.find_one({"id": followup_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Suivi introuvable")
    
    update = {
        "status": "completed",
        "completed_date": body.get("completed_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "notes": body.get("notes", existing.get("notes", "")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    next_date = body.get("next_followup_date")
    if next_date:
        update["next_followup_date"] = next_date
        next_followup = MemberFollowUp(
            member_id=existing["member_id"],
            followup_date=next_date,
            followup_type="monthly"
        )
        await db.member_followups.insert_one(next_followup.model_dump())
        
        await db.customer_members.update_one(
            {"id": existing["member_id"]},
            {"$set": {
                "last_followup_date": update["completed_date"],
                "next_followup_date": next_date,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    await db.member_followups.update_one({"id": followup_id}, {"$set": update})
    return await db.member_followups.find_one({"id": followup_id}, {"_id": 0})


@router.delete("/{followup_id}")
async def delete_followup(followup_id: str):
    result = await db.member_followups.delete_one({"id": followup_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Suivi introuvable")
    return {"message": "Suivi supprimé"}
