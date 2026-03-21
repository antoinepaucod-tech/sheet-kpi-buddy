"""Meta (Facebook) Marketing API service - Ad Spend tracking"""
import httpx
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

META_GRAPH_URL = "https://graph.facebook.com/v20.0"


def _get_config():
    return {
        "app_id": os.environ.get("META_APP_ID", ""),
        "app_secret": os.environ.get("META_APP_SECRET", ""),
        "access_token": os.environ.get("META_ACCESS_TOKEN", ""),
        "ad_account_id": os.environ.get("META_AD_ACCOUNT_ID", ""),
    }


async def fetch_monthly_ad_spend(year: int, month: int, ad_account_id: str = None) -> dict:
    """Fetch ad spend for a specific month from Meta Insights API."""
    config = _get_config()
    token = config["access_token"]
    account = ad_account_id or config["ad_account_id"]

    if not token or not account:
        return {"error": "Meta credentials not configured", "spend": 0}

    # Build date range for the month
    date_start = f"{year}-{month:02d}-01"
    if month == 12:
        date_end = f"{year + 1}-01-01"
    else:
        date_end = f"{year}-{month + 1:02d}-01"
    # End date should be last day of month
    end_dt = datetime.strptime(date_end, "%Y-%m-%d") - timedelta(days=1)
    date_end = end_dt.strftime("%Y-%m-%d")

    url = f"{META_GRAPH_URL}/act_{account}/insights"
    params = {
        "fields": "spend,impressions,clicks,cpc,cpm",
        "time_range": f'{{"since":"{date_start}","until":"{date_end}"}}',
        "access_token": token,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        results = data.get("data", [])
        if results:
            row = results[0]
            return {
                "month": f"{year}-{month:02d}",
                "spend": float(row.get("spend", 0)),
                "impressions": int(row.get("impressions", 0)),
                "clicks": int(row.get("clicks", 0)),
                "cpc": float(row.get("cpc", 0)),
                "cpm": float(row.get("cpm", 0)),
                "date_start": row.get("date_start"),
                "date_stop": row.get("date_stop"),
            }
        return {"month": f"{year}-{month:02d}", "spend": 0, "impressions": 0, "clicks": 0, "cpc": 0, "cpm": 0}

    except httpx.HTTPStatusError as e:
        logger.error(f"Meta API HTTP error: {e.response.status_code} - {e.response.text}")
        return {"error": str(e), "spend": 0, "month": f"{year}-{month:02d}"}
    except Exception as e:
        logger.error(f"Meta API error: {e}")
        return {"error": str(e), "spend": 0, "month": f"{year}-{month:02d}"}


async def fetch_ad_spend_range(date_start: str, date_end: str, time_increment: str = "monthly", ad_account_id: str = None) -> list:
    """Fetch ad spend for a date range with monthly or daily breakdown."""
    config = _get_config()
    token = config["access_token"]
    account = ad_account_id or config["ad_account_id"]

    if not token or not account:
        return []

    url = f"{META_GRAPH_URL}/act_{account}/insights"
    params = {
        "fields": "spend,impressions,clicks,cpc,cpm",
        "time_range": f'{{"since":"{date_start}","until":"{date_end}"}}',
        "time_increment": time_increment,
        "access_token": token,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        results = []
        for row in data.get("data", []):
            results.append({
                "month": row.get("date_start", "")[:7],
                "spend": float(row.get("spend", 0)),
                "impressions": int(row.get("impressions", 0)),
                "clicks": int(row.get("clicks", 0)),
                "cpc": float(row.get("cpc", 0)),
                "cpm": float(row.get("cpm", 0)),
                "date_start": row.get("date_start"),
                "date_stop": row.get("date_stop"),
            })
        return results

    except Exception as e:
        logger.error(f"Meta API range error: {e}")
        return []


async def sync_meta_ad_spend_to_kpis(db, club_id: str = None):
    """
    Sync Meta ad spend data into monthly_kpis collection.
    Updates the ad_spend field for each month that has Meta data.
    """
    config = _get_config()
    if not config["access_token"] or not config["ad_account_id"]:
        return {"error": "Meta credentials not configured", "synced": 0}

    # Fetch data from Jan 2024 to now
    now = datetime.now(timezone.utc)
    date_start = "2024-01-01"
    date_end = now.strftime("%Y-%m-%d")

    data = await fetch_ad_spend_range(date_start, date_end, "monthly")

    synced = 0
    for row in data:
        month = row["month"]
        spend = row["spend"]

        query = {"month": month}
        if club_id:
            query["club_id"] = club_id

        existing = await db.monthly_kpis.find_one(query)
        if existing:
            await db.monthly_kpis.update_one(
                query,
                {"$set": {
                    "ad_spend": spend,
                    "meta_impressions": row.get("impressions", 0),
                    "meta_clicks": row.get("clicks", 0),
                    "meta_cpc": row.get("cpc", 0),
                    "meta_cpm": row.get("cpm", 0),
                    "meta_synced_at": now.isoformat(),
                }}
            )
            synced += 1
            logger.info(f"Synced Meta ad spend for {month}: {spend} CHF")

    return {"synced": synced, "total_months": len(data), "data": data}


async def exchange_for_long_lived_token(short_token: str = None) -> dict:
    """Exchange a short-lived token for a long-lived one (60 days)."""
    config = _get_config()
    token = short_token or config["access_token"]

    url = f"{META_GRAPH_URL}/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": config["app_id"],
        "client_secret": config["app_secret"],
        "fb_exchange_token": token,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        return {
            "access_token": data.get("access_token"),
            "token_type": data.get("token_type"),
            "expires_in": data.get("expires_in"),
            "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 0))).isoformat(),
        }
    except Exception as e:
        logger.error(f"Token exchange error: {e}")
        return {"error": str(e)}
