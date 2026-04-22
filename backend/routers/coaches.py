"""Coach routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone

from core.config import db
from core.security import get_club_id
from models.coaches import Coach, CoachCreate, CoachReplacement

router = APIRouter(prefix="/coaches", tags=["coaches"])


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


@router.get("")
async def get_coaches(active_only: Optional[bool] = None, club_id: Optional[str] = Depends(get_club_id)):
    """Get all coaches"""
    query = _cq(club_id)
    if active_only:
        query["is_active"] = True
    docs = await db.coaches.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    return docs


@router.get("/{coach_id}")
async def get_coach(coach_id: str):
    doc = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Coach introuvable")
    return doc


@router.post("")
async def create_coach(data: CoachCreate, club_id: Optional[str] = Depends(get_club_id)):
    coach = Coach(**data.model_dump())
    doc = coach.model_dump()
    if club_id:
        doc["club_id"] = club_id
    await db.coaches.insert_one(doc)
    doc.pop('_id', None)
    return doc


VALID_RENT_STATUSES = {"payé", "impayé", "en_attente"}


@router.put("/{coach_id}")
async def update_coach(coach_id: str, data: CoachCreate):
    existing = await db.coaches.find_one({"id": coach_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Coach introuvable")
    
    # Validate rent_status enum
    if data.rent_status and data.rent_status not in VALID_RENT_STATUSES:
        raise HTTPException(status_code=422, detail=f"rent_status invalide. Valeurs acceptées : {', '.join(VALID_RENT_STATUSES)}")
    
    update = data.model_dump()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Auto-set rent_last_paid_at when rent_status transitions to "payé"
    old_status = existing.get("rent_status")
    if data.rent_status == "payé" and old_status != "payé":
        update["rent_last_paid_at"] = datetime.now(timezone.utc).isoformat()
    # Don't overwrite rent_last_paid_at when going back to impayé/en_attente
    if data.rent_status in ("impayé", "en_attente"):
        update.pop("rent_last_paid_at", None)
    
    await db.coaches.update_one({"id": coach_id}, {"$set": update})
    return await db.coaches.find_one({"id": coach_id}, {"_id": 0})


@router.delete("/{coach_id}")
async def delete_coach(coach_id: str):
    result = await db.coaches.delete_one({"id": coach_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coach introuvable")
    return {"message": "Coach supprimé"}


# ── Soft delete (archive / restore) ──────────────────────────────────────────

@router.post("/{coach_id}/archive")
async def archive_coach(coach_id: str):
    doc = await db.coaches.find_one({"id": coach_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Coach introuvable")
    if doc.get("archived_at"):
        raise HTTPException(status_code=400, detail="Coach déjà archivé")
    now = datetime.now(timezone.utc).isoformat()
    await db.coaches.update_one({"id": coach_id}, {"$set": {"archived_at": now, "updated_at": now}})
    return await db.coaches.find_one({"id": coach_id}, {"_id": 0})


@router.post("/{coach_id}/restore")
async def restore_coach(coach_id: str):
    doc = await db.coaches.find_one({"id": coach_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Coach introuvable")
    if not doc.get("archived_at"):
        raise HTTPException(status_code=400, detail="Coach déjà actif (non archivé)")
    now = datetime.now(timezone.utc).isoformat()
    await db.coaches.update_one({"id": coach_id}, {"$set": {"archived_at": None, "updated_at": now}})
    return await db.coaches.find_one({"id": coach_id}, {"_id": 0})


@router.get("/{coach_id}/stats")
async def get_coach_stats(coach_id: str, year: Optional[int] = None, month: Optional[int] = None):
    """Get coach statistics (hours worked, earnings)"""
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach introuvable")
    
    # Build query for courses
    query = {"coach_id": coach_id}
    if year and month:
        query["month"] = month
        query["year"] = year
    elif year:
        query["year"] = year
    
    courses = await db.course_kpis.find(query, {"_id": 0}).to_list(500)
    
    total_hours = 0
    total_participants = 0
    for course in courses:
        # Count weeks with data (S1-S5)
        weeks_worked = sum(1 for i in range(1, 6) if course.get(f"s{i}", 0) > 0)
        total_hours += weeks_worked  # Assuming 1 hour per course
        for i in range(1, 6):
            total_participants += course.get(f"s{i}", 0)
    
    earnings = total_hours * coach.get("hourly_rate", 0)
    
    return {
        "coach": coach,
        "total_courses": len(courses),
        "total_hours": total_hours,
        "total_participants": total_participants,
        "earnings": earnings,
        "hourly_rate": coach.get("hourly_rate", 0)
    }


# ── Coach Replacements ───────────────────────────────────────────────────────

@router.get("/replacements/")
async def get_replacements(course_id: Optional[str] = None, date: Optional[str] = None):
    """Get coach replacements"""
    query = {}
    if course_id:
        query["course_id"] = course_id
    if date:
        query["date"] = date
    
    docs = await db.coach_replacements.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Enrich with coach names
    for doc in docs:
        original = await db.coaches.find_one({"id": doc["original_coach_id"]}, {"_id": 0, "name": 1})
        replacement = await db.coaches.find_one({"id": doc["replacement_coach_id"]}, {"_id": 0, "name": 1})
        doc["original_coach_name"] = original.get("name", "") if original else ""
        doc["replacement_coach_name"] = replacement.get("name", "") if replacement else ""
    
    return docs


@router.post("/replacements/")
async def create_replacement(data: dict):
    """Create a coach replacement for a course"""
    required = ["course_id", "original_coach_id", "replacement_coach_id", "date"]
    for field in required:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"{field} requis")
    
    replacement = CoachReplacement(
        course_id=data["course_id"],
        original_coach_id=data["original_coach_id"],
        replacement_coach_id=data["replacement_coach_id"],
        date=data["date"],
        reason=data.get("reason", "")
    )
    doc = replacement.model_dump()
    await db.coach_replacements.insert_one(doc)
    doc.pop('_id', None)
    
    # Also update the course's coach for that specific date
    # This is handled by the frontend when displaying
    
    return doc
