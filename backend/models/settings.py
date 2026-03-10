"""Membership and subscription types models"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class MembershipType(BaseModel):
    """Type d'abonnement (Mensuel, Trimestriel, Annuel, 6 Weeks Challenge, etc.)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Ex: "Mensuel", "Trimestriel", "Annuel", "6 Weeks Challenge"
    duration_months: int  # Durée en mois (1, 3, 12, 1.5 pour 6 semaines)
    duration_days: Optional[int] = None  # Pour les durées non standard (42 jours pour 6 weeks)
    price: float = 0  # Prix par défaut
    description: Optional[str] = None
    is_recurring: bool = True  # Abonnement récurrent ou one-time
    is_active: bool = True
    display_order: int = 0  # Ordre d'affichage
    color: Optional[str] = None  # Couleur pour l'UI (ex: "#10b981")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MembershipTypeCreate(BaseModel):
    name: str
    duration_months: int
    duration_days: Optional[int] = None
    price: float = 0
    description: Optional[str] = None
    is_recurring: bool = True
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
