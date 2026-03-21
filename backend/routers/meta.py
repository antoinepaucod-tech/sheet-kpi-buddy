"""Meta Ads API routes - Ad Spend tracking"""
from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone

from core.config import db
from core.security import get_club_id, get_current_user
from services.meta import (
    fetch_monthly_ad_spend,
    fetch_ad_spend_range,
    sync_meta_ad_spend_to_kpis,
)

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/ad-spend/{year}/{month}")
async def get_meta_ad_spend(year: int, month: int):
    """Get ad spend from Meta for a specific month."""
    return await fetch_monthly_ad_spend(year, month)


@router.get("/ad-spend-range")
async def get_meta_ad_spend_range(
    date_start: str,
    date_end: str,
    time_increment: str = "monthly",
):
    """Get ad spend from Meta for a date range (monthly or daily breakdown)."""
    return await fetch_ad_spend_range(date_start, date_end, time_increment)


@router.post("/sync-ad-spend")
async def sync_ad_spend(club_id: Optional[str] = Depends(get_club_id)):
    """
    Sync Meta ad spend data into KPIs.
    Pulls all monthly ad spend from Meta and updates the ad_spend field in monthly_kpis.
    """
    result = await sync_meta_ad_spend_to_kpis(db, club_id)
    return result


@router.get("/status")
async def get_meta_status():
    """Check Meta API connection status."""
    import os
    has_token = bool(os.environ.get("META_ACCESS_TOKEN"))
    has_account = bool(os.environ.get("META_AD_ACCOUNT_ID"))

    if not has_token or not has_account:
        return {"connected": False, "message": "Meta credentials not configured"}

    # Test the connection
    try:
        now = datetime.now(timezone.utc)
        result = await fetch_monthly_ad_spend(now.year, now.month)
        if "error" in result and result["error"]:
            return {"connected": False, "message": str(result["error"])}
        return {
            "connected": True,
            "ad_account_id": os.environ.get("META_AD_ACCOUNT_ID"),
            "current_month_spend": result.get("spend", 0),
        }
    except Exception as e:
        return {"connected": False, "message": str(e)}
