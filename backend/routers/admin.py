"""Admin routes for database export/import between environments"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from datetime import datetime, timezone

from core.config import db
from core.security import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

# Collections to export/import
COLLECTIONS = [
    "clubs", "users", "customer_members", "coaches",
    "payments", "payment_schedules", "monthly_kpis", "accounting_categories",
    "accounting_transactions", "annual_reviews", "course_types", "course_kpis",
    "weekly_trainings", "club_settings", "membership_types", "member_types",
    "member_followups", "member_renewals", "activity_logs", "ghl_sales",
    "ghl_syncs", "six_weeks_challenges", "challenge_participants",
    "recurring_transactions", "recurring_validations", "excluded_recurring_expenses",
]


@router.get("/export-db")
async def export_database(user=Depends(get_current_user)):
    """Export all collections as JSON (super_admin only)."""
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin requis")

    data = {}
    for col_name in COLLECTIONS:
        docs = await db[col_name].find({}, {"_id": 0}).to_list(50000)
        data[col_name] = docs

    return JSONResponse(content={
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "collections": data
    })


@router.post("/import-db")
async def import_database(payload: dict, user=Depends(get_current_user)):
    """Import collections from JSON export (super_admin only). Replaces existing data."""
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin requis")

    collections = payload.get("collections", {})
    if not collections:
        raise HTTPException(status_code=400, detail="Aucune donnée à importer")

    results = {}
    for col_name, docs in collections.items():
        if col_name not in COLLECTIONS:
            continue
        if not docs:
            results[col_name] = {"imported": 0, "skipped": True}
            continue

        # Clear existing data and insert new
        await db[col_name].delete_many({})
        await db[col_name].insert_many(docs)
        results[col_name] = {"imported": len(docs)}

    return {"message": "Import terminé", "results": results}


@router.post("/orphan-audit/run")
async def trigger_orphan_audit(payload: dict | None = None, user=Depends(get_current_user)):
    """Manual trigger for the weekly orphan audit (super_admin only).

    Body (optional):
      {"trigger_email": true}   # Force send email even if 0 orphan (validation pipeline)
      {"trigger_email": false}  # Run audit but don't send email (dry-test)
    Default: trigger_email=true
    """
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin requis")
    trigger_email = True if payload is None else bool(payload.get("trigger_email", True))
    from services.orphan_audit import run_weekly_orphan_audit
    result = await run_weekly_orphan_audit(force_email=trigger_email, db=db)
    return result
