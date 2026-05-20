"""Challenge routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone

from core.config import db, exclude_archived, check_member_not_archived
from core.security import get_club_id, get_current_user
from core.club_id_guard import resolve_club_id_or_fallback
from models.challenges import (
    SixWeeksChallenge, SixWeeksChallengeCreate,
    ChallengeParticipant, ChallengeParticipantCreate
)

router = APIRouter(prefix="/challenges", tags=["challenges"])


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


@router.get("")
async def get_challenges(active_only: Optional[bool] = None, club_id: Optional[str] = Depends(get_club_id)):
    query = _cq(club_id, {"is_active": True} if active_only else None)
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
async def create_challenge(
    data: SixWeeksChallengeCreate,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    challenge = SixWeeksChallenge(**data.model_dump())
    doc = challenge.model_dump()
    # Phase 3 Bonus — pattern uniforme défense en profondeur
    doc["club_id"] = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/challenges (POST)",
    )
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
async def add_challenge_participant(
    challenge_id: str,
    data: ChallengeParticipantCreate,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    challenge = await db.six_weeks_challenges.find_one({"id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge introuvable")

    # Type C: block if target member is archived
    await check_member_not_archived(data.member_id)

    existing = await db.challenge_participants.find_one(
        {"challenge_id": challenge_id, "member_id": data.member_id}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ce membre participe déjà au challenge")

    # Phase 3 Batch 2 — défense en profondeur club_id (Sprint Hardening pattern).
    # Cascade : challenge.club_id (parent, single source) > header > Versoix.
    # Calculé UNE seule fois pour propagation cohérente sur participant + 6 bilans hebdo.
    resolved_club_id = challenge.get("club_id") or resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/challenges/{id}/participants",
    )

    participant = ChallengeParticipant(**data.model_dump())
    doc = participant.model_dump()
    doc["club_id"] = resolved_club_id
    await db.challenge_participants.insert_one(doc)
    doc.pop("_id", None)

    # Auto-create 6 weekly bilans for the challenger
    from models.members import AnnualReview
    from datetime import timedelta
    start_date_str = challenge.get("start_date", "")
    if start_date_str:
        try:
            start_date = datetime.fromisoformat(start_date_str)
        except Exception:
            start_date = datetime.now(timezone.utc)
    else:
        start_date = datetime.now(timezone.utc)

    member = await db.customer_members.find_one({"id": data.member_id}, {"_id": 0})

    for week in range(1, 7):
        review_date = (start_date + timedelta(weeks=week)).strftime("%Y-%m-%d")
        # Check if bilan already exists for this member+date
        existing_bilan = await db.annual_reviews.find_one({
            "member_id": data.member_id,
            "review_date": review_date,
            "review_type": "weekly",
        })
        if not existing_bilan:
            bilan = AnnualReview(
                member_id=data.member_id,
                review_date=review_date,
                review_type="weekly",
                notes=f"Bilan semaine {week} - {challenge.get('name', 'Challenge')}",
                status="scheduled",
            )
            bilan_doc = bilan.model_dump()
            bilan_doc["club_id"] = resolved_club_id  # Phase 3 Batch 2 — cascade
            await db.annual_reviews.insert_one(bilan_doc)

    # Update member bilan frequency to weekly
    await db.customer_members.update_one(
        {"id": data.member_id},
        {"$set": {"bilan_frequency": "weekly"}}
    )

    return doc



@router.post("/auto-generate-bilans")
async def auto_generate_bilans(
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Auto-generate monthly bilans for all non-challenge active members."""
    from models.members import AnnualReview
    from datetime import timedelta

    today = datetime.now(timezone.utc)
    today_str = today.strftime("%Y-%m-%d")
    next_month = (today.replace(day=1) + timedelta(days=32)).replace(day=1).strftime("%Y-%m-%d")

    # Phase 3 Batch 2 — défense en profondeur club_id.
    # Résolu UNE seule fois (perf + 1 seul log MISSING_CLUB_ID si fallback).
    resolved_club_id = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/challenges/auto-generate-bilans",
    )

    # Get all active members (excluding archived — Type B filter)
    members = await db.customer_members.find(
        exclude_archived({"subscription_end_date": {"$gte": today_str}}),
        {"_id": 0, "id": 1, "name": 1, "bilan_frequency": 1}
    ).to_list(500)

    # Get active challenge participant member_ids
    challenge_member_ids = set()
    active_challenges = await db.six_weeks_challenges.find({"is_active": True}).to_list(50)
    for ch in active_challenges:
        participants = await db.challenge_participants.find(
            {"challenge_id": ch["id"]}, {"_id": 0, "member_id": 1}
        ).to_list(200)
        for p in participants:
            challenge_member_ids.add(p["member_id"])

    created = 0
    for member in members:
        mid = member["id"]
        freq = member.get("bilan_frequency", "monthly")

        # Skip challenge members (they have weekly bilans already)
        if mid in challenge_member_ids:
            continue

        # Check if a bilan already exists for this month
        existing = await db.annual_reviews.find_one({
            "member_id": mid,
            "review_date": {"$gte": today.strftime("%Y-%m-01"), "$lt": next_month},
        })
        if existing:
            continue

        bilan = AnnualReview(
            member_id=mid,
            review_date=next_month,
            review_type=freq,
            notes=f"Check-in {freq} automatique",
            status="scheduled",
        )
        bilan_doc = bilan.model_dump()
        bilan_doc["club_id"] = resolved_club_id  # Phase 3 Batch 2 — défense en profondeur
        await db.annual_reviews.insert_one(bilan_doc)
        created += 1

    return {"message": f"{created} bilans mensuels créés", "created": created}


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
