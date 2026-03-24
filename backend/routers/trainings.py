"""Training routes"""
from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone

from core.config import db
from core.security import get_club_id
from models.members import WeeklyTraining, WeeklyTrainingUpdate

router = APIRouter(prefix="/trainings", tags=["trainings"])


@router.get("")
async def get_trainings(member_id: Optional[str] = None, year: Optional[int] = None, week: Optional[int] = None, club_id: Optional[str] = Depends(get_club_id)):
    query = {}
    if club_id:
        query["club_id"] = club_id
    if member_id:
        query["member_id"] = member_id
    if year:
        query["calendar_year"] = year
    if week:
        query["calendar_week"] = week
    return await db.weekly_trainings.find(query, {"_id": 0}).to_list(5000)


@router.post("")
async def upsert_training(data: WeeklyTrainingUpdate, club_id: Optional[str] = Depends(get_club_id)):
    existing = await db.weekly_trainings.find_one({
        "member_id": data.member_id,
        "calendar_year": data.calendar_year,
        "calendar_week": data.calendar_week
    })
    if existing:
        update_fields = {"trainings_count": data.trainings_count, "updated_at": datetime.now(timezone.utc).isoformat()}
        if club_id and not existing.get("club_id"):
            update_fields["club_id"] = club_id
        await db.weekly_trainings.update_one(
            {"id": existing["id"]},
            {"$set": update_fields}
        )
        return await db.weekly_trainings.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        training = WeeklyTraining(**data.model_dump())
        doc = training.model_dump()
        if club_id:
            doc["club_id"] = club_id
        await db.weekly_trainings.insert_one(doc)
        doc.pop('_id', None)
        return doc


@router.get("/summary/{member_id}")
async def get_member_training_summary(member_id: str, year: Optional[int] = None):
    query = {"member_id": member_id}
    if year:
        query["calendar_year"] = year
    docs = await db.weekly_trainings.find(query, {"_id": 0}).to_list(100)
    total_trainings = sum(d.get("trainings_count", 0) for d in docs)
    weeks_with_data = len(docs)
    avg_per_week = round(total_trainings / weeks_with_data, 1) if weeks_with_data > 0 else 0

    engagement = "Faible"
    if avg_per_week >= 4:
        engagement = "Excellent"
    elif avg_per_week >= 3:
        engagement = "Bon"
    elif avg_per_week >= 2:
        engagement = "Moyen"

    return {
        "member_id": member_id,
        "total_trainings": total_trainings,
        "weeks_tracked": weeks_with_data,
        "avg_per_week": avg_per_week,
        "engagement_level": engagement,
        "details": docs
    }
