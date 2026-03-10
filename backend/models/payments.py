"""Payment tracking models"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid


class PaymentSchedule(BaseModel):
    """Defines how a member's payments are scheduled"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    amount: float
    recurrence_type: str  # "monthly_day" (ex: le 15 du mois) or "interval_days" (ex: tous les 28 jours)
    recurrence_value: int  # Day of month (1-28) or interval in days
    start_date: str  # Date de début du prélèvement
    end_date: Optional[str] = None  # Date de fin (optionnel, pour abonnements limités)
    payment_method: str = "prelevement"  # "prelevement", "carte", "especes", "virement"
    is_active: bool = True
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PaymentScheduleCreate(BaseModel):
    member_id: str
    amount: float
    recurrence_type: str
    recurrence_value: int
    start_date: str
    end_date: Optional[str] = None
    payment_method: str = "prelevement"
    is_active: bool = True
    notes: Optional[str] = ""


class Payment(BaseModel):
    """Individual payment record"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    schedule_id: Optional[str] = None  # Link to PaymentSchedule if recurring
    amount: float
    due_date: str  # Date d'échéance
    paid_date: Optional[str] = None  # Date de paiement effectif
    status: str = "pending"  # "pending", "paid", "late", "failed", "cancelled"
    payment_method: Optional[str] = None
    reference: Optional[str] = None  # Référence de transaction
    notes: Optional[str] = ""
    reminder_sent: bool = False  # Si un rappel a été envoyé
    reminder_sent_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PaymentCreate(BaseModel):
    member_id: str
    schedule_id: Optional[str] = None
    amount: float
    due_date: str
    status: str = "pending"
    payment_method: Optional[str] = None
    notes: Optional[str] = ""


class PaymentUpdate(BaseModel):
    paid_date: Optional[str] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
