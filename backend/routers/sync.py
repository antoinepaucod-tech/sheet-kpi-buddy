"""Supabase KPI sync service"""
from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone
import httpx
import os
import logging

from core.config import db
from core.security import get_club_id
from models.kpi import compute_metrics

router = APIRouter(prefix="/sync", tags=["sync"])
logger = logging.getLogger(__name__)

# ── MongoDB club_id → Supabase UUID mapping ──────────────────────────────────
CLUB_MAPPING = {
    "0a327bf5-c759-49eb-87e4-551913f78bdb": "36e06074-f9e6-404c-a81b-ec4350ad76f0",  # Versoix
    "9bfdb209-066d-4d11-b195-a6b9533b8cb8": "e7e40bd1-2be4-47f8-a550-516c98198e48",  # Servette
    "3933cca5-ed80-42b9-ac91-6120f8f06ed4": "50b2ecda-fd4f-4e7e-b971-1a0d9c0d7fe0",  # Grand-Saconnex
    "c6a2bd8b-24ad-4bf5-8de1-50bbf69e2e5c": "60197ffa-fcff-4ee8-8313-baf7902d93eb",  # Lausanne
}

# ── Sync state (in-memory for status endpoint) ───────────────────────────────
_sync_state = {
    "last_sync": None,
    "last_status": "never",
    "last_error": None,
    "synced_rows": 0,
    "clubs_synced": [],
}


def _supabase_headers():
    key = os.environ.get("SUPABASE_ANON_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }


def _build_row(kpi: dict, supabase_club_id: str, total_members: int, total_coaches: int) -> dict:
    """Map a MongoDB monthly_kpi doc to a Supabase club_kpis_live row."""
    return {
        "club_id": supabase_club_id,
        "month": kpi.get("month", ""),
        "total_members": total_members,
        "total_coaches": total_coaches,
        "new_members": kpi.get("new_members", 0),
        "lost_members": kpi.get("lost_members", 0),
        "total_revenue": kpi.get("total_revenue", 0),
        "total_expenses": kpi.get("total_expenses", 0),
        "net_profit": kpi.get("net_profit", 0),
        "churn_rate": kpi.get("churn_rate", 0),
        "ad_spend": kpi.get("ad_spend", 0),
        "leads": kpi.get("leads", 0),
        "cash_collected": kpi.get("cash_collected", 0),
        "roas": kpi.get("roas", 0),
        "cac": kpi.get("cac", 0),
    }


async def _count_active(club_id: str) -> tuple[int, int]:
    """Return (total_members excluding coaches, total_coaches) for a club."""
    active_cond = [
        {"$or": [
            {"exit_date": None},
            {"exit_date": ""},
            {"exit_date": {"$exists": False}},
        ]}
    ]
    coach_cond = {"$or": [
        {"member_type": "coach"},
        {"membership": {"$regex": "THE COACH|VIRTUAL COACH", "$options": "i"}},
    ]}
    coaches = await db.customer_members.count_documents(
        {"club_id": club_id, "$and": active_cond + [coach_cond]}
    )
    total = await db.customer_members.count_documents(
        {"club_id": club_id, "$and": active_cond}
    )
    return total - coaches, coaches


async def sync_club_kpis(club_id: str) -> dict:
    """Sync all monthly KPIs for a single club to Supabase."""
    supabase_id = CLUB_MAPPING.get(club_id)
    if not supabase_id:
        return {"status": "skipped", "reason": f"No Supabase mapping for club {club_id}"}

    supabase_url = os.environ.get("SUPABASE_URL", "")
    if not supabase_url:
        return {"status": "error", "reason": "SUPABASE_URL not configured"}

    docs = await db.monthly_kpis.find({"club_id": club_id}, {"_id": 0}).to_list(36)
    if not docs:
        return {"status": "skipped", "reason": "No KPI data found"}

    total_members, total_coaches = await _count_active(club_id)
    rows = [_build_row(compute_metrics(d), supabase_id, total_members, total_coaches) for d in docs]

    url = f"{supabase_url}/rest/v1/club_kpis_live?on_conflict=club_id,month"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=rows, headers=_supabase_headers())

    if resp.status_code in (200, 201):
        return {"status": "ok", "rows_upserted": len(rows)}
    else:
        return {"status": "error", "code": resp.status_code, "body": resp.text}


async def sync_all_clubs():
    """Sync KPIs for ALL mapped clubs — used by the scheduler."""
    logger.info("[Supabase Sync] Starting scheduled sync for all clubs...")
    results = {}
    clubs_ok = []
    total_rows = 0

    for mongo_id in CLUB_MAPPING:
        result = await sync_club_kpis(mongo_id)
        results[mongo_id] = result
        if result.get("status") == "ok":
            clubs_ok.append(mongo_id)
            total_rows += result.get("rows_upserted", 0)

    _sync_state["last_sync"] = datetime.now(timezone.utc).isoformat()
    _sync_state["last_status"] = "ok" if clubs_ok else "error"
    _sync_state["last_error"] = None if clubs_ok else str(results)
    _sync_state["synced_rows"] = total_rows
    _sync_state["clubs_synced"] = clubs_ok

    logger.info(f"[Supabase Sync] Done. {len(clubs_ok)} clubs synced, {total_rows} rows upserted.")
    return results


async def trigger_sync_for_club(club_id: str):
    """Fire-and-forget sync for a single club after KPI recalculation."""
    try:
        result = await sync_club_kpis(club_id)
        if result.get("status") == "ok":
            _sync_state["last_sync"] = datetime.now(timezone.utc).isoformat()
            _sync_state["last_status"] = "ok"
            _sync_state["last_error"] = None
            _sync_state["synced_rows"] = result.get("rows_upserted", 0)
            _sync_state["clubs_synced"] = [club_id]
            logger.info(f"[Supabase Sync] Club {club_id}: {result['rows_upserted']} rows upserted.")
        else:
            logger.warning(f"[Supabase Sync] Club {club_id}: {result}")
    except Exception as e:
        logger.error(f"[Supabase Sync] Error for club {club_id}: {e}")


# ── API Endpoints ─────────────────────────────────────────────────────────────

@router.post("/supabase")
async def manual_sync(club_id: Optional[str] = Depends(get_club_id)):
    """Manually trigger Supabase sync for the current club or all clubs."""
    if club_id:
        result = await sync_club_kpis(club_id)
        if result.get("status") == "ok":
            _sync_state["last_sync"] = datetime.now(timezone.utc).isoformat()
            _sync_state["last_status"] = "ok"
            _sync_state["last_error"] = None
            _sync_state["synced_rows"] = result.get("rows_upserted", 0)
            _sync_state["clubs_synced"] = [club_id]
        return result
    else:
        results = await sync_all_clubs()
        return results


@router.post("/supabase/all")
async def manual_sync_all():
    """Manually trigger Supabase sync for ALL mapped clubs."""
    return await sync_all_clubs()


@router.get("/status")
async def get_sync_status():
    """Return current sync status."""
    return {
        "last_sync": _sync_state["last_sync"],
        "status": _sync_state["last_status"],
        "last_error": _sync_state["last_error"],
        "synced_rows": _sync_state["synced_rows"],
        "clubs_synced": _sync_state["clubs_synced"],
        "mapping": {k: v for k, v in CLUB_MAPPING.items()},
    }
