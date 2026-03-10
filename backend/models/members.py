"""Member and subscription models"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class CustomerMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    membership: str  # Type d'abonnement
    member_type: Optional[str] = None  # "Membres Généraux Récurrents", "Membres PIF", "Membres PT"
    contract_signed_date: Optional[str] = None  # Date de signature
    subscription_end_date: Optional[str] = None  # Date d'expiration
    exit_date: Optional[str] = None  # Date de sortie
    cash_collected: float = 0
    # Onboarding flags
    onboarding_bsport: bool = False
    onboarding_hubfit: bool = False
    onboarding_nutrition: bool = False
    questionnaire_coaching: bool = False
    session_introduction: bool = False
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CustomerMemberCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    membership: str
    member_type: Optional[str] = None
    contract_signed_date: Optional[str] = None
    subscription_end_date: Optional[str] = None
    cash_collected: float = 0
    notes: Optional[str] = ""


class MemberRenewalHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    previous_end_date: Optional[str] = None
    new_end_date: str
    renewal_duration: str  # "12 mois", "6 semaines", etc.
    performed_by: Optional[str] = None
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class WeeklyTraining(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    calendar_year: int
    calendar_week: int  # ISO week number (1-53)
    trainings_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class WeeklyTrainingUpdate(BaseModel):
    member_id: str
    calendar_year: int
    calendar_week: int
    trainings_count: int
