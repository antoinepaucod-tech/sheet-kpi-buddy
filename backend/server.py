"""
TRANSFORM - Financial Management Platform
FastAPI backend with fully modular architecture
"""
from fastapi import FastAPI, APIRouter, Depends
from typing import Optional
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
    courses, alerts, reports, notifications, ghl, clubs, meta, franchise, admin
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
api_router.include_router(clubs.router)
api_router.include_router(meta.router)
api_router.include_router(franchise.router)
api_router.include_router(admin.router)


from core.security import get_club_id as _get_club_id


# ── Settings Routes (Club Settings) ──────────────────────────────────────────

@api_router.get("/settings")
async def get_settings(x_club_id: Optional[str] = Depends(_get_club_id)):
    query = {"id": "default"}
    if x_club_id:
        query = {"club_id": x_club_id}
    doc = await db.club_settings.find_one(query, {"_id": 0})
    if not doc:
        default = ClubSettings()
        payload = {"id": "default", **default.model_dump()}
        if x_club_id:
            payload["club_id"] = x_club_id
        await db.club_settings.insert_one(payload)
        payload.pop("_id", None)
        return payload
    return doc


@api_router.put("/settings")
async def update_settings(data: ClubSettings, x_club_id: Optional[str] = Depends(_get_club_id)):
    data.updated_at = datetime.now(timezone.utc).isoformat()
    payload = {"id": "default", **data.model_dump()}
    if x_club_id:
        payload["club_id"] = x_club_id
        await db.club_settings.replace_one({"club_id": x_club_id}, payload, upsert=True)
    else:
        await db.club_settings.replace_one({"id": "default"}, payload, upsert=True)
    payload.pop("_id", None)
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
