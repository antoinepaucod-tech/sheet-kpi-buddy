"""GoHighLevel API integration service"""
import os
import httpx
from datetime import datetime, timezone
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


import re

def _normalize_stage_name(name: str) -> str:
    """Strip emojis and special chars from stage name for matching"""
    cleaned = re.sub(r'[^\w\s-]', '', name).strip().lower()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned


async def sync_pipeline_data():
    """
    Sync all pipeline data from GHL.
    Returns funnel counts mapped to our stages:
    New Leads -> Confirmed Appointment -> Cancelled -> No Showed -> Showed Sold -> Showed Lost
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

        # Count opportunities per stage
        stage_counts = {}
        stage_opps = {}
        for opp in all_opps:
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
            "total_opportunities": len(all_opps),
            "synced_at": datetime.now(timezone.utc).isoformat(),
        })

    return {"pipelines": results, "synced_at": datetime.now(timezone.utc).isoformat()}
