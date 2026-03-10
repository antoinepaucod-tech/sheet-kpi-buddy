"""Challenge models"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class SixWeeksChallenge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    start_date: str
    end_date: Optional[str] = None
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SixWeeksChallengeCreate(BaseModel):
    name: str
    start_date: str
    end_date: Optional[str] = None
    is_active: bool = True


class ChallengeParticipant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    challenge_id: str
    member_id: str
    member_name: str
    week1: bool = False
    week2: bool = False
    week3: bool = False
    week4: bool = False
    week5: bool = False
    week6: bool = False
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ChallengeParticipantCreate(BaseModel):
    challenge_id: str
    member_id: str
    member_name: str


class ChallengeCheckin(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    week_number: int  # 1-6
    checked: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
