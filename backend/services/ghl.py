"""GoHighLevel API integration service"""
import os
import re
import httpx
from datetime import datetime, timezone
from typing import Optional
import logging

logger = logging.getLogger(__name__)

GHL_BASE = "https://services.leadconnectorhq.com"
GHL_VERSION = "2021-07-28"


def _headers():
    return {
        "Authorization": f"Bearer {os.environ.get('GHL_API_KEY', '')}",
        "Content-Type": "application/json",
        "Version": GHL_VERSION,
        "Accept": "application/json",
    }


def _location_id():
    return os.environ.get("GHL_LOCATION_ID", "")


async def get_pipelines():
    """Fetch all pipelines for the location"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{GHL_BASE}/opportunities/pipelines",
            headers=_headers(),
            params={"locationId": _location_id()},
        )
        resp.raise_for_status()
        return resp.json().get("pipelines", [])


async def search_opportunities(pipeline_id: str, page: int = 1, limit: int = 100):
    """Search opportunities in a pipeline"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{GHL_BASE}/opportunities/search",
            headers=_headers(),
            params={
                "location_id": _location_id(),
                "pipeline_id": pipeline_id,
                "limit": limit,
                "page": page,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("opportunities", []), data.get("meta", {})


GHL_TO_FUNNEL = {
    "new leads": "new_leads",
    "confirmed appointment": "confirmed_appointment",
    "confirmed appointments": "confirmed_appointment",
    "cancelled appointments": "cancelled",
    "cancelled appointment": "cancelled",
    "cancelled": "cancelled",
    "no showed": "no_showed",
    "no show": "no_showed",
    "showed sold": "showed_sold",
    "showed - sold": "showed_sold",
    "showed lost": "showed_lost",
    "showed - lost": "showed_lost",
}


def _normalize_stage_name(name: str) -> str:
    """Strip emojis and special chars from stage name for matching"""
    cleaned = re.sub(r'[^\w\s-]', '', name).strip().lower()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned


def _parse_opp_date(opp: dict) -> Optional[datetime]:
    """Parse the createdAt date from an opportunity"""
    date_str = opp.get("createdAt") or opp.get("dateAdded") or ""
    if not date_str:
        return None
    try:
        if "T" in date_str:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return datetime.strptime(date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def _filter_opps_by_date(opps: list, start_date: Optional[str], end_date: Optional[str]) -> list:
    """Filter opportunities by date range"""
    if not start_date and not end_date:
        return opps

    start_dt = None
    end_dt = None
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except ValueError:
            pass

    filtered = []
    for opp in opps:
        opp_date = _parse_opp_date(opp)
        if opp_date is None:
            # Include opps with no date if no strict filter
            continue
        if start_dt and opp_date < start_dt:
            continue
        if end_dt and opp_date > end_dt:
            continue
        filtered.append(opp)
    return filtered


async def sync_pipeline_data(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """
    Sync all pipeline data from GHL with optional date filtering.
    start_date/end_date format: YYYY-MM-DD
    """
    pipelines = await get_pipelines()
    if not pipelines:
        return {"error": "No pipelines found", "pipelines": []}

    results = []
    for pipeline in pipelines:
        pipeline_id = pipeline.get("id")
        pipeline_name = pipeline.get("name", "Unknown")
        stages = pipeline.get("stages", [])

        # Fetch ALL opportunities for this pipeline (paginated)
        all_opps = []
        page = 1
        while True:
            opps, meta = await search_opportunities(pipeline_id, page=page, limit=100)
            all_opps.extend(opps)
            total = meta.get("total", 0)
            if len(all_opps) >= total or not opps:
                break
            page += 1

        # Filter by date if specified
        filtered_opps = _filter_opps_by_date(all_opps, start_date, end_date)

        # Count opportunities per stage
        stage_counts = {}
        stage_opps = {}
        for opp in filtered_opps:
            stage_id = opp.get("pipelineStageId", "")
            stage_counts[stage_id] = stage_counts.get(stage_id, 0) + 1
            if stage_id not in stage_opps:
                stage_opps[stage_id] = []
            stage_opps[stage_id].append({
                "id": opp.get("id"),
                "name": opp.get("name", ""),
                "contact_id": opp.get("contactId", ""),
                "monetary_value": opp.get("monetaryValue", 0),
                "status": opp.get("status", ""),
                "created_at": opp.get("createdAt", ""),
                "stage_id": stage_id,
            })

        # Map GHL stages to our funnel
        funnel = {
            "new_leads": 0,
            "confirmed_appointment": 0,
            "cancelled": 0,
            "no_showed": 0,
            "showed_sold": 0,
            "showed_lost": 0,
        }
        funnel_opps = {k: [] for k in funnel}

        for stage in stages:
            stage_name = _normalize_stage_name(stage.get("name", ""))
            stage_id = stage.get("id")
            funnel_key = GHL_TO_FUNNEL.get(stage_name)
            if funnel_key:
                funnel[funnel_key] = stage_counts.get(stage_id, 0)
                funnel_opps[funnel_key] = stage_opps.get(stage_id, [])

        results.append({
            "pipeline_id": pipeline_id,
            "pipeline_name": pipeline_name,
            "stages": [{"id": s.get("id"), "name": s.get("name")} for s in stages],
            "funnel": funnel,
            "funnel_opportunities": funnel_opps,
            "total_opportunities": len(filtered_opps),
            "total_unfiltered": len(all_opps),
            "synced_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "pipelines": results,
        "start_date": start_date,
        "end_date": end_date,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }
