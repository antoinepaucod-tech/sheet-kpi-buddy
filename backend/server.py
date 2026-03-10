"""
Sheet KPI Buddy - Refactored Server
FastAPI backend with modular architecture
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from io import BytesIO
from calendar import monthrange
import logging
import random

# Core imports
from core.config import db, CORS_ORIGINS, MONTHS_FR, DAYS_FR
from core.security import (
    hash_password, verify_password, create_access_token, get_current_user
)

# Model imports
from models.auth import User, UserCreate, UserLogin, UserResponse, TokenResponse
from models.kpi import MonthlyKPI, MonthlyKPICreate, ClubSettings, compute_metrics
from models.transactions import (
    AccountingCategory, CategoryCreate,
    AccountingTransaction, TransactionCreate,
    ExcludedRecurringExpense, RecurringTransaction, RecurringTransactionCreate
)
from models.members import (
    CustomerMember, CustomerMemberCreate,
    MemberRenewalHistory, WeeklyTraining, WeeklyTrainingUpdate,
    MemberFollowUp, MemberFollowUpCreate,
    AnnualReview, AnnualReviewCreate
)
from models.challenges import (
    SixWeeksChallenge, SixWeeksChallengeCreate,
    ChallengeParticipant, ChallengeParticipantCreate
)
from models.courses import Instructor, CourseKPI, CourseKPICreate
from models.payments import (
    PaymentSchedule, PaymentScheduleCreate,
    Payment, PaymentCreate, PaymentUpdate
)

# Router imports
from routers import auth, members, payments, annual_reviews, followups, onboarding

# App setup
app = FastAPI(title="Sheet KPI Buddy API", version="2.1.0")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Include modular routers
api_router.include_router(auth.router)
api_router.include_router(members.router)
api_router.include_router(payments.router)
api_router.include_router(annual_reviews.router)
api_router.include_router(followups.router)
api_router.include_router(onboarding.router)


# ── KPI Routes ───────────────────────────────────────────────────────────────

@api_router.get("/monthly-kpis")
async def get_monthly_kpis():
    docs = await db.monthly_kpis.find({}, {"_id": 0}).sort("month", 1).to_list(1000)
    return [compute_metrics(d) for d in docs]


@api_router.get("/monthly-kpis/{month}")
async def get_monthly_kpi(month: str):
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    return compute_metrics(doc)


@api_router.post("/monthly-kpis")
async def upsert_monthly_kpi(data: MonthlyKPICreate):
    existing = await db.monthly_kpis.find_one({"month": data.month})
    payload = data.model_dump()
    if existing:
        payload['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.monthly_kpis.update_one({"month": data.month}, {"$set": payload})
        doc = await db.monthly_kpis.find_one({"month": data.month}, {"_id": 0})
    else:
        kpi = MonthlyKPI(**payload)
        doc = kpi.model_dump()
        await db.monthly_kpis.insert_one(doc)
        doc.pop('_id', None)
    return compute_metrics(doc)


@api_router.post("/monthly-kpis/bulk")
async def bulk_import_kpis(data: List[dict]):
    """Bulk import KPIs - useful for migrating data"""
    imported, updated = 0, 0
    
    for kpi_data in data:
        month = kpi_data.get("month")
        if not month:
            continue
        
        mapped = {
            "month": month,
            "year": kpi_data.get("year"),
            "month_name": kpi_data.get("month_name", ""),
            "total_revenue": kpi_data.get("total_revenue", 0),
            "revenue_members": kpi_data.get("revenue_members", 0),
            "revenue_coaching": kpi_data.get("revenue_coaching", 0),
            "total_members": kpi_data.get("total_members", kpi_data.get("total_active_members", 0)),
            "new_members": kpi_data.get("new_members", 0),
            "lost_members": kpi_data.get("lost_members", 0),
            "total_expenses": kpi_data.get("total_expenses", 0),
            "marketing_spend": kpi_data.get("marketing_spend", 0),
            "ad_spend": kpi_data.get("ad_spend", 0),
            "loyer": kpi_data.get("loyer", kpi_data.get("rent", 0)),
            "salaires": kpi_data.get("salaires", 0),
            "utilities": kpi_data.get("utilities", 0),
            "other_expenses": kpi_data.get("other_expenses", 0),
            "note": kpi_data.get("note", ""),
        }
        
        existing = await db.monthly_kpis.find_one({"month": month})
        if existing:
            mapped['updated_at'] = datetime.now(timezone.utc).isoformat()
            await db.monthly_kpis.update_one({"month": month}, {"$set": mapped})
            updated += 1
        else:
            kpi = MonthlyKPI(**{k: v for k, v in mapped.items() if v is not None})
            await db.monthly_kpis.insert_one(kpi.model_dump())
            imported += 1
    
    return {"imported": imported, "updated": updated, "total": imported + updated}


@api_router.patch("/monthly-kpis/{month}/note")
async def update_note(month: str, body: dict):
    note = body.get("note", "")
    await db.monthly_kpis.update_one(
        {"month": month},
        {"$set": {"note": note, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    return compute_metrics(doc) if doc else {"error": "Mois introuvable"}


@api_router.post("/monthly-kpis/{month}/recalculate")
async def recalculate_month(month: str):
    cats = await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)
    cat_map = {c["name"]: c["kpi_column"] for c in cats}
    
    txs = await db.accounting_transactions.find(
        {"date": {"$regex": f"^{month}"}}, {"_id": 0}
    ).to_list(1000)
    
    if not txs:
        raise HTTPException(status_code=404, detail="Aucune transaction pour ce mois")
    
    existing = await db.monthly_kpis.find_one({"month": month}, {"_id": 0}) or {}
    totals = {}
    for tx in txs:
        col = cat_map.get(tx["category"])
        if col:
            totals[col] = totals.get(col, 0) + tx["amount"]
    
    merged = dict(existing)
    for col, val in totals.items():
        if val > 0:
            merged[col] = val
    
    total_revenue = merged.get("revenue_members", 0) + merged.get("revenue_coaching", 0)
    total_expenses = sum(merged.get(k, 0) for k in ["loyer", "salaires", "utilities", "marketing_spend", "ad_spend", "other_expenses"])
    
    update = {
        **{k: merged[k] for k in totals if totals[k] > 0},
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": total_revenue - total_expenses,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.monthly_kpis.update_one({"month": month}, {"$set": update})
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    return compute_metrics(doc) if doc else {"error": "Mois introuvable"}


@api_router.post("/monthly-kpis/recalculate-all")
async def recalculate_all():
    months = await db.monthly_kpis.find({}, {"_id": 0, "month": 1}).to_list(1000)
    results = []
    for m in months:
        try:
            await recalculate_month(m["month"])
            results.append({"month": m["month"], "status": "ok"})
        except Exception as e:
            results.append({"month": m["month"], "status": "skipped", "reason": str(e)})
    return {"recalculated": len([r for r in results if r["status"] == "ok"]), "details": results}


# ── Transaction Routes ───────────────────────────────────────────────────────

@api_router.get("/transactions")
async def get_transactions(month: Optional[str] = None):
    query = {}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    docs = await db.accounting_transactions.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return docs


@api_router.post("/transactions")
async def create_transaction(data: TransactionCreate):
    excluded = await db.excluded_recurring_expenses.find_one({
        "category": data.category, "description": data.description
    })
    if excluded:
        raise HTTPException(status_code=400, detail="Cette transaction a été exclue précédemment")
    tx = AccountingTransaction(**data.model_dump())
    doc = tx.model_dump()
    await db.accounting_transactions.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    tx = await db.accounting_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    excl = ExcludedRecurringExpense(
        original_transaction_id=transaction_id,
        category=tx.get('category', ''),
        description=tx.get('description', ''),
        amount=tx.get('amount', 0),
        type=tx.get('type', 'expense'),
        sub_type=tx.get('sub_type')
    )
    await db.excluded_recurring_expenses.insert_one(excl.model_dump())
    await db.accounting_transactions.delete_one({"id": transaction_id})
    return {"message": "Transaction supprimée et ajoutée aux exclusions"}


@api_router.post("/transactions/bulk")
async def bulk_import_transactions(transactions: List[TransactionCreate]):
    imported, skipped = [], []
    for data in transactions:
        excluded = await db.excluded_recurring_expenses.find_one({
            "category": data.category, "description": data.description
        })
        if excluded:
            skipped.append(data.description)
            continue
        tx = AccountingTransaction(**data.model_dump())
        doc = tx.model_dump()
        await db.accounting_transactions.insert_one(doc)
        doc.pop('_id', None)
        imported.append(doc)
    return {"imported": len(imported), "skipped": len(skipped), "transactions": imported}


# ── Category Routes ──────────────────────────────────────────────────────────

@api_router.get("/categories")
async def get_categories():
    return await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)


@api_router.post("/categories")
async def create_category(data: CategoryCreate):
    cat = AccountingCategory(**data.model_dump())
    doc = cat.model_dump()
    await db.accounting_categories.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    result = await db.accounting_categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    return {"message": "Catégorie supprimée"}


# ── Excluded Routes ──────────────────────────────────────────────────────────

@api_router.get("/excluded")
async def get_excluded():
    return await db.excluded_recurring_expenses.find({}, {"_id": 0}).to_list(1000)


@api_router.delete("/excluded/{excluded_id}")
async def remove_from_exclusions(excluded_id: str):
    result = await db.excluded_recurring_expenses.delete_one({"id": excluded_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exclusion introuvable")
    return {"message": "Exclusion supprimée"}


# ── Recurring Transaction Routes ─────────────────────────────────────────────

@api_router.get("/recurring-transactions")
async def get_recurring_transactions():
    return await db.recurring_transactions.find({}, {"_id": 0}).to_list(1000)


@api_router.post("/recurring-transactions")
async def create_recurring_transaction(data: RecurringTransactionCreate):
    rec = RecurringTransaction(**data.model_dump())
    doc = rec.model_dump()
    await db.recurring_transactions.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/recurring-transactions/{rec_id}")
async def update_recurring_transaction(rec_id: str, data: RecurringTransactionCreate):
    existing = await db.recurring_transactions.find_one({"id": rec_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction récurrente introuvable")
    update = {**data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.recurring_transactions.update_one({"id": rec_id}, {"$set": update})
    return await db.recurring_transactions.find_one({"id": rec_id}, {"_id": 0})


@api_router.delete("/recurring-transactions/{rec_id}")
async def delete_recurring_transaction(rec_id: str):
    result = await db.recurring_transactions.delete_one({"id": rec_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction récurrente introuvable")
    return {"message": "Transaction récurrente supprimée"}


@api_router.post("/recurring-transactions/generate/{year}/{month}")
async def generate_monthly_transactions(year: int, month: int):
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mois invalide (1-12)")
    
    recurring = await db.recurring_transactions.find({"is_active": True}, {"_id": 0}).to_list(1000)
    if not recurring:
        raise HTTPException(status_code=404, detail="Aucune transaction récurrente active")
    
    excluded = await db.excluded_recurring_expenses.find({}, {"_id": 0}).to_list(1000)
    excluded_keys = {(e["category"], e["description"]) for e in excluded}
    
    month_str = f"{year}-{month:02d}"
    days_in_month = monthrange(year, month)[1]
    
    created, skipped = [], []
    for rec in recurring:
        if (rec["category"], rec["description"]) in excluded_keys:
            skipped.append(rec["description"])
            continue
        
        day = min(rec.get("recurrence_day", 1), days_in_month)
        tx = AccountingTransaction(
            date=f"{month_str}-{day:02d}",
            description=rec["description"],
            amount=rec["amount"],
            type=rec["type"],
            category=rec["category"],
            sub_type=rec.get("sub_type")
        )
        doc = tx.model_dump()
        await db.accounting_transactions.insert_one(doc)
        doc.pop('_id', None)
        created.append(doc)
    
    return {
        "month": month_str,
        "month_name": MONTHS_FR[month - 1],
        "created": len(created),
        "skipped": len(skipped),
        "transactions": created
    }


# ── Training Routes ──────────────────────────────────────────────────────────

@api_router.get("/trainings")
async def get_trainings(member_id: Optional[str] = None, year: Optional[int] = None, week: Optional[int] = None):
    query = {}
    if member_id:
        query["member_id"] = member_id
    if year:
        query["calendar_year"] = year
    if week:
        query["calendar_week"] = week
    return await db.weekly_trainings.find(query, {"_id": 0}).to_list(5000)


@api_router.post("/trainings")
async def upsert_training(data: WeeklyTrainingUpdate):
    existing = await db.weekly_trainings.find_one({
        "member_id": data.member_id,
        "calendar_year": data.calendar_year,
        "calendar_week": data.calendar_week
    })
    
    if existing:
        await db.weekly_trainings.update_one(
            {"id": existing["id"]},
            {"$set": {"trainings_count": data.trainings_count, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return await db.weekly_trainings.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        training = WeeklyTraining(**data.model_dump())
        doc = training.model_dump()
        await db.weekly_trainings.insert_one(doc)
        doc.pop('_id', None)
        return doc


@api_router.get("/trainings/summary/{member_id}")
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


# ── Challenge Routes ─────────────────────────────────────────────────────────

@api_router.get("/challenges")
async def get_challenges(active_only: Optional[bool] = None):
    query = {"is_active": True} if active_only else {}
    return await db.six_weeks_challenges.find(query, {"_id": 0}).sort("start_date", -1).to_list(100)


@api_router.get("/challenges/{challenge_id}")
async def get_challenge(challenge_id: str):
    doc = await db.six_weeks_challenges.find_one({"id": challenge_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Challenge introuvable")
    
    participants = await db.challenge_participants.find({"challenge_id": challenge_id}, {"_id": 0}).to_list(200)
    doc["participants"] = participants
    doc["participant_count"] = len(participants)
    return doc


@api_router.post("/challenges")
async def create_challenge(data: SixWeeksChallengeCreate):
    challenge = SixWeeksChallenge(**data.model_dump())
    doc = challenge.model_dump()
    await db.six_weeks_challenges.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/challenges/{challenge_id}")
async def update_challenge(challenge_id: str, data: SixWeeksChallengeCreate):
    existing = await db.six_weeks_challenges.find_one({"id": challenge_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Challenge introuvable")
    
    await db.six_weeks_challenges.update_one({"id": challenge_id}, {"$set": data.model_dump()})
    return await db.six_weeks_challenges.find_one({"id": challenge_id}, {"_id": 0})


@api_router.delete("/challenges/{challenge_id}")
async def delete_challenge(challenge_id: str):
    result = await db.six_weeks_challenges.delete_one({"id": challenge_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Challenge introuvable")
    await db.challenge_participants.delete_many({"challenge_id": challenge_id})
    return {"message": "Challenge et participants supprimés"}


@api_router.post("/challenges/{challenge_id}/participants")
async def add_challenge_participant(challenge_id: str, data: ChallengeParticipantCreate):
    challenge = await db.six_weeks_challenges.find_one({"id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge introuvable")
    
    existing = await db.challenge_participants.find_one({
        "challenge_id": challenge_id, "member_id": data.member_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ce membre participe déjà au challenge")
    
    participant = ChallengeParticipant(**data.model_dump())
    doc = participant.model_dump()
    await db.challenge_participants.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/challenges/{challenge_id}/participants/{participant_id}")
async def update_participant_checkins(challenge_id: str, participant_id: str, body: dict):
    existing = await db.challenge_participants.find_one({"id": participant_id, "challenge_id": challenge_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Participant introuvable")
    
    update = {
        "week1": body.get("week1", existing.get("week1", False)),
        "week2": body.get("week2", existing.get("week2", False)),
        "week3": body.get("week3", existing.get("week3", False)),
        "week4": body.get("week4", existing.get("week4", False)),
        "week5": body.get("week5", existing.get("week5", False)),
        "week6": body.get("week6", existing.get("week6", False)),
        "notes": body.get("notes", existing.get("notes", "")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.challenge_participants.update_one({"id": participant_id}, {"$set": update})
    return await db.challenge_participants.find_one({"id": participant_id}, {"_id": 0})


@api_router.delete("/challenges/{challenge_id}/participants/{participant_id}")
async def remove_participant(challenge_id: str, participant_id: str):
    result = await db.challenge_participants.delete_one({"id": participant_id, "challenge_id": challenge_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Participant introuvable")
    return {"message": "Participant retiré du challenge"}


# ── Course Routes ────────────────────────────────────────────────────────────

@api_router.get("/courses")
async def get_courses(year: Optional[int] = None, month: Optional[int] = None):
    query = {}
    if year:
        query["year"] = year
    if month:
        query["month"] = month
    return await db.course_kpis.find(query, {"_id": 0}).sort([("day_of_week", 1), ("time_slot", 1)]).to_list(500)


@api_router.get("/courses/{course_id}")
async def get_course(course_id: str):
    doc = await db.course_kpis.find_one({"id": course_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Cours introuvable")
    return doc


@api_router.post("/courses")
async def create_course(data: CourseKPICreate):
    month_name = MONTHS_FR[data.month - 1] if 1 <= data.month <= 12 else ""
    course = CourseKPI(**data.model_dump(), month_name=month_name)
    doc = course.model_dump()
    await db.course_kpis.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/courses/{course_id}")
async def update_course(course_id: str, body: dict):
    existing = await db.course_kpis.find_one({"id": course_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Cours introuvable")
    
    attendance_fields = ["week1_attendance", "week2_attendance", "week3_attendance", "week4_attendance", "week5_attendance"]
    total_attendance = sum(body.get(f, existing.get(f, 0)) for f in attendance_fields)
    max_capacity = body.get("max_capacity", existing.get("max_capacity", 10))
    weeks_with_data = sum(1 for f in attendance_fields if body.get(f, existing.get(f, 0)) > 0)
    
    if weeks_with_data > 0 and max_capacity > 0:
        attendance_rate = round((total_attendance / (weeks_with_data * max_capacity)) * 100, 1)
    else:
        attendance_rate = 0
    
    body["attendance_rate"] = attendance_rate
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.course_kpis.update_one({"id": course_id}, {"$set": body})
    return await db.course_kpis.find_one({"id": course_id}, {"_id": 0})


@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    result = await db.course_kpis.delete_one({"id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cours introuvable")
    return {"message": "Cours supprimé"}


@api_router.get("/courses/summary/{year}/{month}")
async def get_courses_summary(year: int, month: int):
    docs = await db.course_kpis.find({"year": year, "month": month}, {"_id": 0}).to_list(500)
    
    if not docs:
        return {
            "year": year, "month": month,
            "month_name": MONTHS_FR[month - 1] if 1 <= month <= 12 else "",
            "total_courses": 0, "avg_attendance_rate": 0, "total_expenses": 0, "by_day": {}
        }
    
    avg_attendance = round(sum(d.get("attendance_rate", 0) for d in docs) / len(docs), 1)
    total_expenses = sum(d.get("monthly_expenses", 0) for d in docs)
    
    by_day = {}
    for d in docs:
        day = d.get("day_of_week", "Autre")
        if day not in by_day:
            by_day[day] = {"count": 0, "courses": []}
        by_day[day]["count"] += 1
        by_day[day]["courses"].append(d.get("course_name", ""))
    
    return {
        "year": year, "month": month,
        "month_name": MONTHS_FR[month - 1] if 1 <= month <= 12 else "",
        "total_courses": len(docs),
        "avg_attendance_rate": avg_attendance,
        "total_expenses": total_expenses,
        "by_day": by_day
    }


# ── Instructor Routes ────────────────────────────────────────────────────────

@api_router.get("/instructors")
async def get_instructors(active_only: Optional[bool] = None):
    query = {"is_active": True} if active_only else {}
    return await db.instructors.find(query, {"_id": 0}).sort("name", 1).to_list(100)


@api_router.post("/instructors")
async def create_instructor(body: dict):
    instructor = Instructor(
        name=body.get("name", ""),
        email=body.get("email"),
        hourly_rate=body.get("hourly_rate", 0),
        is_active=body.get("is_active", True)
    )
    doc = instructor.model_dump()
    await db.instructors.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/instructors/{instructor_id}")
async def update_instructor(instructor_id: str, body: dict):
    existing = await db.instructors.find_one({"id": instructor_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Instructeur introuvable")
    
    await db.instructors.update_one({"id": instructor_id}, {"$set": body})
    return await db.instructors.find_one({"id": instructor_id}, {"_id": 0})


@api_router.delete("/instructors/{instructor_id}")
async def delete_instructor(instructor_id: str):
    result = await db.instructors.delete_one({"id": instructor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Instructeur introuvable")
    return {"message": "Instructeur supprimé"}


# ── Email Notification Routes ────────────────────────────────────────────────

@api_router.post("/notifications/send-reminder")
async def send_reminder_email(body: dict):
    """Send a reminder email (payment, follow-up, renewal)"""
    import os
    import asyncio
    
    try:
        import resend
    except ImportError:
        raise HTTPException(status_code=500, detail="Email service not configured")
    
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not configured")
    
    resend.api_key = api_key
    sender_email = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    
    recipient = body.get("recipient_email")
    subject = body.get("subject")
    html_content = body.get("html_content")
    reminder_type = body.get("reminder_type")  # "payment", "followup", "renewal"
    reference_id = body.get("reference_id")
    
    if not all([recipient, subject, html_content]):
        raise HTTPException(status_code=400, detail="recipient_email, subject, and html_content required")
    
    params = {
        "from": sender_email,
        "to": [recipient],
        "subject": subject,
        "html": html_content
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        
        # Update the reminder_sent flag on the relevant record
        if reminder_type == "payment" and reference_id:
            await db.payments.update_one(
                {"id": reference_id},
                {"$set": {
                    "reminder_sent": True,
                    "reminder_sent_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        elif reminder_type == "followup" and reference_id:
            await db.member_followups.update_one(
                {"id": reference_id},
                {"$set": {
                    "reminder_sent": True,
                    "reminder_sent_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return {
            "status": "success",
            "message": f"Email sent to {recipient}",
            "email_id": email.get("id")
        }
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@api_router.get("/alerts/summary")
async def get_alerts_summary():
    """Get summary of all alerts (late payments, missed followups, expiring subscriptions)"""
    today = datetime.now(timezone.utc).date()
    thirty_days = today + timedelta(days=30)
    
    # Late payments
    late_payments = await db.payments.count_documents({
        "due_date": {"$lt": today.isoformat()},
        "status": {"$in": ["pending", "late"]}
    })
    
    # Missed follow-ups
    missed_followups = await db.member_followups.count_documents({
        "followup_date": {"$lt": today.isoformat()},
        "status": {"$in": ["scheduled", "rescheduled"]}
    })
    
    # Expiring subscriptions (30 days)
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
    
    # Incomplete onboarding
    incomplete_onboarding = await db.customer_members.count_documents({
        "onboarding_completed": {"$ne": True},
        "exit_date": None
    })
    
    # Upcoming follow-ups (7 days)
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


# ── Settings Routes ──────────────────────────────────────────────────────────

@api_router.get("/settings")
async def get_settings():
    doc = await db.club_settings.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        default = ClubSettings()
        await db.club_settings.insert_one({"id": "default", **default.model_dump()})
        return {"id": "default", **default.model_dump()}
    return doc


@api_router.put("/settings")
async def update_settings(data: ClubSettings):
    data.updated_at = datetime.now(timezone.utc).isoformat()
    payload = {"id": "default", **data.model_dump()}
    await db.club_settings.replace_one({"id": "default"}, payload, upsert=True)
    return payload


# ── PDF Report Route ─────────────────────────────────────────────────────────

@api_router.get("/report/pdf/{month}")
async def generate_pdf_report(month: str):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    
    kpi = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    if not kpi:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    kpi = compute_metrics(kpi)
    
    txs = await db.accounting_transactions.find({"date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(1000)
    settings = await db.club_settings.find_one({"id": "default"}, {"_id": 0})
    club_name = settings.get("club_name", "Mon Club") if settings else "Mon Club"
    
    year, m = month.split("-")
    month_name = MONTHS_FR[int(m) - 1]
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, alignment=TA_CENTER, spaceAfter=10, textColor=HexColor('#E11D48'))
    subtitle_style = ParagraphStyle('CustomSubtitle', parent=styles['Normal'], fontSize=14, alignment=TA_CENTER, spaceAfter=20, textColor=HexColor('#666666'))
    section_style = ParagraphStyle('SectionTitle', parent=styles['Heading2'], fontSize=14, spaceAfter=10, spaceBefore=15, textColor=HexColor('#333333'))
    
    elements = []
    elements.append(Paragraph(club_name, title_style))
    elements.append(Paragraph(f"Rapport Mensuel - {month_name} {year}", subtitle_style))
    
    def fmt_chf(v):
        return f"{v:,.2f} CHF".replace(",", "'")
    
    # KPI Summary
    elements.append(Paragraph("Résumé des KPIs", section_style))
    kpi_data = [
        ["Indicateur", "Valeur"],
        ["Revenus Totaux", fmt_chf(kpi.get("total_revenue", 0))],
        ["Bénéfice Net", fmt_chf(kpi.get("net_profit", 0))],
        ["Dépenses Totales", fmt_chf(kpi.get("total_expenses", 0))],
        ["Marge Nette", f"{kpi.get('profit_margin', 0):.1f}%"],
        ["Membres Actifs", str(kpi.get("total_members", 0))],
        ["Nouveaux Membres", str(kpi.get("new_members", 0))],
        ["Membres Perdus", str(kpi.get("lost_members", 0))],
        ["Taux de Churn", f"{kpi.get('churn_rate', 0):.2f}%"],
        ["CAC", fmt_chf(kpi.get("cac", 0))],
        ["ROAS", f"{kpi.get('roas', 0):.1f}x"],
    ]
    
    kpi_table = Table(kpi_data, colWidths=[100*mm, 60*mm])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#E11D48')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#F8F8F8')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#DDDDDD')),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(kpi_table)
    
    # Footer
    elements.append(Spacer(1, 15*mm))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=HexColor('#999999'))
    elements.append(Paragraph(f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')} - Sheet KPI Buddy", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"rapport_{club_name.replace(' ', '_')}_{month}.pdf"
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})


# ── Seed & Init Routes ───────────────────────────────────────────────────────

@api_router.get("/init")
async def init_check():
    count = await db.monthly_kpis.count_documents({})
    return {"has_data": count > 0, "months_count": count}


@api_router.post("/seed")
async def seed_data():
    # Drop all collections
    for collection in ["monthly_kpis", "accounting_transactions", "accounting_categories", 
                       "excluded_recurring_expenses", "customer_members", "member_renewals",
                       "weekly_trainings", "six_weeks_challenges", "challenge_participants",
                       "course_kpis", "instructors"]:
        await db[collection].drop()
    
    # Categories
    categories = [
        {"name": "LOYER", "kpi_column": "loyer", "type": "expense", "color": "#3B82F6"},
        {"name": "SALAIRES", "kpi_column": "salaires", "type": "expense", "color": "#8B5CF6"},
        {"name": "UTILITIES", "kpi_column": "utilities", "type": "expense", "color": "#F59E0B"},
        {"name": "MARKETING", "kpi_column": "marketing_spend", "type": "expense", "color": "#E11D48"},
        {"name": "PUBLICITE", "kpi_column": "ad_spend", "type": "expense", "color": "#EC4899"},
        {"name": "COTISATIONS", "kpi_column": "revenue_members", "type": "revenue", "color": "#22C55E"},
        {"name": "COACHING", "kpi_column": "revenue_coaching", "type": "revenue", "color": "#10B981"},
        {"name": "AUTRE", "kpi_column": "other_expenses", "type": "expense", "color": "#6B7280"},
    ]
    for c in categories:
        await db.accounting_categories.insert_one(AccountingCategory(**c).model_dump())
    
    # Monthly KPIs 2024
    months_2024 = [
        {"month": "2024-01", "revenue_members": 42000, "revenue_coaching": 8500, "new_members": 18, "lost_members": 5, "total_members": 142, "marketing_spend": 3200, "ad_spend": 1500, "loyer": 8000, "salaires": 21000, "utilities": 2200, "other_expenses": 1800},
        {"month": "2024-02", "revenue_members": 43500, "revenue_coaching": 9200, "new_members": 22, "lost_members": 7, "total_members": 157, "marketing_spend": 3500, "ad_spend": 1800, "loyer": 8000, "salaires": 21000, "utilities": 2100, "other_expenses": 1600},
        {"month": "2024-03", "revenue_members": 45000, "revenue_coaching": 10500, "new_members": 28, "lost_members": 6, "total_members": 179, "marketing_spend": 4000, "ad_spend": 2200, "loyer": 8000, "salaires": 22000, "utilities": 2300, "other_expenses": 2100},
        {"month": "2024-04", "revenue_members": 46500, "revenue_coaching": 11000, "new_members": 25, "lost_members": 9, "total_members": 195, "marketing_spend": 3800, "ad_spend": 2000, "loyer": 8000, "salaires": 22000, "utilities": 2000, "other_expenses": 1900},
        {"month": "2024-05", "revenue_members": 48000, "revenue_coaching": 12500, "new_members": 31, "lost_members": 11, "total_members": 215, "marketing_spend": 4500, "ad_spend": 2500, "loyer": 8000, "salaires": 23000, "utilities": 1900, "other_expenses": 2200},
        {"month": "2024-06", "revenue_members": 47500, "revenue_coaching": 13000, "new_members": 29, "lost_members": 14, "total_members": 230, "marketing_spend": 4200, "ad_spend": 2300, "loyer": 8000, "salaires": 23000, "utilities": 2500, "other_expenses": 2000},
        {"month": "2024-07", "revenue_members": 44000, "revenue_coaching": 9500, "new_members": 15, "lost_members": 18, "total_members": 227, "marketing_spend": 2800, "ad_spend": 1500, "loyer": 8000, "salaires": 23000, "utilities": 2800, "other_expenses": 1500},
        {"month": "2024-08", "revenue_members": 43000, "revenue_coaching": 8800, "new_members": 12, "lost_members": 16, "total_members": 223, "marketing_spend": 2500, "ad_spend": 1200, "loyer": 8000, "salaires": 23000, "utilities": 2900, "other_expenses": 1400},
        {"month": "2024-09", "revenue_members": 49000, "revenue_coaching": 14000, "new_members": 38, "lost_members": 8, "total_members": 253, "marketing_spend": 5500, "ad_spend": 3000, "loyer": 8000, "salaires": 24000, "utilities": 2200, "other_expenses": 2500},
        {"month": "2024-10", "revenue_members": 51000, "revenue_coaching": 15500, "new_members": 42, "lost_members": 7, "total_members": 288, "marketing_spend": 6000, "ad_spend": 3500, "loyer": 8000, "salaires": 25000, "utilities": 2100, "other_expenses": 2800},
        {"month": "2024-11", "revenue_members": 52500, "revenue_coaching": 16000, "new_members": 38, "lost_members": 9, "total_members": 317, "marketing_spend": 5800, "ad_spend": 3200, "loyer": 8000, "salaires": 25000, "utilities": 2300, "other_expenses": 2600},
        {"month": "2024-12", "revenue_members": 54000, "revenue_coaching": 17500, "new_members": 35, "lost_members": 12, "total_members": 340, "marketing_spend": 5500, "ad_spend": 3000, "loyer": 8000, "salaires": 26000, "utilities": 2600, "other_expenses": 3000},
    ]
    
    for m in months_2024:
        total_rev = m["revenue_members"] + m["revenue_coaching"]
        total_exp = m["loyer"] + m["salaires"] + m["utilities"] + m["marketing_spend"] + m["ad_spend"] + m["other_expenses"]
        kpi = MonthlyKPI(**m, total_revenue=total_rev, total_expenses=total_exp, net_profit=total_rev - total_exp)
        await db.monthly_kpis.insert_one(kpi.model_dump())
    
    # Members
    members_raw = [
        {"name": "Marie Dupont", "email": "marie@example.com", "phone": "+41 79 123 4567", "membership": "Annuel", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-01-15", "subscription_end_date": "2025-01-15", "cash_collected": 1200},
        {"name": "Jean Martin", "email": "jean@example.com", "phone": "+41 79 234 5678", "membership": "Annuel", "member_type": "Membres PIF", "contract_signed_date": "2024-03-01", "subscription_end_date": "2025-03-01", "cash_collected": 1200},
        {"name": "Sophie Bernard", "email": "sophie@example.com", "phone": "+41 79 345 6789", "membership": "6 Mois", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-09-01", "subscription_end_date": "2025-03-01", "cash_collected": 650},
        {"name": "Pierre Leroy", "email": "pierre@example.com", "phone": "+41 79 456 7890", "membership": "Annuel PT", "member_type": "Membres PT", "contract_signed_date": "2024-06-15", "subscription_end_date": "2025-06-15", "cash_collected": 2400},
        {"name": "Emma Richard", "email": "emma@example.com", "phone": "+41 79 567 8901", "membership": "Mensuel", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-12-01", "subscription_end_date": "2025-01-01", "cash_collected": 120},
        {"name": "Lucas Moreau", "email": "lucas@example.com", "phone": "+41 79 678 9012", "membership": "6 Semaines", "member_type": "Membres PIF", "contract_signed_date": "2024-11-15", "subscription_end_date": "2024-12-27", "cash_collected": 180},
        {"name": "Chloé Simon", "email": "chloe@example.com", "phone": "+41 79 789 0123", "membership": "Annuel", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-02-01", "subscription_end_date": "2025-02-01", "cash_collected": 1200},
        {"name": "Thomas Laurent", "email": "thomas@example.com", "phone": "+41 79 890 1234", "membership": "Annuel PT", "member_type": "Membres PT", "contract_signed_date": "2024-04-15", "subscription_end_date": "2025-04-15", "cash_collected": 2400},
        {"name": "Camille Roux", "email": "camille@example.com", "phone": "+41 79 901 2345", "membership": "3 Mois", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-10-01", "subscription_end_date": "2025-01-01", "cash_collected": 350},
        {"name": "Hugo Petit", "email": "hugo@example.com", "phone": "+41 79 012 3456", "membership": "Annuel", "member_type": "Membres PIF", "contract_signed_date": "2024-08-01", "subscription_end_date": "2025-08-01", "cash_collected": 1200},
    ]
    
    member_ids = []
    for m in members_raw:
        member = CustomerMember(**m)
        member_ids.append(member.id)
        await db.customer_members.insert_one(member.model_dump())
    
    # Weekly trainings
    for member_id in member_ids[:6]:
        for week in range(1, 53):
            training = WeeklyTraining(
                member_id=member_id,
                calendar_year=2024,
                calendar_week=week,
                trainings_count=random.randint(1, 5)
            )
            await db.weekly_trainings.insert_one(training.model_dump())
    
    # Challenge
    challenge = SixWeeksChallenge(name="Challenge Hiver 2024", start_date="2024-11-15", end_date="2024-12-27", is_active=True)
    await db.six_weeks_challenges.insert_one(challenge.model_dump())
    
    for i, member_id in enumerate(member_ids[:5]):
        participant = ChallengeParticipant(
            challenge_id=challenge.id,
            member_id=member_id,
            member_name=members_raw[i]["name"],
            week1=True, week2=True, week3=i < 4, week4=i < 3, week5=i < 2, week6=i < 1
        )
        await db.challenge_participants.insert_one(participant.model_dump())
    
    # Instructors
    instructors = [
        {"name": "Coach Marc", "email": "marc@club.ch", "hourly_rate": 50, "is_active": True},
        {"name": "Coach Julie", "email": "julie@club.ch", "hourly_rate": 55, "is_active": True},
        {"name": "Coach Alex", "email": "alex@club.ch", "hourly_rate": 45, "is_active": True},
        {"name": "Coach Sarah", "email": "sarah@club.ch", "hourly_rate": 50, "is_active": False},
    ]
    for i in instructors:
        await db.instructors.insert_one(Instructor(**i).model_dump())
    
    # Courses
    courses = [
        {"year": 2024, "month": 12, "day_of_week": "Lundi", "time_slot": "07:00", "course_name": "CrossFit Morning", "instructor": "Coach Marc", "max_capacity": 12, "week1_attendance": 10, "week2_attendance": 11, "week3_attendance": 9, "week4_attendance": 12},
        {"year": 2024, "month": 12, "day_of_week": "Lundi", "time_slot": "18:30", "course_name": "CrossFit Soir", "instructor": "Coach Julie", "max_capacity": 15, "week1_attendance": 14, "week2_attendance": 15, "week3_attendance": 13, "week4_attendance": 14},
        {"year": 2024, "month": 12, "day_of_week": "Mardi", "time_slot": "12:00", "course_name": "HIIT Express", "instructor": "Coach Alex", "max_capacity": 10, "week1_attendance": 8, "week2_attendance": 9, "week3_attendance": 7, "week4_attendance": 10},
        {"year": 2024, "month": 12, "day_of_week": "Mercredi", "time_slot": "07:00", "course_name": "CrossFit Morning", "instructor": "Coach Marc", "max_capacity": 12, "week1_attendance": 11, "week2_attendance": 10, "week3_attendance": 12, "week4_attendance": 11},
        {"year": 2024, "month": 12, "day_of_week": "Mercredi", "time_slot": "19:00", "course_name": "Mobility", "instructor": "Coach Julie", "max_capacity": 8, "week1_attendance": 6, "week2_attendance": 7, "week3_attendance": 8, "week4_attendance": 6},
        {"year": 2024, "month": 12, "day_of_week": "Jeudi", "time_slot": "18:30", "course_name": "CrossFit Soir", "instructor": "Coach Alex", "max_capacity": 15, "week1_attendance": 12, "week2_attendance": 14, "week3_attendance": 11, "week4_attendance": 13},
        {"year": 2024, "month": 12, "day_of_week": "Vendredi", "time_slot": "07:00", "course_name": "CrossFit Morning", "instructor": "Coach Marc", "max_capacity": 12, "week1_attendance": 9, "week2_attendance": 10, "week3_attendance": 8, "week4_attendance": 11},
        {"year": 2024, "month": 12, "day_of_week": "Samedi", "time_slot": "09:00", "course_name": "Open Gym", "instructor": "Coach Julie", "max_capacity": 20, "week1_attendance": 15, "week2_attendance": 18, "week3_attendance": 16, "week4_attendance": 17},
    ]
    
    for c in courses:
        attendance_fields = ["week1_attendance", "week2_attendance", "week3_attendance", "week4_attendance"]
        total = sum(c.get(f, 0) for f in attendance_fields)
        weeks = sum(1 for f in attendance_fields if c.get(f, 0) > 0)
        rate = round((total / (weeks * c["max_capacity"])) * 100, 1) if weeks > 0 else 0
        
        course = CourseKPI(**c, month_name=MONTHS_FR[c["month"] - 1], attendance_rate=rate, monthly_expenses=c["max_capacity"] * 25)
        await db.course_kpis.insert_one(course.model_dump())
    
    return {
        "message": "Données de démonstration chargées",
        "months": 12, "members": 10, "instructors": 4, "courses": 8, "challenges": 1
    }


# ── App Setup ────────────────────────────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    from core.config import client
    client.close()
