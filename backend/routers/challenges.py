"""Challenge routes"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone

from core.config import db
from models.challenges import (
    SixWeeksChallenge, SixWeeksChallengeCreate,
    ChallengeParticipant, ChallengeParticipantCreate
)

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.get("")
async def get_challenges(active_only: Optional[bool] = None):
    query = {"is_active": True} if active_only else {}
    return await db.six_weeks_challenges.find(query, {"_id": 0}).sort("start_date", -1).to_list(100)


@router.get("/{challenge_id}")
async def get_challenge(challenge_id: str):
    doc = await db.six_weeks_challenges.find_one({"id": challenge_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Challenge introuvable")

    participants = await db.challenge_participants.find(
        {"challenge_id": challenge_id}, {"_id": 0}
    ).to_list(200)
    
    # Enrich participants with training data (attendance-based check-ins)
    if doc.get("start_date"):
        from datetime import datetime as dt
        try:
            start = dt.fromisoformat(doc["start_date"])
            start_iso_week = start.isocalendar()[1]
            start_year = start.isocalendar()[0]
            
            for p in participants:
                member_id = p.get("member_id")
                if not member_id:
                    continue
                
                # Fetch all trainings for this member around the challenge period
                trainings = await db.weekly_trainings.find(
                    {"member_id": member_id}, {"_id": 0}
                ).to_list(100)
                
                # Map challenge weeks to calendar weeks and look up training counts
                for w in range(1, 7):
                    target_week = start_iso_week + (w - 1)
                    target_year = start_year
                    if target_week > 52:
                        target_week -= 52
                        target_year += 1
                    
                    # Find matching training record
                    training_count = 0
                    for t in trainings:
                        if t.get("calendar_week") == target_week and t.get("year", start_year) == target_year:
                            training_count = t.get("trainings_count", 0)
                            break
                    
                    p[f"week{w}_trainings"] = training_count
        except Exception:
            pass
    
    doc["participants"] = participants
    doc["participant_count"] = len(participants)
    return doc


@router.post("")
async def create_challenge(data: SixWeeksChallengeCreate):
    challenge = SixWeeksChallenge(**data.model_dump())
    doc = challenge.model_dump()
    await db.six_weeks_challenges.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{challenge_id}")
async def update_challenge(challenge_id: str, data: SixWeeksChallengeCreate):
    existing = await db.six_weeks_challenges.find_one({"id": challenge_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Challenge introuvable")

    await db.six_weeks_challenges.update_one(
        {"id": challenge_id}, {"$set": data.model_dump()}
    )
    return await db.six_weeks_challenges.find_one({"id": challenge_id}, {"_id": 0})


@router.delete("/{challenge_id}")
async def delete_challenge(challenge_id: str):
    result = await db.six_weeks_challenges.delete_one({"id": challenge_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Challenge introuvable")
    await db.challenge_participants.delete_many({"challenge_id": challenge_id})
    return {"message": "Challenge et participants supprimés"}


@router.post("/{challenge_id}/participants")
async def add_challenge_participant(challenge_id: str, data: ChallengeParticipantCreate):
    challenge = await db.six_weeks_challenges.find_one({"id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge introuvable")

    existing = await db.challenge_participants.find_one(
        {"challenge_id": challenge_id, "member_id": data.member_id}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ce membre participe déjà au challenge")

    participant = ChallengeParticipant(**data.model_dump())
    doc = participant.model_dump()
    await db.challenge_participants.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{challenge_id}/participants/{participant_id}")
async def update_participant_checkins(challenge_id: str, participant_id: str, body: dict):
    existing = await db.challenge_participants.find_one(
        {"id": participant_id, "challenge_id": challenge_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Participant introuvable")

    update = {}

    # Boolean week toggles
    for w in range(1, 7):
        key = f"week{w}"
        if key in body:
            update[key] = body[key]

    # Weekly check-in counters
    for w in range(1, 7):
        key = f"week{w}_checkins"
        if key in body:
            update[key] = max(0, min(7, body[key]))

    if "notes" in body:
        update["notes"] = body["notes"]

    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.challenge_participants.update_one({"id": participant_id}, {"$set": update})
    return await db.challenge_participants.find_one({"id": participant_id}, {"_id": 0})


@router.delete("/{challenge_id}/participants/{participant_id}")
async def remove_participant(challenge_id: str, participant_id: str):
    result = await db.challenge_participants.delete_one(
        {"id": participant_id, "challenge_id": challenge_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Participant introuvable")
    return {"message": "Participant retiré du challenge"}
