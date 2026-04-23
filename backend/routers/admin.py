"""Admin routes for database export/import between environments"""
import os
import glob
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse, FileResponse
from datetime import datetime, timezone

from core.config import db
from core.security import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

# Collections to export/import
COLLECTIONS = [
    "clubs", "users", "customer_members", "coaches", "instructors",
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

@router.get("/download-backup")
async def download_backup(
    token: str = Query(..., description="One-time backup download token from .env"),
    file: str = Query(None, description="Specific backup filename (defaults to latest)"),
):
    """Download a backup ZIP from /app/backups/.
    
    Protected by BACKUP_DOWNLOAD_TOKEN env var (must match token query param).
    If `file` is provided, downloads that specific file (must match *.zip in /app/backups).
    Otherwise, downloads the most recent *.zip by mtime.
    This endpoint is intentionally temporary — remove after migration is complete.
    """
    expected = os.environ.get("BACKUP_DOWNLOAD_TOKEN", "")
    if not expected or token != expected:
        raise HTTPException(status_code=403, detail="Invalid or missing token")

    backup_dir = "/app/backups"
    if not os.path.isdir(backup_dir):
        raise HTTPException(status_code=404, detail="Backup directory not found")

    if file:
        # Security: restrict to basename + *.zip
        if "/" in file or ".." in file or not file.endswith(".zip"):
            raise HTTPException(status_code=400, detail="Invalid file name")
        target = os.path.join(backup_dir, file)
        if not os.path.isfile(target):
            raise HTTPException(status_code=404, detail=f"Backup file not found: {file}")
        return FileResponse(path=target, media_type="application/zip", filename=file)

    # Find the most recent *.zip by mtime
    candidates = sorted(
        glob.glob(os.path.join(backup_dir, "*.zip")),
        key=os.path.getmtime,
        reverse=True,
    )
    if not candidates:
        raise HTTPException(status_code=404, detail="No backup ZIP found in /app/backups")

    latest = candidates[0]
    filename = os.path.basename(latest)
    return FileResponse(
        path=latest,
        media_type="application/zip",
        filename=filename,
    )


@router.get("/backup-status")
async def backup_status(token: str = Query(...)):
    """List available backup ZIPs (protected by token)."""
    expected = os.environ.get("BACKUP_DOWNLOAD_TOKEN", "")
    if not expected or token != expected:
        raise HTTPException(status_code=403, detail="Invalid or missing token")

    backup_dir = "/app/backups"
    if not os.path.isdir(backup_dir):
        return {"backups": [], "count": 0}

    files = []
    for path in sorted(glob.glob(os.path.join(backup_dir, "*.zip")), key=os.path.getmtime, reverse=True):
        stat = os.stat(path)
        files.append({
            "filename": os.path.basename(path),
            "size_bytes": stat.st_size,
            "size_human": f"{stat.st_size / 1024:.1f} KB",
            "mtime_iso": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return {"backups": files, "count": len(files), "backup_dir": backup_dir}

