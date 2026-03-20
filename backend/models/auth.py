"""User and Authentication models"""
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List
import uuid


class UserBase(BaseModel):
    email: str
    club_name: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hashed_password: str
    role: str = "manager"  # "super_admin" | "manager"
    club_ids: List[str] = []  # clubs this user can access
    active_club_id: Optional[str] = None  # currently selected club
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class UserResponse(BaseModel):
    id: str
    email: str
    club_name: str
    role: str = "manager"
    club_ids: List[str] = []
    active_club_id: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class Club(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str  # url-friendly identifier
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_active: bool = True
