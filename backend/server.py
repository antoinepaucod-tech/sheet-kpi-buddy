"""
TRANSFORM - Financial Management Platform
FastAPI backend with fully modular architecture
"""
from fastapi import FastAPI, APIRouter, Depends
from typing import Optional
from starlette.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import asyncio
import logging

# Core imports
from core.config import db, CORS_ORIGINS
from models.kpi import ClubSettings

# Router imports
from routers import (
    auth, members, payments, annual_reviews, followups, onboarding,
    settings, coaches, challenges, kpis, transactions, trainings,
    courses, alerts, reports, notifications, ghl, clubs, meta, franchise, admin, sync, rollover,
    marketing,
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
api_router.include_router(sync.router)
api_router.include_router(rollover.router)
api_router.include_router(marketing.router)


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


# ── APScheduler: Hourly Supabase Sync ────────────────────────────────────────
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()


async def _scheduled_supabase_sync():
    """Wrapper to call sync_all_clubs from scheduler context."""
    from routers.sync import sync_all_clubs
    try:
        await sync_all_clubs()
    except Exception as e:
        logger.error(f"[Scheduler] Supabase sync failed: {e}")


async def _scheduled_daily_rollover():
    """Daily rollover: generate payments, recurring transactions, mark late."""
    from routers.rollover import run_rollover_all_clubs
    try:
        await run_rollover_all_clubs()
    except Exception as e:
        logger.error(f"[Scheduler] Daily rollover failed: {e}")


async def _scheduled_weekly_orphan_audit():
    """Weekly read-only audit of orphan club_id docs across 15 critical collections.
    Sends an email via Resend if orphans detected (kill switch via ORPHAN_AUDIT_RECIPIENT=empty).
    """
    from services.orphan_audit import run_weekly_orphan_audit
    try:
        await run_weekly_orphan_audit(force_email=False)
    except Exception as e:
        logger.error(f"[Scheduler] Weekly orphan audit failed: {e}")


@app.on_event("startup")
async def start_scheduler():
    scheduler.add_job(
        _scheduled_supabase_sync,
        trigger=IntervalTrigger(hours=1),
        id="supabase_sync_hourly",
        replace_existing=True,
    )
    scheduler.add_job(
        _scheduled_daily_rollover,
        trigger=CronTrigger(hour=1, minute=0),
        id="daily_rollover",
        replace_existing=True,
    )
    scheduler.add_job(
        _scheduled_weekly_orphan_audit,
        trigger=CronTrigger(day_of_week="sun", hour=20, minute=0),
        id="weekly_orphan_audit",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "[Scheduler] APScheduler started — Supabase sync every 1h, Daily rollover at 01:00 UTC, "
        "Weekly orphan audit Sun 20:00 UTC."
    )
