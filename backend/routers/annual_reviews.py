"""Reviews (Bilans/Suivis) routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta, date
from dateutil.relativedelta import relativedelta
from uuid import uuid4
import logging

from core.config import db, exclude_archived, check_member_not_archived, get_archived_member_ids
from core.security import get_club_id, get_current_user
from core.club_id_guard import resolve_club_id_or_fallback
from core.activity_log import log_activity
from models.members import AnnualReview, AnnualReviewCreate

router = APIRouter(prefix="/annual-reviews", tags=["reviews"])
logger = logging.getLogger(__name__)


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q

FREQUENCY_MAP = {
    "weekly": relativedelta(weeks=1),
    "monthly": relativedelta(months=1),
    "quarterly": relativedelta(months=3),
    "semi-annually": relativedelta(months=6),
    "annually": relativedelta(years=1),
}

FREQUENCY_LABELS = {
    "weekly": "Hebdomadaire",
    "monthly": "Mensuel",
    "quarterly": "Trimestriel",
    "semi-annually": "Semestriel",
    "annually": "Annuel",
}


@router.get("")
async def get_reviews(
    member_id: Optional[str] = None,
    status: Optional[str] = None,
    review_type: Optional[str] = None,
    year: Optional[int] = None,
    club_id: Optional[str] = Depends(get_club_id)
):
    query = _cq(club_id)
    if member_id:
        query["member_id"] = member_id
    if status:
        query["status"] = status
    if review_type:
        query["review_type"] = review_type
    if year:
        query["review_date"] = {"$regex": f"^{year}"}

    docs = await db.annual_reviews.find(query, {"_id": 0}).sort("review_date", -1).to_list(500)

    # Type B: silently filter archived members
    archived_ids = await get_archived_member_ids(club_id)
    docs = [d for d in docs if d.get("member_id") not in archived_ids]

    for doc in docs:
        member = await db.customer_members.find_one(
            {"id": doc["member_id"]}, {"_id": 0, "name": 1, "email": 1, "review_frequency": 1}
        )
        if member:
            doc["member_name"] = member.get("name", "")
            doc["member_email"] = member.get("email", "")
            if "review_type" not in doc:
                doc["review_type"] = member.get("review_frequency", "annually")
        if "review_type" not in doc:
            doc["review_type"] = "annually"

    return docs


@router.get("/upcoming")
async def get_upcoming_reviews(days: int = 30, club_id: Optional[str] = Depends(get_club_id)):
    """Get reviews scheduled in the next N days"""
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days)

    q = {"review_date": {"$gte": today.isoformat(), "$lte": end_date.isoformat()}, "status": "scheduled"}
    if club_id:
        q["club_id"] = club_id
    docs = await db.annual_reviews.find(q, {"_id": 0}).sort("review_date", 1).to_list(100)

    # Type B: silently filter archived members
    archived_ids = await get_archived_member_ids(club_id)
    docs = [d for d in docs if d.get("member_id") not in archived_ids]

    for doc in docs:
        member = await db.customer_members.find_one(
            {"id": doc["member_id"]}, {"_id": 0, "name": 1, "email": 1, "phone": 1, "review_frequency": 1}
        )
        if member:
            doc["member_name"] = member.get("name", "")
            doc["member_email"] = member.get("email", "")
            doc["member_phone"] = member.get("phone", "")
            if "review_type" not in doc:
                doc["review_type"] = member.get("review_frequency", "annually")
        if "review_type" not in doc:
            doc["review_type"] = "annually"
        doc["days_until"] = (datetime.fromisoformat(doc["review_date"]).date() - today).days

    return docs



@router.get("/stats")
async def get_review_stats(club_id: Optional[str] = Depends(get_club_id)):
    """Get review counts for sidebar badges — matches frontend differenceInDays logic"""
    now = datetime.now()
    today_date = now.date()

    all_scheduled = await db.annual_reviews.find(
        _cq(club_id, {"status": "scheduled"}), {"_id": 0, "review_date": 1, "member_id": 1}
    ).to_list(None)

    # Type B: silently filter archived members
    archived_ids = await get_archived_member_ids(club_id)
    all_scheduled = [r for r in all_scheduled if r.get("member_id") not in archived_ids]

    overdue = 0
    this_week = 0
    for r in all_scheduled:
        rd_str = r.get("review_date", "")
        if not rd_str:
            continue
        try:
            rd = datetime.strptime(rd_str, "%Y-%m-%d")
        except ValueError:
            continue
        # Match date-fns differenceInDays: truncate toward zero
        diff_ms = (rd - now).total_seconds()
        days = int(diff_ms / 86400)  # truncate toward zero like Math.trunc
        if days < 0:
            overdue += 1
        elif days <= 7:
            this_week += 1

    return {"overdue": overdue, "this_week": this_week}



@router.get("/overdue")
async def get_overdue_reviews(club_id: Optional[str] = Depends(get_club_id)):
    """Get reviews that are past due date and still scheduled"""
    today = datetime.now(timezone.utc).date().isoformat()

    docs = await db.annual_reviews.find(_cq(club_id, {
        "review_date": {"$lt": today},
        "status": "scheduled"
    }), {"_id": 0}).sort("review_date", 1).to_list(100)

    # Type B: silently filter archived members
    archived_ids = await get_archived_member_ids(club_id)
    docs = [d for d in docs if d.get("member_id") not in archived_ids]

    for doc in docs:
        member = await db.customer_members.find_one(
            {"id": doc["member_id"]}, {"_id": 0, "name": 1}
        )
        if member:
            doc["member_name"] = member.get("name", "")

    return docs


@router.get("/dashboard-alerts")
async def get_dashboard_alerts(club_id: Optional[str] = Depends(get_club_id)):
    """Get review alerts for the main dashboard — matches frontend differenceInDays logic"""
    now = datetime.now()

    all_scheduled = await db.annual_reviews.find(
        _cq(club_id, {"status": "scheduled"}), {"_id": 0}
    ).to_list(500)

    # Type B: silently filter archived members
    archived_ids = await get_archived_member_ids(club_id)
    all_scheduled = [r for r in all_scheduled if r.get("member_id") not in archived_ids]

    overdue = []
    this_week = []
    next_30 = []

    for r in all_scheduled:
        rd_str = r.get("review_date", "")
        if not rd_str:
            continue
        try:
            rd = datetime.strptime(rd_str, "%Y-%m-%d")
        except ValueError:
            continue
        days = int((rd - now).total_seconds() / 86400)
        if days < 0:
            overdue.append(r)
        elif days <= 7:
            this_week.append(r)
        elif days <= 30:
            next_30.append(r)

    # Enrich with member names (for top items)
    items_to_show = (overdue[:5] + this_week[:10])
    for item in items_to_show:
        member = await db.customer_members.find_one(
            {"id": item["member_id"]}, {"_id": 0, "name": 1, "email": 1}
        )
        if member:
            item["member_name"] = member.get("name", "")
            item["member_email"] = member.get("email", "")

    return {
        "overdue_count": len(overdue),
        "this_week_count": len(this_week),
        "next_30_count": len(next_30),
        "total_scheduled": len(all_scheduled),
        "overdue_items": overdue[:5],
        "this_week_items": this_week[:10],
    }


@router.get("/member-summary/{member_id}")
async def get_member_review_summary(member_id: str):
    """Get attendance & payment summary for a member, used in the review completion form"""
    member = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")

    # Attendance: last 12 weeks of training data
    trainings = await db.weekly_trainings.find(
        {"member_id": member_id}, {"_id": 0}
    ).sort("calendar_year", -1).to_list(100)

    # Take latest 12 entries
    recent_trainings = trainings[:12]
    total_sessions = sum(t.get("trainings_count", 0) for t in recent_trainings)
    weeks_tracked = len(recent_trainings)
    avg_per_week = round(total_sessions / weeks_tracked, 1) if weeks_tracked > 0 else 0

    # Payment status
    payment_schedules = await db.payment_schedules.find(
        {"member_id": member_id, "is_active": True}, {"_id": 0}
    ).to_list(10)

    payments = await db.payments.find(
        {"member_id": member_id}, {"_id": 0}
    ).sort("due_date", -1).to_list(20)

    late_payments = [p for p in payments if p.get("status") in ("pending", "late")]
    paid_payments = [p for p in payments if p.get("status") == "paid"]

    # Previous reviews for this member
    past_reviews = await db.annual_reviews.find(
        {"member_id": member_id, "status": "completed"},
        {"_id": 0, "review_date": 1, "weight_current": 1, "weight_start": 1,
         "weight_change": 1, "weight_goal": 1, "training_frequency": 1, "new_goals": 1,
         "nutrition_score": 1, "nutrition_current": 1}
    ).sort("review_date", -1).to_list(10)

    return {
        "member_name": member.get("name", ""),
        "membership": member.get("membership", ""),
        "contract_signed_date": member.get("contract_signed_date"),
        "attendance": {
            "total_sessions": total_sessions,
            "weeks_tracked": weeks_tracked,
            "avg_per_week": avg_per_week,
            "engagement": (
                "Excellent" if avg_per_week >= 4 else
                "Bon" if avg_per_week >= 3 else
                "Moyen" if avg_per_week >= 2 else
                "Faible"
            ),
        },
        "payments": {
            "active_schedules": len(payment_schedules),
            "monthly_amount": sum(ps.get("amount", 0) for ps in payment_schedules),
            "late_count": len(late_payments),
            "late_total": sum(p.get("amount", 0) for p in late_payments),
            "paid_count": len(paid_payments),
        },
        "previous_reviews": past_reviews,
    }


@router.get("/history/{member_id}")
async def get_review_history(member_id: str):
    """Get all completed reviews for a member, for charts"""
    docs = await db.annual_reviews.find(
        {"member_id": member_id, "status": "completed"},
        {"_id": 0}
    ).sort("review_date", 1).to_list(100)
    member = await db.customer_members.find_one({"id": member_id}, {"_id": 0, "name": 1})
    return {
        "member_id": member_id,
        "member_name": member.get("name", "") if member else "",
        "reviews": docs
    }


@router.get("/{review_id}")
async def get_review(review_id: str):
    doc = await db.annual_reviews.find_one({"id": review_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Bilan introuvable")
    member = await db.customer_members.find_one({"id": doc["member_id"]}, {"_id": 0})
    if member:
        doc["member"] = member
    return doc


@router.post("")
async def create_review(data: AnnualReviewCreate, club_id: Optional[str] = Depends(get_club_id)):
    # Type C: block if target member is archived
    await check_member_not_archived(data.member_id)
    review = AnnualReview(**data.model_dump())
    doc = review.model_dump()
    if club_id:
        doc["club_id"] = club_id
    await db.annual_reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/auto-generate")
async def auto_generate_reviews(
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Scan ALL active members and create missing scheduled reviews.
    Rules:
    - Only members with annual_review_enabled=True
    - Exclude departed members (exit_date in the past)
    - Exclude HUBFIT memberships
    - Exclude anyone who has ANY coach membership (THE COACH / VIRTUAL COACH)
    - Frequency: monthly for all (unless member has a specific review_frequency)
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Phase 3 Batch 1 — défense en profondeur club_id (Sprint Hardening pattern).
    # Résolu UNE seule fois ici (perf + un seul log MISSING_CLUB_ID si fallback).
    resolved_club_id = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/annual-reviews/auto-generate",
    )

    # Get ALL members (excluding archived — Type B filter)
    members = await db.customer_members.find(
        exclude_archived(_cq(club_id)),
        {"_id": 0, "id": 1, "name": 1, "contract_signed_date": 1,
         "annual_review_date": 1, "exit_date": 1, "membership": 1,
         "annual_review_enabled": 1, "first_review_date": 1,
         "review_frequency": 1}
    ).to_list(5000)

    # Step 1: Build set of names that have ANY coach membership
    coach_kw = ["THE COACH", "VIRTUAL COACH"]
    coach_names = set()
    for m in members:
        membership = (m.get("membership") or "").upper()
        if any(kw in membership for kw in coach_kw):
            coach_names.add(m.get("name", ""))

    # Step 2: Filter eligible members
    def is_eligible(m):
        # Must have bilan enabled
        if not m.get("annual_review_enabled"):
            return False
        # Departed?
        exit_d = m.get("exit_date")
        if exit_d and exit_d not in (None, "", "None") and exit_d < today:
            return False
        membership = (m.get("membership") or "").upper()
        # Exclude HUBFIT
        if "HUBFIT" in membership:
            return False
        # Exclude coach memberships
        if any(kw in membership for kw in coach_kw):
            return False
        # Exclude anyone whose NAME has a coach membership elsewhere
        if m.get("name", "") in coach_names:
            return False
        return True

    eligible = [m for m in members if is_eligible(m)]

    # Frequency: monthly for all (default)
    default_freq = "monthly"
    default_delta = FREQUENCY_MAP["monthly"]

    created = 0
    skipped = 0
    today_dt = datetime.strptime(today, "%Y-%m-%d")

    for member in eligible:
        member_id = member["id"]
        freq = member.get("review_frequency", default_freq)
        delta = FREQUENCY_MAP.get(freq, default_delta)

        # Check if there's already a scheduled review (any date)
        existing_scheduled = await db.annual_reviews.find_one({
            "member_id": member_id,
            "status": "scheduled",
        })

        if existing_scheduled:
            skipped += 1
            continue

        # Calculate next review date - ALWAYS from contract_signed_date + frequency
        last_completed = await db.annual_reviews.find_one(
            {"member_id": member_id, "status": "completed"},
            {"_id": 0, "review_date": 1},
            sort=[("review_date", -1)]
        )

        if last_completed:
            base_date = datetime.strptime(last_completed["review_date"], "%Y-%m-%d")
            next_date = base_date + delta
        elif member.get("first_review_date") and member["first_review_date"].strip():
            next_date = datetime.strptime(member["first_review_date"], "%Y-%m-%d")
        elif member.get("contract_signed_date"):
            base_date = datetime.strptime(member["contract_signed_date"], "%Y-%m-%d")
            next_date = base_date + delta
        else:
            skipped += 1
            continue

        # Advance to the most recent due period (stop when NEXT period > today)
        # This way: if review day is 5th and today is 19th -> review = March 5 (OVERDUE)
        # If review day is 25th and today is 19th -> review = Feb 25 (OVERDUE, not done)
        while next_date + delta <= today_dt:
            next_date = next_date + delta

        review_date_str = next_date.strftime("%Y-%m-%d")

        new_review = AnnualReview(
            member_id=member_id,
            review_date=review_date_str,
            review_type=freq,
            status="scheduled"
        )
        doc = new_review.model_dump()
        doc["club_id"] = resolved_club_id  # défense en profondeur Phase 3 Batch 1
        await db.annual_reviews.insert_one(doc)

        await db.customer_members.update_one(
            {"id": member_id},
            {"$set": {"annual_review_date": review_date_str}}
        )
        created += 1

    return {
        "message": f"{created} bilan(s) créé(s), {skipped} ignoré(s) (déjà planifié ou incomplet)",
        "created": created,
        "skipped": skipped,
        "total_eligible": len(eligible)
    }


@router.put("/{review_id}")
async def update_review(review_id: str, body: dict):
    existing = await db.annual_reviews.find_one({"id": review_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Bilan introuvable")

    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.annual_reviews.update_one({"id": review_id}, {"$set": body})
    return await db.annual_reviews.find_one({"id": review_id}, {"_id": 0})


@router.post("/{review_id}/complete")
async def complete_review(
    review_id: str,
    body: dict,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Complete a review with all measurements and notes"""
    existing = await db.annual_reviews.find_one({"id": review_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Bilan introuvable")

    weight_start = body.get("weight_start", existing.get("weight_start"))
    weight_current = body.get("weight_current", existing.get("weight_current"))
    if weight_start and weight_current:
        body["weight_change"] = round(weight_current - weight_start, 1)

    update = {
        **body,
        "status": "completed",
        "completed_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    await db.annual_reviews.update_one({"id": review_id}, {"$set": update})

    # Log activity
    await log_activity(
        db,
        action="bilan_completed",
        description=f"Bilan {existing.get('review_type', 'mensuel')} du {existing.get('review_date', '')} complété",
        member_id=existing["member_id"],
        current_user=current_user,
        user_name=body.get("user_name"),
    )

    await db.customer_members.update_one(
        {"id": existing["member_id"]},
        {"$set": {
            "last_annual_review_date": update["completed_date"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Auto-schedule next review: always monthly
    next_date = body.get("next_review_date")
    if not next_date:
        completed_date = datetime.strptime(update["completed_date"], "%Y-%m-%d")
        next_date = (completed_date + relativedelta(months=1)).strftime("%Y-%m-%d")

    if next_date:
        next_review = AnnualReview(
            member_id=existing["member_id"],
            review_date=next_date,
            review_type="monthly",
            status="scheduled"
        )
        doc = next_review.model_dump()
        # Phase 3 Batch 1 — cascade : existing.club_id (single source of truth) > header > fallback Versoix
        doc["club_id"] = existing.get("club_id") or resolve_club_id_or_fallback(
            club_id=club_id,
            current_user=current_user,
            endpoint="/api/annual-reviews/complete",
        )
        await db.annual_reviews.insert_one(doc)

        await db.customer_members.update_one(
            {"id": existing["member_id"]},
            {"$set": {"annual_review_date": next_date}}
        )

    return await db.annual_reviews.find_one({"id": review_id}, {"_id": 0})


@router.post("/{review_id}/skip")
async def skip_review(
    review_id: str,
    body: dict = {},
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Skip a review - mark as skipped, log activity, auto-schedule next one"""
    existing = await db.annual_reviews.find_one({"id": review_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Bilan introuvable")

    now = datetime.now(timezone.utc)
    reason = body.get("reason", "")
    user_name = body.get("user_name", "Utilisateur")

    # Mark as skipped
    await db.annual_reviews.update_one(
        {"id": review_id},
        {"$set": {
            "status": "skipped",
            "skip_reason": reason,
            "skipped_by": user_name,
            "skipped_date": now.strftime("%Y-%m-%d"),
            "updated_at": now.isoformat(),
        }}
    )

    # Log activity on the member
    await log_activity(
        db,
        action="bilan_skipped",
        description=f"Bilan {existing.get('review_type', 'mensuel')} du {existing.get('review_date', '')} skipé" + (f" — Raison : {reason}" if reason else ""),
        member_id=existing["member_id"],
        current_user=current_user,
        user_name=user_name,
    )

    # Auto-schedule next review based on frequency
    member = await db.customer_members.find_one({"id": existing["member_id"]}, {"_id": 0})
    freq = (member or {}).get("review_frequency", "monthly")
    delta = FREQUENCY_MAP.get(freq, FREQUENCY_MAP["monthly"])

    review_date = datetime.strptime(existing["review_date"], "%Y-%m-%d")
    next_date = review_date + delta

    next_review = AnnualReview(
        member_id=existing["member_id"],
        review_date=next_date.strftime("%Y-%m-%d"),
        review_type=freq,
        status="scheduled",
    )
    doc = next_review.model_dump()
    # Phase 3 Batch 1 — cascade : existing.club_id (single source of truth) > header > fallback Versoix
    doc["club_id"] = existing.get("club_id") or resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/annual-reviews/skip",
    )
    await db.annual_reviews.insert_one(doc)

    await db.customer_members.update_one(
        {"id": existing["member_id"]},
        {"$set": {"annual_review_date": next_date.strftime("%Y-%m-%d")}}
    )

    return await db.annual_reviews.find_one({"id": review_id}, {"_id": 0})


@router.delete("/{review_id}")
async def delete_review(review_id: str):
    result = await db.annual_reviews.delete_one({"id": review_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bilan introuvable")
    return {"message": "Bilan supprimé"}
