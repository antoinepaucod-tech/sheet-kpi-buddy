"""Reviews (Bilans/Suivis) routes"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta

from core.config import db
from models.members import AnnualReview, AnnualReviewCreate

router = APIRouter(prefix="/annual-reviews", tags=["reviews"])

FREQUENCY_MAP = {
    "monthly": relativedelta(months=1),
    "quarterly": relativedelta(months=3),
    "semi-annually": relativedelta(months=6),
    "annually": relativedelta(years=1),
}

FREQUENCY_LABELS = {
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
    year: Optional[int] = None
):
    query = {}
    if member_id:
        query["member_id"] = member_id
    if status:
        query["status"] = status
    if review_type:
        query["review_type"] = review_type
    if year:
        query["review_date"] = {"$regex": f"^{year}"}

    docs = await db.annual_reviews.find(query, {"_id": 0}).sort("review_date", -1).to_list(500)

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
async def get_upcoming_reviews(days: int = 30):
    """Get reviews scheduled in the next N days"""
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days)

    docs = await db.annual_reviews.find({
        "review_date": {"$gte": today.isoformat(), "$lte": end_date.isoformat()},
        "status": "scheduled"
    }, {"_id": 0}).sort("review_date", 1).to_list(100)

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


@router.get("/overdue")
async def get_overdue_reviews():
    """Get reviews that are past due date and still scheduled"""
    today = datetime.now(timezone.utc).date().isoformat()

    docs = await db.annual_reviews.find({
        "review_date": {"$lt": today},
        "status": "scheduled"
    }, {"_id": 0}).sort("review_date", 1).to_list(100)

    for doc in docs:
        member = await db.customer_members.find_one(
            {"id": doc["member_id"]}, {"_id": 0, "name": 1}
        )
        if member:
            doc["member_name"] = member.get("name", "")

    return docs


@router.get("/{review_id}")
async def get_review(review_id: str):
    doc = await db.annual_reviews.find_one({"id": review_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Bilan introuvable")

    member = await db.customer_members.find_one({"id": doc["member_id"]}, {"_id": 0})
    if member:
        doc["member"] = member

    return doc


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


@router.post("")
async def create_review(data: AnnualReviewCreate):
    review = AnnualReview(**data.model_dump())
    doc = review.model_dump()
    await db.annual_reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{review_id}")
async def update_review(review_id: str, body: dict):
    existing = await db.annual_reviews.find_one({"id": review_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Bilan introuvable")

    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.annual_reviews.update_one({"id": review_id}, {"$set": body})
    return await db.annual_reviews.find_one({"id": review_id}, {"_id": 0})


@router.post("/{review_id}/complete")
async def complete_review(review_id: str, body: dict):
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

    await db.customer_members.update_one(
        {"id": existing["member_id"]},
        {"$set": {
            "last_annual_review_date": update["completed_date"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Auto-schedule next review based on frequency
    next_date = body.get("next_review_date")
    if not next_date:
        member = await db.customer_members.find_one(
            {"id": existing["member_id"]}, {"_id": 0}
        )
        if member and member.get("annual_review_enabled"):
            freq = member.get("review_frequency", existing.get("review_type", "annually"))
            delta = FREQUENCY_MAP.get(freq, relativedelta(years=1))
            completed_date = datetime.strptime(update["completed_date"], "%Y-%m-%d")
            next_date = (completed_date + delta).strftime("%Y-%m-%d")

    if next_date:
        review_type = existing.get("review_type", "annually")
        next_review = AnnualReview(
            member_id=existing["member_id"],
            review_date=next_date,
            review_type=review_type,
            status="scheduled"
        )
        await db.annual_reviews.insert_one(next_review.model_dump())

        await db.customer_members.update_one(
            {"id": existing["member_id"]},
            {"$set": {"annual_review_date": next_date}}
        )

    return await db.annual_reviews.find_one({"id": review_id}, {"_id": 0})


@router.delete("/{review_id}")
async def delete_review(review_id: str):
    result = await db.annual_reviews.delete_one({"id": review_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bilan introuvable")
    return {"message": "Bilan supprimé"}
