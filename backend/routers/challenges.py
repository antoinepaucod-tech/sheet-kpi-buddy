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
