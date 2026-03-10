"""Challenge models"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class SixWeeksChallenge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    start_date: str = ""
    end_date: Optional[str] = None
    is_active: bool = True
    challenge_type: str = "fixed"  # "fixed" or "personal"
    checkins_goal: int = 3  # weekly check-in goal
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SixWeeksChallengeCreate(BaseModel):
    name: str
    start_date: str = ""
    end_date: Optional[str] = None
    is_active: bool = True
    challenge_type: str = "fixed"
    checkins_goal: int = 3


class ChallengeParticipant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    challenge_id: str
    member_id: str
    member_name: str
    personal_start_date: Optional[str] = None
    personal_end_date: Optional[str] = None
    week1: bool = False
    week2: bool = False
    week3: bool = False
    week4: bool = False
    week5: bool = False
    week6: bool = False
    week1_checkins: int = 0
    week2_checkins: int = 0
    week3_checkins: int = 0
    week4_checkins: int = 0
    week5_checkins: int = 0
    week6_checkins: int = 0
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ChallengeParticipantCreate(BaseModel):
    challenge_id: str
    member_id: str
    member_name: str
    personal_start_date: Optional[str] = None
    personal_end_date: Optional[str] = None


class ChallengeCheckin(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    week_number: int  # 1-6
    checked: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
