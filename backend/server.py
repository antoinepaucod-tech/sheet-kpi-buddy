"""
TRANSFORM - Financial Management Platform
FastAPI backend with fully modular architecture
"""
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import logging

# Core imports
from core.config import db, CORS_ORIGINS
from models.kpi import ClubSettings

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
