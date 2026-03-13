"""
TRANSFORM - Financial Management Platform
FastAPI backend with fully modular architecture
"""
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import logging
import random

# Core imports
from core.config import db, CORS_ORIGINS, MONTHS_FR
from core.security import hash_password

# Model imports (for seed data only)
from models.kpi import MonthlyKPI, ClubSettings
from models.transactions import AccountingCategory, AccountingTransaction
from models.members import CustomerMember, WeeklyTraining, AnnualReview
from models.challenges import SixWeeksChallenge, ChallengeParticipant
from models.courses import Instructor, CourseKPI

# Router imports
from routers import (
    auth, members, payments, annual_reviews, followups, onboarding,
    settings, coaches, challenges, kpis, transactions, trainings,
    courses, alerts, reports, notifications, ghl
)

# App setup
app = FastAPI(title="TRANSFORM API", version="3.0.0")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Include all modular routers
api_router.include_router(auth.router)
api_router.include_router(members.router)
api_router.include_router(payments.router)
api_router.include_router(annual_reviews.router)
api_router.include_router(followups.router)
api_router.include_router(onboarding.router)
api_router.include_router(settings.router)
api_router.include_router(coaches.router)
api_router.include_router(challenges.router)
api_router.include_router(kpis.router)
api_router.include_router(transactions.router)
api_router.include_router(trainings.router)
api_router.include_router(courses.router)
api_router.include_router(alerts.router)
api_router.include_router(reports.router)
api_router.include_router(notifications.router)
api_router.include_router(ghl.router)


# ── Settings Routes (Club Settings) ──────────────────────────────────────────

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


# ── Seed & Init Routes ───────────────────────────────────────────────────────

@api_router.get("/init")
async def init_check():
    count = await db.monthly_kpis.count_documents({})
    return {"has_data": count > 0, "months_count": count}


@api_router.post("/seed")
async def seed_data():
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
                member_id=member_id, calendar_year=2024,
                calendar_week=week, trainings_count=random.randint(1, 5)
            )
            await db.weekly_trainings.insert_one(training.model_dump())

    # Challenge
    challenge = SixWeeksChallenge(name="Challenge Hiver 2024", start_date="2024-11-15", end_date="2024-12-27", is_active=True)
    await db.six_weeks_challenges.insert_one(challenge.model_dump())
    for i, member_id in enumerate(member_ids[:5]):
        participant = ChallengeParticipant(
            challenge_id=challenge.id, member_id=member_id,
            member_name=members_raw[i]["name"],
            week1=True, week2=True, week3=i < 4, week4=i < 3, week5=i < 2, week6=i < 1
        )
        await db.challenge_participants.insert_one(participant.model_dump())

    # Instructors
    instructors_data = [
        {"name": "Coach Marc", "email": "marc@club.ch", "hourly_rate": 50, "is_active": True},
        {"name": "Coach Julie", "email": "julie@club.ch", "hourly_rate": 55, "is_active": True},
        {"name": "Coach Alex", "email": "alex@club.ch", "hourly_rate": 45, "is_active": True},
        {"name": "Coach Sarah", "email": "sarah@club.ch", "hourly_rate": 50, "is_active": False},
    ]
    for i in instructors_data:
        await db.instructors.insert_one(Instructor(**i).model_dump())

    # Courses
    courses_data = [
        {"year": 2024, "month": 12, "day_of_week": "Lundi", "time_slot": "07:00", "course_name": "CrossFit Morning", "instructor": "Coach Marc", "max_capacity": 12, "week1_attendance": 10, "week2_attendance": 11, "week3_attendance": 9, "week4_attendance": 12},
        {"year": 2024, "month": 12, "day_of_week": "Lundi", "time_slot": "18:30", "course_name": "CrossFit Soir", "instructor": "Coach Julie", "max_capacity": 15, "week1_attendance": 14, "week2_attendance": 15, "week3_attendance": 13, "week4_attendance": 14},
        {"year": 2024, "month": 12, "day_of_week": "Mardi", "time_slot": "12:00", "course_name": "HIIT Express", "instructor": "Coach Alex", "max_capacity": 10, "week1_attendance": 8, "week2_attendance": 9, "week3_attendance": 7, "week4_attendance": 10},
        {"year": 2024, "month": 12, "day_of_week": "Mercredi", "time_slot": "07:00", "course_name": "CrossFit Morning", "instructor": "Coach Marc", "max_capacity": 12, "week1_attendance": 11, "week2_attendance": 10, "week3_attendance": 12, "week4_attendance": 11},
        {"year": 2024, "month": 12, "day_of_week": "Mercredi", "time_slot": "19:00", "course_name": "Mobility", "instructor": "Coach Julie", "max_capacity": 8, "week1_attendance": 6, "week2_attendance": 7, "week3_attendance": 8, "week4_attendance": 6},
        {"year": 2024, "month": 12, "day_of_week": "Jeudi", "time_slot": "18:30", "course_name": "CrossFit Soir", "instructor": "Coach Alex", "max_capacity": 15, "week1_attendance": 12, "week2_attendance": 14, "week3_attendance": 11, "week4_attendance": 13},
        {"year": 2024, "month": 12, "day_of_week": "Vendredi", "time_slot": "07:00", "course_name": "CrossFit Morning", "instructor": "Coach Marc", "max_capacity": 12, "week1_attendance": 9, "week2_attendance": 10, "week3_attendance": 8, "week4_attendance": 11},
        {"year": 2024, "month": 12, "day_of_week": "Samedi", "time_slot": "09:00", "course_name": "Open Gym", "instructor": "Coach Julie", "max_capacity": 20, "week1_attendance": 15, "week2_attendance": 18, "week3_attendance": 16, "week4_attendance": 17},
    ]
    for c in courses_data:
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
