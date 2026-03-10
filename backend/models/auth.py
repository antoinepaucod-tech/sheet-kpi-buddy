"""User and Authentication models"""
from pydantic import BaseModel, Field
from datetime import datetime, timezone
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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class UserResponse(BaseModel):
    id: str
    email: str
    club_name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
