"""GoHighLevel sync routes"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timezone
import logging

from core.config import db
from services.ghl import sync_pipeline_data

router = APIRouter(prefix="/ghl", tags=["ghl"])
logger = logging.getLogger(__name__)


@router.post("/sync")
async def sync_ghl(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    month: Optional[str] = Query(None, description="Target KPI month YYYY-MM"),
):
    """Trigger a manual sync from GoHighLevel pipelines with optional date filter"""
    try:
        data = await sync_pipeline_data(start_date=start_date, end_date=end_date)
    except Exception as e:
        error_msg = str(e)
        logger.error(f"GHL sync failed: {error_msg}")
        await db.ghl_syncs.insert_one({
            "status": "error",
            "error": error_msg,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        })
        raise HTTPException(status_code=502, detail=f"GHL API error: {error_msg}")

    if not data.get("pipelines"):
        raise HTTPException(status_code=404, detail="No pipelines found in GHL")

    # Aggregate funnel from all pipelines
    total_funnel = {
        "new_leads": 0,
        "confirmed_appointment": 0,
        "cancelled": 0,
        "no_showed": 0,
        "showed_sold": 0,
        "showed_lost": 0,
    }
    all_funnel_opps = {k: [] for k in total_funnel}
    total_pipeline_opps = 0

    for p in data["pipelines"]:
        f = p.get("funnel", {})
        for key in total_funnel:
            total_funnel[key] += f.get(key, 0)
        fo = p.get("funnel_opportunities", {})
        for key in all_funnel_opps:
            all_funnel_opps[key].extend(fo.get(key, []))
        total_pipeline_opps += p.get("total_opportunities", 0)

    # "New Leads" = total pipeline opportunities (all leads that entered)
    total_funnel["new_leads"] = total_pipeline_opps

    # Store sync result
    sync_record = {
        "status": "success",
        "funnel": total_funnel,
        "total_opportunities": total_pipeline_opps,
        "funnel_opportunities": all_funnel_opps,
        "start_date": start_date,
        "end_date": end_date,
        "pipelines": [{
            "id": p["pipeline_id"],
            "name": p["pipeline_name"],
            "stages": p["stages"],
            "total_opportunities": p["total_opportunities"],
        } for p in data["pipelines"]],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ghl_syncs.insert_one(sync_record)
    sync_record.pop("_id", None)

    # Update KPI for the target month (from frontend, not from start_date)
    kpi_month = month or datetime.now(timezone.utc).strftime("%Y-%m")

    leads = total_pipeline_opps
    scheduled = total_funnel["confirmed_appointment"] + total_funnel["cancelled"]
    show = total_funnel["showed_sold"] + total_funnel["showed_lost"] + total_funnel["no_showed"]
    close = total_funnel["showed_sold"]

    kpi_update = {
        "leads": leads,
        "scheduled": scheduled,
        "show": show,
        "close": close,
        "sched_percentage": round((scheduled / leads * 100) if leads > 0 else 0, 1),
        "show_percentage": round((show / scheduled * 100) if scheduled > 0 else 0, 1),
        "close_percentage": round((close / show * 100) if show > 0 else 0, 1),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    existing = await db.monthly_kpis.find_one({"month": kpi_month})
    if existing:
        await db.monthly_kpis.update_one({"month": kpi_month}, {"$set": kpi_update})
    else:
        from models.kpi import MonthlyKPI
        kpi = MonthlyKPI(month=kpi_month, **kpi_update)
        await db.monthly_kpis.insert_one(kpi.model_dump())

    return sync_record


@router.get("/last-sync")
async def get_last_sync():
    """Get the most recent sync result"""
    doc = await db.ghl_syncs.find_one(
        {"status": "success"},
        {"_id": 0},
        sort=[("synced_at", -1)],
    )
    if not doc:
        return {"status": "no_sync", "message": "Aucune synchronisation effectuee"}
    return doc


@router.get("/sync-history")
async def get_sync_history():
    """Get sync history (last 20)"""
    docs = await db.ghl_syncs.find(
        {}, {"_id": 0}
    ).sort("synced_at", -1).to_list(20)
    return docs


@router.post("/confirm-sale")
async def confirm_sale(body: dict):
    """Confirm a sale from 'Showed Sold' stage."""
    opportunity_id = body.get("opportunity_id")
    opportunity_name = body.get("opportunity_name", "")
    subscription_type = body.get("subscription_type", "6 Week Challenge")
    cash_collected = body.get("cash_collected", 599)
    month = body.get("month")

    if not opportunity_id:
        raise HTTPException(status_code=400, detail="opportunity_id required")
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")

    sale = {
        "opportunity_id": opportunity_id,
        "opportunity_name": opportunity_name,
        "subscription_type": subscription_type,
        "cash_collected": cash_collected,
        "month": month,
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ghl_sales.insert_one(sale)
    sale.pop("_id", None)

    existing = await db.monthly_kpis.find_one({"month": month})
    if existing:
        new_cash = existing.get("cash_collected", 0) + cash_collected
        close_count = existing.get("close", 0)
        await db.monthly_kpis.update_one(
            {"month": month},
            {"$set": {
                "cash_collected": new_cash,
                "avg_per_sale": round(new_cash / close_count, 2) if close_count > 0 else new_cash,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

    return sale


@router.get("/sales/{month}")
async def get_sales(month: str):
    """Get confirmed sales for a given month"""
    docs = await db.ghl_sales.find(
        {"month": month}, {"_id": 0}
    ).sort("confirmed_at", -1).to_list(1000)
    return docs


@router.patch("/calls-made")
async def update_calls_made(body: dict):
    """Update the calls_made field for a given month"""
    month = body.get("month")
    calls_made = body.get("calls_made", 0)

    if not month:
        raise HTTPException(status_code=400, detail="month required")

    existing = await db.monthly_kpis.find_one({"month": month})
    if not existing:
        from models.kpi import MonthlyKPI
        kpi = MonthlyKPI(month=month, calls_made=calls_made)
        await db.monthly_kpis.insert_one(kpi.model_dump())
    else:
        leads = existing.get("leads", 0)
        call_pct = round((calls_made / leads * 100) if leads > 0 else 0, 1)
        await db.monthly_kpis.update_one(
            {"month": month},
            {"$set": {
                "calls_made": calls_made,
                "call_percentage": call_pct,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    return doc
