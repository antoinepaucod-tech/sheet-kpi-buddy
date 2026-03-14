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
    # Billing cycle
    billing_enabled: bool = True
    billing_amount: float = 0
    billing_cycle_type: str = "monthly_day"  # "monthly_day" or "interval_days"
    billing_cycle_value: int = 1  # Day of month (1-28) or interval in days (e.g., 28)
    billing_payment_method: str = "prelevement"  # "prelevement", "carte", "virement", "especes"
    # Onboarding flags
    onboarding_bsport: bool = False
    onboarding_hubfit: bool = False
    onboarding_nutrition: bool = False
    questionnaire_coaching: bool = False
    session_introduction: bool = False
    onboarding_completed: bool = False
    onboarding_completed_date: Optional[str] = None
    # Annual review
    annual_review_enabled: bool = False
    annual_review_date: Optional[str] = None  # Date du prochain bilan
    last_annual_review_date: Optional[str] = None
    review_frequency: str = "annually"  # "weekly", "monthly", "quarterly", "semi-annually", "annually"
    bilan_frequency: str = "monthly"  # Default bilan frequency for auto-generation
    # Monthly follow-up
    last_followup_date: Optional[str] = None
    next_followup_date: Optional[str] = None
    followup_notes: Optional[str] = ""
    notes: Optional[str] = ""
    # Duo subscription
    is_duo: bool = False
    duo_partner_id: Optional[str] = None
    duo_primary: bool = False
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
    # Billing cycle
    billing_enabled: bool = True
    billing_amount: float = 0
    billing_cycle_type: str = "monthly_day"
    billing_cycle_value: int = 1
    billing_payment_method: str = "prelevement"
    # Annual review
    annual_review_enabled: bool = False
    review_frequency: str = "annually"
    # Onboarding
    onboarding_bsport: bool = False
    onboarding_hubfit: bool = False
    onboarding_nutrition: bool = False
    questionnaire_coaching: bool = False
    session_introduction: bool = False
    # Follow-up
    next_followup_date: Optional[str] = None
    # Duo subscription
    is_duo: bool = False
    duo_partner_name: Optional[str] = None
    duo_partner_email: Optional[str] = None
    duo_partner_phone: Optional[str] = None


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



class MemberFollowUp(BaseModel):
    """Monthly follow-up record for members"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    followup_date: str
    followup_type: str = "monthly"  # "monthly", "onboarding", "renewal", "payment", "annual"
    status: str = "scheduled"  # "scheduled", "completed", "missed", "rescheduled"
    completed_date: Optional[str] = None
    notes: Optional[str] = ""
    performed_by: Optional[str] = None
    next_followup_date: Optional[str] = None
    reminder_sent: bool = False
    reminder_sent_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MemberFollowUpCreate(BaseModel):
    member_id: str
    followup_date: str
    followup_type: str = "monthly"
    notes: Optional[str] = ""


class AnnualReview(BaseModel):
    """Review/bilan for members - weight, nutrition, program adjustments"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    review_date: str
    review_type: str = "annually"  # "monthly", "quarterly", "semi-annually", "annually"
    # Weight tracking
    weight_start: Optional[float] = None  # Poids au début (kg)
    weight_current: Optional[float] = None  # Poids actuel (kg)
    weight_goal: Optional[float] = None  # Objectif de poids (kg)
    weight_change: Optional[float] = None  # Variation
    # Body measurements (optional)
    body_fat_percentage: Optional[float] = None
    muscle_mass: Optional[float] = None
    # Nutrition adjustments
    nutrition_current: Optional[str] = ""  # Régime actuel
    nutrition_adjustments: Optional[str] = ""  # Ajustements recommandés
    calories_target: Optional[int] = None
    protein_target: Optional[int] = None  # grammes
    # Program adjustments
    current_program: Optional[str] = ""  # Programme actuel
    program_adjustments: Optional[str] = ""  # Modifications du programme
    training_frequency: Optional[int] = None  # Séances par semaine recommandées
    # Goals and notes
    goals_achieved: Optional[str] = ""  # Objectifs atteints
    new_goals: Optional[str] = ""  # Nouveaux objectifs
    coach_notes: Optional[str] = ""  # Notes du coach
    member_feedback: Optional[str] = ""  # Retour du membre
    # Next review
    next_review_date: Optional[str] = None
    # Status
    status: str = "scheduled"  # "scheduled", "completed", "missed"
    completed_date: Optional[str] = None
    performed_by: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AnnualReviewCreate(BaseModel):
    member_id: str
    review_date: str
    review_type: str = "annually"
    weight_start: Optional[float] = None
    weight_current: Optional[float] = None
    weight_goal: Optional[float] = None
    nutrition_current: Optional[str] = ""
    current_program: Optional[str] = ""
    new_goals: Optional[str] = ""
