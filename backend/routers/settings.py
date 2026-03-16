"""Settings routes - Membership types, Member types, etc."""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone

from core.config import db
from models.settings import (
    MembershipType, MembershipTypeCreate,
    MemberType, MemberTypeCreate
)

router = APIRouter(prefix="/settings", tags=["settings"])


# ── Membership Types (Abonnements) ───────────────────────────────────────────

@router.get("/membership-types")
async def get_membership_types(active_only: Optional[bool] = None):
    """Get all membership types (Mensuel, Trimestriel, Annuel, etc.)"""
    query = {}
    if active_only:
        query["is_active"] = True
    docs = await db.membership_types.find(query, {"_id": 0}).sort("display_order", 1).to_list(100)
    return docs


@router.get("/membership-types/{type_id}")
async def get_membership_type(type_id: str):
    doc = await db.membership_types.find_one({"id": type_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Type d'abonnement introuvable")
    return doc


@router.post("/membership-types")
async def create_membership_type(data: MembershipTypeCreate):
    # Check for duplicate name
    existing = await db.membership_types.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Ce type d'abonnement existe déjà")
    
    membership_type = MembershipType(**data.model_dump())
    doc = membership_type.model_dump()
    await db.membership_types.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/membership-types/{type_id}")
async def update_membership_type(type_id: str, data: MembershipTypeCreate):
    existing = await db.membership_types.find_one({"id": type_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Type d'abonnement introuvable")
    
    update = data.model_dump()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.membership_types.update_one({"id": type_id}, {"$set": update})
    return await db.membership_types.find_one({"id": type_id}, {"_id": 0})


@router.delete("/membership-types/{type_id}")
async def delete_membership_type(type_id: str):
    result = await db.membership_types.delete_one({"id": type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Type d'abonnement introuvable")
    return {"message": "Type d'abonnement supprimé"}


# ── Member Types (Types de membres) ──────────────────────────────────────────

@router.get("/member-types")
async def get_member_types(active_only: Optional[bool] = None):
    """Get all member types (Généraux Récurrents, PIF, PT, etc.)"""
    query = {}
    if active_only:
        query["is_active"] = True
    docs = await db.member_types.find(query, {"_id": 0}).sort("display_order", 1).to_list(100)
    return docs


@router.get("/member-types/{type_id}")
async def get_member_type(type_id: str):
    doc = await db.member_types.find_one({"id": type_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Type de membre introuvable")
    return doc


@router.post("/member-types")
async def create_member_type(data: MemberTypeCreate):
    # Check for duplicate code
    existing = await db.member_types.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Ce code de type existe déjà")
    
    member_type = MemberType(**data.model_dump())
    doc = member_type.model_dump()
    await db.member_types.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/member-types/{type_id}")
async def update_member_type(type_id: str, data: MemberTypeCreate):
    existing = await db.member_types.find_one({"id": type_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Type de membre introuvable")
    
    update = data.model_dump()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.member_types.update_one({"id": type_id}, {"$set": update})
    return await db.member_types.find_one({"id": type_id}, {"_id": 0})


@router.delete("/member-types/{type_id}")
async def delete_member_type(type_id: str):
    result = await db.member_types.delete_one({"id": type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Type de membre introuvable")
    return {"message": "Type de membre supprimé"}




# ── Data Reset ────────────────────────────────────────────────────────────────

TRANSACTIONAL_COLLECTIONS = [
    "customer_members", "member_renewals", "weekly_trainings",
    "six_weeks_challenges", "challenge_participants",
    "course_kpis", "instructors", "coaches",
    "payment_schedules", "payments", "member_followups",
    "annual_reviews", "monthly_kpis",
    "accounting_transactions", "recurring_transactions",
    "excluded_recurring_expenses",
]

KEEP_COLLECTIONS = [
    "users", "club_settings", "accounting_categories",
    "membership_types", "member_types", "kpi_columns",
]


@router.post("/reset-data")
async def reset_transactional_data(body: dict):
    """Reset all transactional data while keeping user account and configuration"""
    confirm = body.get("confirm")
    if confirm != "RESET":
        raise HTTPException(
            status_code=400,
            detail="Confirmation requise. Envoyez {\"confirm\": \"RESET\"}"
        )

    deleted = {}
    for collection_name in TRANSACTIONAL_COLLECTIONS:
        result = await db[collection_name].delete_many({})
        deleted[collection_name] = result.deleted_count

    total = sum(deleted.values())
    return {
        "message": f"Réinitialisation terminée. {total} documents supprimés.",
        "details": deleted,
        "kept": KEEP_COLLECTIONS
    }
