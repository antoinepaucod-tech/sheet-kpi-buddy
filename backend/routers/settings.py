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


# ── Seed Default Types ───────────────────────────────────────────────────────

@router.post("/seed-defaults")
async def seed_default_types():
    """Seed default membership and member types if not exist"""
    
    # Default membership types
    default_memberships = [
        {"name": "Mensuel", "duration_months": 1, "price": 150, "is_recurring": True, "display_order": 1, "color": "#3b82f6"},
        {"name": "Trimestriel", "duration_months": 3, "price": 400, "is_recurring": True, "display_order": 2, "color": "#8b5cf6"},
        {"name": "Semestriel", "duration_months": 6, "price": 750, "is_recurring": True, "display_order": 3, "color": "#06b6d4"},
        {"name": "Annuel", "duration_months": 12, "price": 1200, "is_recurring": True, "display_order": 4, "color": "#10b981"},
        {"name": "6 Weeks Challenge", "duration_months": 0, "duration_days": 42, "price": 299, "is_recurring": False, "display_order": 5, "color": "#f59e0b"},
        {"name": "3 Mois", "duration_months": 3, "price": 450, "is_recurring": True, "display_order": 6, "color": "#ec4899"},
        {"name": "6 Semaines", "duration_months": 0, "duration_days": 42, "price": 250, "is_recurring": False, "display_order": 7, "color": "#f97316"},
    ]
    
    # Default member types
    default_member_types = [
        {"name": "Membres Généraux Récurrents", "code": "general", "display_order": 1, "color": "#3b82f6"},
        {"name": "PIF (Paid in Full)", "code": "pif", "display_order": 2, "color": "#10b981"},
        {"name": "PT (Personal Training)", "code": "pt", "display_order": 3, "color": "#f59e0b"},
    ]
    
    membership_created = 0
    member_type_created = 0
    
    for m in default_memberships:
        existing = await db.membership_types.find_one({"name": m["name"]})
        if not existing:
            mt = MembershipType(**m)
            await db.membership_types.insert_one(mt.model_dump())
            membership_created += 1
    
    for mt in default_member_types:
        existing = await db.member_types.find_one({"code": mt["code"]})
        if not existing:
            member_type = MemberType(**mt)
            await db.member_types.insert_one(member_type.model_dump())
            member_type_created += 1
    
    return {
        "message": "Types par défaut créés",
        "membership_types_created": membership_created,
        "member_types_created": member_type_created
    }
