"""Club management routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from core.config import db
from core.security import get_current_user
from models.auth import Club

router = APIRouter(prefix="/clubs", tags=["clubs"])


@router.get("")
async def get_clubs(current_user: dict = Depends(get_current_user)):
    """Get clubs accessible to the current user"""
    if current_user.get("role") == "super_admin":
        clubs = await db.clubs.find({"is_active": True}, {"_id": 0}).to_list(50)
    else:
        club_ids = current_user.get("club_ids", [])
        clubs = await db.clubs.find({"id": {"$in": club_ids}, "is_active": True}, {"_id": 0}).to_list(50)
    return clubs


@router.post("")
async def create_club(data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new club (super_admin only)"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin requis")

    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nom du club requis")

    slug = name.lower().replace(" ", "-").replace(".", "")
    existing = await db.clubs.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=400, detail="Ce club existe déjà")

    club = Club(name=name, slug=slug)
    doc = club.model_dump()
    await db.clubs.insert_one(doc)
    doc.pop("_id", None)

    # Add to super_admin's club_ids
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$addToSet": {"club_ids": doc["id"]}}
    )

    return doc


@router.put("/switch")
async def switch_active_club(data: dict, current_user: dict = Depends(get_current_user)):
    """Switch the active club for the current user"""
    club_id = data.get("club_id")
    if not club_id:
        raise HTTPException(status_code=400, detail="club_id requis")

    # Verify access
    if current_user.get("role") != "super_admin" and club_id not in current_user.get("club_ids", []):
        raise HTTPException(status_code=403, detail="Accès refusé à ce club")

    # Verify club exists
    club = await db.clubs.find_one({"id": club_id}, {"_id": 0})
    if not club:
        raise HTTPException(status_code=404, detail="Club introuvable")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"active_club_id": club_id, "club_name": club["name"]}}
    )

    return {"message": "Club actif changé", "club_id": club_id, "club_name": club["name"]}
