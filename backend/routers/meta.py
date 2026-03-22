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


@router.get("/token-info")
async def get_meta_token_info(current_user: dict = Depends(get_current_user)):
    """Get Meta token debug info including expiration date."""
    import os
    import httpx

    if current_user.get("role") != "super_admin":
        return {"error": "Accès réservé au Super Admin"}

    token = os.environ.get("META_ACCESS_TOKEN", "")
    app_id = os.environ.get("META_APP_ID", "")
    ad_account_id = os.environ.get("META_AD_ACCOUNT_ID", "")

    if not token:
        return {"configured": False, "message": "Aucun token Meta configuré"}

    # Debug the token via Graph API
    try:
        url = f"https://graph.facebook.com/v20.0/debug_token"
        params = {"input_token": token, "access_token": token}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            data = resp.json().get("data", {})

        expires_at = data.get("expires_at", 0)
        is_valid = data.get("is_valid", False)
        scopes = data.get("scopes", [])

        now_ts = int(datetime.now(timezone.utc).timestamp())
        days_remaining = max(0, (expires_at - now_ts) // 86400) if expires_at else 0

        return {
            "configured": True,
            "is_valid": is_valid,
            "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat() if expires_at else None,
            "days_remaining": days_remaining,
            "scopes": scopes,
            "app_id": app_id,
            "ad_account_id": ad_account_id,
            "token_preview": f"{token[:12]}...{token[-6:]}",
        }
    except Exception as e:
        return {
            "configured": True,
            "is_valid": None,
            "error": str(e),
            "app_id": app_id,
            "ad_account_id": ad_account_id,
        }
