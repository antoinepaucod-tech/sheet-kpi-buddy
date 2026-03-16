"""Membership and subscription types models"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class MembershipType(BaseModel):
    """Type d'abonnement (HYBRID FULL, THE COACH PASS, 6 WEEKS CHALLENGE, etc.)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Ex: "HYBRID FULL - PAIEMENT MENSUEL"
    duration_months: int  # Durée en mois (1, 6, 12, 0 pour packs)
    duration_days: Optional[int] = None  # Pour les durées non standard (42 jours pour 6 weeks)
    price: float = 0  # Prix par défaut
    description: Optional[str] = None
    is_recurring: bool = True  # Abonnement récurrent ou one-time (PIF)
    member_type: str = "Membres Généraux Récurrents"  # "Membres Généraux Récurrents", "Membres PIF", "Membres PT"
    is_coach_subscription: bool = False  # Virtual Coach, TheCoach Pass, etc.
    is_duo: bool = False  # Abonnement Duo
    is_pif: bool = False  # Paid In Full (montant total au 1er mois, 0 après)
    nb_membres: int = 0  # Nombre actuel de membres avec ce type
    # Default billing cycle settings
    default_billing_cycle_type: str = "monthly_day"  # "monthly_day" or "interval_days"
    default_billing_cycle_value: int = 1  # Day of month (1-28) or interval in days (28)
    is_active: bool = True
    display_order: int = 0
    color: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MembershipTypeCreate(BaseModel):
    name: str
    duration_months: int
    duration_days: Optional[int] = None
    price: float = 0
    description: Optional[str] = None
    is_recurring: bool = True
    member_type: str = "Membres Généraux Récurrents"
    is_coach_subscription: bool = False
    is_duo: bool = False
    is_pif: bool = False
    nb_membres: int = 0
    default_billing_cycle_type: str = "monthly_day"
    default_billing_cycle_value: int = 1
    is_active: bool = True
    display_order: int = 0
    color: Optional[str] = None


class MemberType(BaseModel):
    """Type de membre (Généraux Récurrents, PIF, PT, etc.)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Ex: "Membres Généraux Récurrents", "PIF", "PT"
    code: str  # Ex: "general", "pif", "pt"
    description: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    color: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MemberTypeCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    color: Optional[str] = None
