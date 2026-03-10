"""Coach models"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class Coach(BaseModel):
    """Coach with hourly rate"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    hourly_rate: float = 0  # Taux horaire en CHF
    specialties: List[str] = []  # Ex: ["CrossFit", "Yoga", "HIIT"]
    color: Optional[str] = None  # Couleur pour le planning
    is_active: bool = True
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CoachCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    hourly_rate: float = 0
    specialties: List[str] = []
    color: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class CoachReplacement(BaseModel):
    """Track coach replacements for courses"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    course_id: str
    original_coach_id: str
    replacement_coach_id: str
    date: str  # Date of replacement
    reason: Optional[str] = None  # Ex: "maladie", "absence", "congé"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
