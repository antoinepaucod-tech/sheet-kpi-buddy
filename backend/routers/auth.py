"""Auth routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from core.config import db
from core.security import (
    hash_password, verify_password, create_access_token, get_current_user
)
from models.auth import User, UserCreate, UserLogin, UserResponse, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    user = User(
        email=data.email.lower(),
        club_name=data.club_name,
        hashed_password=hash_password(data.password)
    )
    await db.users.insert_one(user.model_dump())
    token = create_access_token(user.id, user.email)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, club_name=user.club_name)
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    token = create_access_token(user["id"], user["email"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=user["email"], club_name=user["club_name"])
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)


@router.put("/club-name")
async def update_club_name(body: dict, current_user: dict = Depends(get_current_user)):
    new_name = body.get("club_name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Nom du club requis")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"club_name": new_name}})
    return {"message": "Nom du club mis à jour", "club_name": new_name}
