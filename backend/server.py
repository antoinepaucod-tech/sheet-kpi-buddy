from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
from io import BytesIO

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'kpibuddy-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Auth Models ─────────────────────────────────────────────────────────────

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


# ── Auth Helpers ────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {"user_id": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Token manquant")
    
    try:
        scheme, token = authorization.split(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Schéma d'authentification invalide")
    except ValueError:
        raise HTTPException(status_code=401, detail="Format d'autorisation invalide")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token invalide")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")


# ── Models ──────────────────────────────────────────────────────────────────

class MonthlyKPI(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    month: str  # format: "YYYY-MM"
    year: Optional[int] = None
    month_name: Optional[str] = ""
    
    # Revenue - Base
    total_revenue: float = 0
    revenue_members: float = 0
    revenue_coaching: float = 0
    
    # Revenue - Detailed (from original Supabase schema)
    general_eft_revenue: float = 0
    pt_revenue: float = 0
    retail_revenue: float = 0
    fast_cash_revenue: float = 0
    
    # Members - Base
    total_members: int = 0
    new_members: int = 0
    lost_members: int = 0
    
    # Members - Detailed (from original Supabase schema)
    pif_members: int = 0
    pif_exits: int = 0
    pif_churn: float = 0
    pauses: int = 0
    recurring_general_members: int = 0
    general_exits: int = 0
    general_churn: float = 0
    pt_members: int = 0
    pt_exits: int = 0
    pt_churn: float = 0
    total_active_members: int = 0
    
    # Funnel - Sales (from original Supabase schema)
    leads: int = 0
    calls_made: int = 0
    call_percentage: float = 0
    scheduled: int = 0
    sched_percentage: float = 0
    show: int = 0
    show_percentage: float = 0
    close: int = 0
    close_percentage: float = 0
    cash_collected: float = 0
    avg_per_sale: float = 0
    
    # Organic (from original Supabase schema)
    organic_leads: int = 0
    organic_close: int = 0
    organic_close_percentage: float = 0
    organic_cash_collected: float = 0
    
    # Trials (from original Supabase schema)
    in_trial: int = 0
    trial_ending: int = 0
    converted: int = 0
    conversion_percentage: float = 0
    
    # Expenses - Base
    total_expenses: float = 0
    marketing_spend: float = 0
    ad_spend: float = 0
    
    # Expenses - Detailed
    loyer: float = 0
    salaires: float = 0
    salaires_coach: float = 0
    utilities: float = 0
    other_expenses: float = 0
    
    # Expenses - Extended (from original Supabase schema)
    rent: float = 0
    repairs_maintenance: float = 0
    computer_software: float = 0
    internet_telephone: float = 0
    subscriptions: float = 0
    bank_finance_charges: float = 0
    insurance: float = 0
    food_expenses: float = 0
    credit_repayment: float = 0
    
    # Metrics - Base
    churn_rate: float = 0
    cac: float = 0
    roas: float = 0
    net_profit: float = 0
    profit_margin: float = 0
    
    # Metrics - Advanced (from original Supabase schema)
    profit: float = 0
    profit_percentage: float = 0
    general_acrm: float = 0
    general_ltv: float = 0
    pt_acrm: float = 0
    pt_ltv: float = 0
    cpl: float = 0
    cpr: float = 0
    ro_ads: float = 0
    gym_floor_sqft: float = 0
    total_classes: int = 0
    
    # Notes & timestamps
    note: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MonthlyKPICreate(BaseModel):
    month: str
    revenue_members: float = 0
    revenue_coaching: float = 0
    total_revenue: float = 0
    total_expenses: float = 0
    net_profit: float = 0
    new_members: int = 0
    lost_members: int = 0
    total_members: int = 0
    marketing_spend: float = 0
    ad_spend: float = 0
    loyer: float = 0
    salaires: float = 0
    utilities: float = 0
    other_expenses: float = 0
    note: Optional[str] = ""


class AccountingCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    kpi_column: str
    type: str  # "expense" | "revenue"
    color: str = "#3B82F6"


class CategoryCreate(BaseModel):
    name: str
    kpi_column: str
    type: str
    color: str = "#3B82F6"


class AccountingTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    description: str
    amount: float
    type: str  # "revenue" | "expense"
    category: str
    sub_type: Optional[str] = None  # "members" | "coaching"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TransactionCreate(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    category: str
    sub_type: Optional[str] = None


class ExcludedRecurringExpense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    original_transaction_id: str
    category: str
    description: str
    amount: float
    type: str = "expense"  # "expense" | "revenue" - support both types
    sub_type: Optional[str] = None  # "members" | "coaching" for revenue
    excluded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RecurringTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "revenue" | "expense"
    category: str
    description: str
    amount: float
    sub_type: Optional[str] = None
    recurrence_day: int = 1  # Day of month (1-28)
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RecurringTransactionCreate(BaseModel):
    type: str
    category: str
    description: str
    amount: float
    sub_type: Optional[str] = None
    recurrence_day: int = 1
    is_active: bool = True


# ── Models: Customer Members & Subscriptions ─────────────────────────────────

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


# ── Models: Weekly Trainings & Engagement ────────────────────────────────────

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


# ── Models: 6 Weeks Challenge ────────────────────────────────────────────────

class ChallengeCheckin(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    week_number: int  # 1-6
    checked: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Models: Course KPIs ──────────────────────────────────────────────────────

class Instructor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = None
    hourly_rate: float = 0
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CourseKPI(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    year: int
    month: int
    month_name: str
    day_of_week: str  # "Lundi", "Mardi", etc.
    time_slot: str  # "09:00", "18:30", etc.
    course_name: str
    instructor: Optional[str] = None
    max_capacity: int = 10
    # Weekly attendance
    week1_attendance: int = 0
    week2_attendance: int = 0
    week3_attendance: int = 0
    week4_attendance: int = 0
    week5_attendance: int = 0
    # Weekly instructor overrides
    week1_instructor: Optional[str] = None
    week2_instructor: Optional[str] = None
    week3_instructor: Optional[str] = None
    week4_instructor: Optional[str] = None
    week5_instructor: Optional[str] = None
    # Calculated
    attendance_rate: float = 0
    monthly_expenses: float = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CourseKPICreate(BaseModel):
    year: int
    month: int
    day_of_week: str
    time_slot: str
    course_name: str
    instructor: Optional[str] = None
    max_capacity: int = 10


MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
             "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]


# ── Helpers ──────────────────────────────────────────────────────────────────

def compute_metrics(kpi: dict) -> dict:
    members_start = kpi.get('total_members', 0) + kpi.get('lost_members', 0)
    churn_rate = round((kpi.get('lost_members', 0) / members_start * 100) if members_start > 0 else 0, 2)
    new_m = kpi.get('new_members', 0)
    cac = round((kpi.get('marketing_spend', 0) / new_m) if new_m > 0 else 0, 2)
    ad = kpi.get('ad_spend', 0)
    roas = round((kpi.get('total_revenue', 0) / ad) if ad > 0 else 0, 2)
    rev = kpi.get('total_revenue', 0)
    profit_margin = round((kpi.get('net_profit', 0) / rev * 100) if rev > 0 else 0, 2)
    return {**kpi, 'churn_rate': churn_rate, 'cac': cac, 'roas': roas, 'profit_margin': profit_margin}


def strip_id(doc: dict) -> dict:
    doc.pop('_id', None)
    return doc


# ── Routes: Authentication ───────────────────────────────────────────────────

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Create user
    user = User(
        email=data.email.lower(),
        club_name=data.club_name,
        hashed_password=hash_password(data.password)
    )
    await db.users.insert_one(user.model_dump())
    
    # Generate token
    token = create_access_token(user.id, user.email)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, club_name=user.club_name)
    )


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    token = create_access_token(user["id"], user["email"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=user["email"], club_name=user["club_name"])
    )


@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)


@api_router.put("/auth/club-name")
async def update_club_name(body: dict, current_user: dict = Depends(get_current_user)):
    new_name = body.get("club_name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Nom du club requis")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"club_name": new_name}}
    )
    return {"message": "Nom du club mis à jour", "club_name": new_name}


# ── Routes: Monthly KPIs ─────────────────────────────────────────────────────

@api_router.get("/monthly-kpis")
async def get_monthly_kpis():
    docs = await db.monthly_kpis.find({}, {"_id": 0}).sort("month", 1).to_list(1000)
    return [compute_metrics(d) for d in docs]


@api_router.get("/monthly-kpis/{month}")
async def get_monthly_kpi(month: str):
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    return compute_metrics(doc)


@api_router.post("/monthly-kpis")
async def upsert_monthly_kpi(data: MonthlyKPICreate):
    existing = await db.monthly_kpis.find_one({"month": data.month})
    payload = data.model_dump()
    if existing:
        payload['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.monthly_kpis.update_one({"month": data.month}, {"$set": payload})
        doc = await db.monthly_kpis.find_one({"month": data.month}, {"_id": 0})
    else:
        kpi = MonthlyKPI(**payload)
        doc = kpi.model_dump()
        await db.monthly_kpis.insert_one(doc)
        doc.pop('_id', None)
    return compute_metrics(doc)


@api_router.post("/monthly-kpis/bulk")
async def bulk_import_kpis(data: List[dict]):
    """Bulk import KPIs - useful for migrating data from Supabase"""
    imported = 0
    updated = 0
    
    for kpi_data in data:
        month = kpi_data.get("month")
        if not month:
            continue
        
        # Map Supabase field names to our schema (snake_case from both)
        mapped = {
            "month": month,
            "year": kpi_data.get("year"),
            "month_name": kpi_data.get("month_name", ""),
            # Revenue
            "total_revenue": kpi_data.get("total_revenue", 0),
            "revenue_members": kpi_data.get("revenue_members", 0),
            "revenue_coaching": kpi_data.get("revenue_coaching", 0),
            "general_eft_revenue": kpi_data.get("general_eft_revenue", 0),
            "pt_revenue": kpi_data.get("pt_revenue", 0),
            "retail_revenue": kpi_data.get("retail_revenue", 0),
            "fast_cash_revenue": kpi_data.get("fast_cash_revenue", 0),
            # Members
            "total_members": kpi_data.get("total_members", kpi_data.get("total_active_members", 0)),
            "new_members": kpi_data.get("new_members", 0),
            "lost_members": kpi_data.get("lost_members", 0),
            "pif_members": kpi_data.get("pif_members", 0),
            "pif_exits": kpi_data.get("pif_exits", 0),
            "pif_churn": kpi_data.get("pif_churn", 0),
            "pauses": kpi_data.get("pauses", 0),
            "recurring_general_members": kpi_data.get("recurring_general_members", 0),
            "general_exits": kpi_data.get("general_exits", 0),
            "general_churn": kpi_data.get("general_churn", 0),
            "pt_members": kpi_data.get("pt_members", 0),
            "pt_exits": kpi_data.get("pt_exits", 0),
            "pt_churn": kpi_data.get("pt_churn", 0),
            "total_active_members": kpi_data.get("total_active_members", 0),
            # Funnel
            "leads": kpi_data.get("leads", 0),
            "calls_made": kpi_data.get("calls_made", 0),
            "call_percentage": kpi_data.get("call_percentage", 0),
            "scheduled": kpi_data.get("scheduled", 0),
            "sched_percentage": kpi_data.get("sched_percentage", 0),
            "show": kpi_data.get("show", 0),
            "show_percentage": kpi_data.get("show_percentage", 0),
            "close": kpi_data.get("close", 0),
            "close_percentage": kpi_data.get("close_percentage", 0),
            "cash_collected": kpi_data.get("cash_collected", 0),
            "avg_per_sale": kpi_data.get("avg_per_sale", 0),
            # Organic
            "organic_leads": kpi_data.get("organic_leads", 0),
            "organic_close": kpi_data.get("organic_close", 0),
            "organic_close_percentage": kpi_data.get("organic_close_percentage", 0),
            "organic_cash_collected": kpi_data.get("organic_cash_collected", 0),
            # Trials
            "in_trial": kpi_data.get("in_trial", 0),
            "trial_ending": kpi_data.get("trial_ending", 0),
            "converted": kpi_data.get("converted", 0),
            "conversion_percentage": kpi_data.get("conversion_percentage", 0),
            # Expenses
            "total_expenses": kpi_data.get("total_expenses", 0),
            "marketing_spend": kpi_data.get("marketing_spend", 0),
            "ad_spend": kpi_data.get("ad_spend", 0),
            "loyer": kpi_data.get("loyer", kpi_data.get("rent", 0)),
            "salaires": kpi_data.get("salaires", kpi_data.get("salaries", 0)),
            "salaires_coach": kpi_data.get("salaires_coach", kpi_data.get("salaries_coach", 0)),
            "utilities": kpi_data.get("utilities", 0),
            "other_expenses": kpi_data.get("other_expenses", 0),
            "rent": kpi_data.get("rent", 0),
            "repairs_maintenance": kpi_data.get("repairs_maintenance", kpi_data.get("repairs_and_maintenance", 0)),
            "computer_software": kpi_data.get("computer_software", 0),
            "internet_telephone": kpi_data.get("internet_telephone", 0),
            "subscriptions": kpi_data.get("subscriptions", 0),
            "bank_finance_charges": kpi_data.get("bank_finance_charges", 0),
            "insurance": kpi_data.get("insurance", 0),
            "food_expenses": kpi_data.get("food_expenses", 0),
            "credit_repayment": kpi_data.get("credit_repayment", 0),
            # Metrics
            "churn_rate": kpi_data.get("churn_rate", 0),
            "cac": kpi_data.get("cac", 0),
            "roas": kpi_data.get("roas", kpi_data.get("ro_ads", 0)),
            "net_profit": kpi_data.get("net_profit", kpi_data.get("profit", 0)),
            "profit_margin": kpi_data.get("profit_margin", kpi_data.get("profit_percentage", 0)),
            "profit": kpi_data.get("profit", 0),
            "profit_percentage": kpi_data.get("profit_percentage", 0),
            "general_acrm": kpi_data.get("general_acrm", 0),
            "general_ltv": kpi_data.get("general_ltv", 0),
            "pt_acrm": kpi_data.get("pt_acrm", 0),
            "pt_ltv": kpi_data.get("pt_ltv", 0),
            "cpl": kpi_data.get("cpl", 0),
            "cpr": kpi_data.get("cpr", 0),
            "ro_ads": kpi_data.get("ro_ads", 0),
            "gym_floor_sqft": kpi_data.get("gym_floor_sqft", 0),
            "total_classes": kpi_data.get("total_classes", 0),
            # Notes
            "note": kpi_data.get("note", ""),
        }
        
        existing = await db.monthly_kpis.find_one({"month": month})
        if existing:
            mapped['updated_at'] = datetime.now(timezone.utc).isoformat()
            await db.monthly_kpis.update_one({"month": month}, {"$set": mapped})
            updated += 1
        else:
            kpi = MonthlyKPI(**{k: v for k, v in mapped.items() if v is not None})
            doc = kpi.model_dump()
            await db.monthly_kpis.insert_one(doc)
            imported += 1
    
    return {
        "imported": imported,
        "updated": updated,
        "total": imported + updated,
        "message": f"Import terminé: {imported} créés, {updated} mis à jour"
    }


# ── Routes: Transactions ─────────────────────────────────────────────────────

@api_router.get("/transactions")
async def get_transactions(month: Optional[str] = None):
    query = {}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    docs = await db.accounting_transactions.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return docs


@api_router.post("/transactions")
async def create_transaction(data: TransactionCreate):
    excluded = await db.excluded_recurring_expenses.find_one({
        "category": data.category,
        "description": data.description
    })
    if excluded:
        raise HTTPException(status_code=400, detail="Cette transaction a été exclue précédemment")
    tx = AccountingTransaction(**data.model_dump())
    doc = tx.model_dump()
    await db.accounting_transactions.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    tx = await db.accounting_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    excl = ExcludedRecurringExpense(
        original_transaction_id=transaction_id,
        category=tx.get('category', ''),
        description=tx.get('description', ''),
        amount=tx.get('amount', 0),
        type=tx.get('type', 'expense'),
        sub_type=tx.get('sub_type')
    )
    await db.excluded_recurring_expenses.insert_one(excl.model_dump())
    await db.accounting_transactions.delete_one({"id": transaction_id})
    return {"message": "Transaction supprimée et ajoutée aux exclusions"}


# ── Routes: Categories ────────────────────────────────────────────────────────

@api_router.get("/categories")
async def get_categories():
    docs = await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)
    return docs


@api_router.post("/categories")
async def create_category(data: CategoryCreate):
    cat = AccountingCategory(**data.model_dump())
    doc = cat.model_dump()
    await db.accounting_categories.insert_one(doc)
    doc.pop('_id', None)
    return doc


# ── Routes: Excluded ──────────────────────────────────────────────────────────

@api_router.get("/excluded")
async def get_excluded():
    docs = await db.excluded_recurring_expenses.find({}, {"_id": 0}).to_list(1000)
    return docs


@api_router.delete("/excluded/{excluded_id}")
async def remove_from_exclusions(excluded_id: str):
    result = await db.excluded_recurring_expenses.delete_one({"id": excluded_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exclusion introuvable")
    return {"message": "Exclusion supprimée"}


# ── Routes: Recurring Transactions ────────────────────────────────────────────

@api_router.get("/recurring-transactions")
async def get_recurring_transactions():
    docs = await db.recurring_transactions.find({}, {"_id": 0}).to_list(1000)
    return docs


@api_router.post("/recurring-transactions")
async def create_recurring_transaction(data: RecurringTransactionCreate):
    rec = RecurringTransaction(**data.model_dump())
    doc = rec.model_dump()
    await db.recurring_transactions.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/recurring-transactions/{rec_id}")
async def update_recurring_transaction(rec_id: str, data: RecurringTransactionCreate):
    existing = await db.recurring_transactions.find_one({"id": rec_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction récurrente introuvable")
    update = {**data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.recurring_transactions.update_one({"id": rec_id}, {"$set": update})
    doc = await db.recurring_transactions.find_one({"id": rec_id}, {"_id": 0})
    return doc


@api_router.delete("/recurring-transactions/{rec_id}")
async def delete_recurring_transaction(rec_id: str):
    result = await db.recurring_transactions.delete_one({"id": rec_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction récurrente introuvable")
    return {"message": "Transaction récurrente supprimée"}


@api_router.post("/recurring-transactions/generate/{year}/{month}")
async def generate_monthly_transactions(year: int, month: int):
    """Generate transactions for a specific month from active recurring templates"""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mois invalide (1-12)")
    
    # Fetch active recurring transactions
    recurring = await db.recurring_transactions.find({"is_active": True}, {"_id": 0}).to_list(1000)
    if not recurring:
        raise HTTPException(status_code=404, detail="Aucune transaction récurrente active")
    
    # Get excluded transactions to skip
    excluded = await db.excluded_recurring_expenses.find({}, {"_id": 0}).to_list(1000)
    excluded_keys = {(e["category"], e["description"]) for e in excluded}
    
    # Month string format (YYYY-MM)
    month_str = f"{year}-{month:02d}"
    month_name = MONTHS_FR[month - 1]
    
    # Days in month
    if month == 12:
        days_in_month = 31
    else:
        from calendar import monthrange
        days_in_month = monthrange(year, month)[1]
    
    created = []
    skipped = []
    
    for rec in recurring:
        # Check if excluded
        if (rec["category"], rec["description"]) in excluded_keys:
            skipped.append(rec["description"])
            continue
        
        # Ensure day doesn't exceed month's days
        day = min(rec.get("recurrence_day", 1), days_in_month)
        tx_date = f"{month_str}-{day:02d}"
        
        tx = AccountingTransaction(
            date=tx_date,
            description=rec["description"],
            amount=rec["amount"],
            type=rec["type"],
            category=rec["category"],
            sub_type=rec.get("sub_type")
        )
        doc = tx.model_dump()
        await db.accounting_transactions.insert_one(doc)
        doc.pop('_id', None)
        created.append(doc)
    
    return {
        "month": month_str,
        "month_name": month_name,
        "created": len(created),
        "skipped": len(skipped),
        "skipped_descriptions": skipped,
        "transactions": created
    }


@api_router.patch("/monthly-kpis/{month}/note")
async def update_note(month: str, body: dict):
    note = body.get("note", "")
    await db.monthly_kpis.update_one(
        {"month": month},
        {"$set": {"note": note, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    return compute_metrics(doc) if doc else {"error": "Mois introuvable"}


@api_router.post("/transactions/bulk")
async def bulk_import_transactions(transactions: List[TransactionCreate]):
    imported = []
    skipped = []
    for data in transactions:
        excluded = await db.excluded_recurring_expenses.find_one({
            "category": data.category, "description": data.description
        })
        if excluded:
            skipped.append(data.description)
            continue
        tx = AccountingTransaction(**data.model_dump())
        doc = tx.model_dump()
        await db.accounting_transactions.insert_one(doc)
        doc.pop('_id', None)
        imported.append(doc)
    return {"imported": len(imported), "skipped": len(skipped), "transactions": imported}


# ── Routes: PDF Report ────────────────────────────────────────────────────────

@api_router.get("/report/pdf/{month}")
async def generate_pdf_report(month: str):
    """Generate a PDF report for the specified month"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    
    # Fetch KPI data
    kpi = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    if not kpi:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    kpi = compute_metrics(kpi)
    
    # Fetch transactions for the month
    txs = await db.accounting_transactions.find({
        "date": {"$regex": f"^{month}"}
    }, {"_id": 0}).to_list(1000)
    
    # Fetch club settings
    settings = await db.club_settings.find_one({"id": "default"}, {"_id": 0})
    club_name = settings.get("club_name", "Mon Club") if settings else "Mon Club"
    
    # Parse month name
    year, m = month.split("-")
    month_name = MONTHS_FR[int(m) - 1]
    
    # Create PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        alignment=TA_CENTER,
        spaceAfter=10,
        textColor=HexColor('#E11D48')
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=HexColor('#666666')
    )
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=10,
        spaceBefore=15,
        textColor=HexColor('#333333')
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph(club_name, title_style))
    elements.append(Paragraph(f"Rapport Mensuel - {month_name} {year}", subtitle_style))
    
    # KPI Summary Table
    elements.append(Paragraph("Résumé des KPIs", section_style))
    
    def fmt_chf(v):
        return f"{v:,.2f} CHF".replace(",", "'")
    
    kpi_data = [
        ["Indicateur", "Valeur"],
        ["Revenus Totaux", fmt_chf(kpi.get("total_revenue", 0))],
        ["Bénéfice Net", fmt_chf(kpi.get("net_profit", 0))],
        ["Dépenses Totales", fmt_chf(kpi.get("total_expenses", 0))],
        ["Marge Nette", f"{kpi.get('profit_margin', 0):.1f}%"],
        ["Membres Actifs", str(kpi.get("total_members", 0))],
        ["Nouveaux Membres", str(kpi.get("new_members", 0))],
        ["Membres Perdus", str(kpi.get("lost_members", 0))],
        ["Taux de Churn", f"{kpi.get('churn_rate', 0):.2f}%"],
        ["CAC", fmt_chf(kpi.get("cac", 0))],
        ["ROAS", f"{kpi.get('roas', 0):.1f}x"],
    ]
    
    kpi_table = Table(kpi_data, colWidths=[100*mm, 60*mm])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#E11D48')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#F8F8F8')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#DDDDDD')),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(kpi_table)
    
    # Expenses breakdown
    elements.append(Spacer(1, 10*mm))
    elements.append(Paragraph("Détail des Dépenses", section_style))
    
    expense_data = [
        ["Catégorie", "Montant"],
        ["Loyer", fmt_chf(kpi.get("loyer", 0))],
        ["Salaires", fmt_chf(kpi.get("salaires", 0))],
        ["Charges", fmt_chf(kpi.get("utilities", 0))],
        ["Marketing", fmt_chf(kpi.get("marketing_spend", 0))],
        ["Autres", fmt_chf(kpi.get("other_expenses", 0))],
    ]
    
    expense_table = Table(expense_data, colWidths=[100*mm, 60*mm])
    expense_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#3B82F6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#F8F8F8')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#DDDDDD')),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(expense_table)
    
    # Transactions list (last 10)
    if txs:
        elements.append(Spacer(1, 10*mm))
        elements.append(Paragraph(f"Transactions du mois ({len(txs)} total)", section_style))
        
        tx_data = [["Date", "Description", "Type", "Montant"]]
        for tx in txs[:15]:  # Show first 15
            tx_type = "Revenu" if tx.get("type") == "revenue" else "Dépense"
            sign = "+" if tx.get("type") == "revenue" else "-"
            tx_data.append([
                tx.get("date", ""),
                tx.get("description", "")[:30],
                tx_type,
                f"{sign} {fmt_chf(tx.get('amount', 0))}"
            ])
        
        if len(txs) > 15:
            tx_data.append(["...", f"+{len(txs)-15} autres transactions", "", ""])
        
        tx_table = Table(tx_data, colWidths=[30*mm, 70*mm, 30*mm, 40*mm])
        tx_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor('#666666')),
            ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 1), (-1, -1), HexColor('#FAFAFA')),
            ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#DDDDDD')),
        ]))
        elements.append(tx_table)
    
    # Note if exists
    if kpi.get("note"):
        elements.append(Spacer(1, 10*mm))
        elements.append(Paragraph("Note du mois", section_style))
        elements.append(Paragraph(kpi.get("note", ""), styles['Normal']))
    
    # Footer
    elements.append(Spacer(1, 15*mm))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=HexColor('#999999')
    )
    elements.append(Paragraph(
        f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')} - Sheet KPI Buddy",
        footer_style
    ))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"rapport_{club_name.replace(' ', '_')}_{month}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ── Routes: Settings ─────────────────────────────────────────────────────────

class ClubSettings(BaseModel):
    club_name: str = "Mon Club"
    targets: dict = Field(default_factory=lambda: {
        "churn_rate": 3.0,
        "cac": 150.0,
        "roas": 20.0,
        "new_members": 30,
        "profit_margin": 30.0,
        "revenue_growth": 5.0,
    })
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@api_router.get("/settings")
async def get_settings():
    doc = await db.club_settings.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        default = ClubSettings()
        await db.club_settings.insert_one({"id": "default", **default.model_dump()})
        return {"id": "default", **default.model_dump()}
    return doc


@api_router.put("/settings")
async def update_settings(data: ClubSettings):
    data.updated_at = datetime.now(timezone.utc).isoformat()
    payload = {"id": "default", **data.model_dump()}
    await db.club_settings.replace_one({"id": "default"}, payload, upsert=True)
    return payload


# ── Routes: Recalculate KPIs from Transactions ───────────────────────────────

@api_router.post("/monthly-kpis/{month}/recalculate")
async def recalculate_month(month: str):
    # Get categories for mapping
    cats = await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)
    cat_map = {c["name"]: c["kpi_column"] for c in cats}

    # Get transactions for the month
    txs = await db.accounting_transactions.find(
        {"date": {"$regex": f"^{month}"}}, {"_id": 0}
    ).to_list(1000)

    if not txs:
        raise HTTPException(status_code=404, detail="Aucune transaction pour ce mois")

    # Get existing KPI to merge (keep manual fields like new_members, lost_members)
    existing = await db.monthly_kpis.find_one({"month": month}, {"_id": 0}) or {}

    # Aggregate by kpi_column - only update fields that have transactions
    totals = {}
    for tx in txs:
        col = cat_map.get(tx["category"])
        if col:
            totals[col] = totals.get(col, 0) + tx["amount"]

    # Merge: only override fields where we have transaction data
    merged = dict(existing)
    for col, val in totals.items():
        if val > 0:
            merged[col] = val

    revenue_members = merged.get("revenue_members", 0)
    revenue_coaching = merged.get("revenue_coaching", 0)
    total_revenue = revenue_members + revenue_coaching

    loyer = merged.get("loyer", 0)
    salaires = merged.get("salaires", 0)
    utilities = merged.get("utilities", 0)
    marketing_spend = merged.get("marketing_spend", 0)
    ad_spend = merged.get("ad_spend", 0)
    other_expenses = merged.get("other_expenses", 0)
    total_expenses = loyer + salaires + utilities + marketing_spend + ad_spend + other_expenses
    net_profit = total_revenue - total_expenses

    update = {
        **{k: merged[k] for k in totals if totals[k] > 0},
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.monthly_kpis.update_one({"month": month}, {"$set": update}, upsert=False)
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    return compute_metrics(doc) if doc else {"error": "Mois introuvable dans KPIs"}


@api_router.post("/monthly-kpis/recalculate-all")
async def recalculate_all():
    months = await db.monthly_kpis.find({}, {"_id": 0, "month": 1}).to_list(1000)
    results = []
    for m in months:
        try:
            res = await recalculate_month(m["month"])
            results.append({"month": m["month"], "status": "ok"})
        except Exception as e:
            results.append({"month": m["month"], "status": "skipped", "reason": str(e)})
    return {"recalculated": len([r for r in results if r["status"] == "ok"]), "details": results}


# ── Routes: Categories (delete) ───────────────────────────────────────────────

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    result = await db.accounting_categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    return {"message": "Catégorie supprimée"}


# ── Seed / Init ───────────────────────────────────────────────────────────────

@api_router.get("/init")
async def init_check():
    count = await db.monthly_kpis.count_documents({})
    return {"has_data": count > 0, "months_count": count}


@api_router.post("/seed")
async def seed_data():
    await db.monthly_kpis.drop()
    await db.accounting_transactions.drop()
    await db.accounting_categories.drop()
    await db.excluded_recurring_expenses.drop()
    await db.customer_members.drop()
    await db.member_renewals.drop()
    await db.weekly_trainings.drop()
    await db.six_weeks_challenges.drop()
    await db.challenge_participants.drop()
    await db.course_kpis.drop()
    await db.instructors.drop()

    categories = [
        {"name": "LOYER", "kpi_column": "loyer", "type": "expense", "color": "#3B82F6"},
        {"name": "SALAIRES", "kpi_column": "salaires", "type": "expense", "color": "#8B5CF6"},
        {"name": "UTILITIES", "kpi_column": "utilities", "type": "expense", "color": "#F59E0B"},
        {"name": "MARKETING", "kpi_column": "marketing_spend", "type": "expense", "color": "#E11D48"},
        {"name": "PUBLICITE", "kpi_column": "ad_spend", "type": "expense", "color": "#EC4899"},
        {"name": "COTISATIONS", "kpi_column": "revenue_members", "type": "revenue", "color": "#22C55E"},
        {"name": "COACHING", "kpi_column": "revenue_coaching", "type": "revenue", "color": "#10B981"},
        {"name": "AUTRE", "kpi_column": "other_expenses", "type": "expense", "color": "#6B7280"},
    ]
    for c in categories:
        cat = AccountingCategory(**c)
        await db.accounting_categories.insert_one(cat.model_dump())

    months_raw = [
        {"month": "2024-01", "revenue_members": 42000, "revenue_coaching": 8500, "new_members": 18, "lost_members": 5, "total_members": 142, "marketing_spend": 3200, "ad_spend": 1500, "loyer": 8000, "salaires": 21000, "utilities": 2200, "other_expenses": 1800},
        {"month": "2024-02", "revenue_members": 43500, "revenue_coaching": 9200, "new_members": 22, "lost_members": 7, "total_members": 157, "marketing_spend": 3500, "ad_spend": 1800, "loyer": 8000, "salaires": 21000, "utilities": 2100, "other_expenses": 1600},
        {"month": "2024-03", "revenue_members": 45000, "revenue_coaching": 10500, "new_members": 28, "lost_members": 6, "total_members": 179, "marketing_spend": 4000, "ad_spend": 2200, "loyer": 8000, "salaires": 22000, "utilities": 2300, "other_expenses": 2100},
        {"month": "2024-04", "revenue_members": 46500, "revenue_coaching": 11000, "new_members": 25, "lost_members": 9, "total_members": 195, "marketing_spend": 3800, "ad_spend": 2000, "loyer": 8000, "salaires": 22000, "utilities": 2000, "other_expenses": 1900},
        {"month": "2024-05", "revenue_members": 48000, "revenue_coaching": 12500, "new_members": 31, "lost_members": 11, "total_members": 215, "marketing_spend": 4500, "ad_spend": 2500, "loyer": 8000, "salaires": 23000, "utilities": 1900, "other_expenses": 2200},
        {"month": "2024-06", "revenue_members": 47500, "revenue_coaching": 13000, "new_members": 29, "lost_members": 14, "total_members": 230, "marketing_spend": 4200, "ad_spend": 2300, "loyer": 8000, "salaires": 23000, "utilities": 2500, "other_expenses": 2000},
        {"month": "2024-07", "revenue_members": 44000, "revenue_coaching": 9500, "new_members": 15, "lost_members": 18, "total_members": 227, "marketing_spend": 2800, "ad_spend": 1500, "loyer": 8000, "salaires": 23000, "utilities": 2800, "other_expenses": 1500},
        {"month": "2024-08", "revenue_members": 43000, "revenue_coaching": 8800, "new_members": 12, "lost_members": 16, "total_members": 223, "marketing_spend": 2500, "ad_spend": 1200, "loyer": 8000, "salaires": 23000, "utilities": 2900, "other_expenses": 1400},
        {"month": "2024-09", "revenue_members": 49000, "revenue_coaching": 14000, "new_members": 38, "lost_members": 8, "total_members": 253, "marketing_spend": 5500, "ad_spend": 3000, "loyer": 8000, "salaires": 24000, "utilities": 2200, "other_expenses": 2500},
        {"month": "2024-10", "revenue_members": 51000, "revenue_coaching": 15500, "new_members": 42, "lost_members": 7, "total_members": 288, "marketing_spend": 6000, "ad_spend": 3500, "loyer": 8000, "salaires": 25000, "utilities": 2100, "other_expenses": 2800},
        {"month": "2024-11", "revenue_members": 52500, "revenue_coaching": 16000, "new_members": 38, "lost_members": 9, "total_members": 317, "marketing_spend": 5800, "ad_spend": 3200, "loyer": 8000, "salaires": 25000, "utilities": 2300, "other_expenses": 2600},
        {"month": "2024-12", "revenue_members": 54000, "revenue_coaching": 17500, "new_members": 35, "lost_members": 12, "total_members": 340, "marketing_spend": 5500, "ad_spend": 3000, "loyer": 8000, "salaires": 26000, "utilities": 2600, "other_expenses": 3000},
    ]
    for m in months_raw:
        total_revenue = m["revenue_members"] + m["revenue_coaching"]
        total_expenses = m["loyer"] + m["salaires"] + m["utilities"] + m["marketing_spend"] + m["ad_spend"] + m["other_expenses"]
        kpi = MonthlyKPI(**m, total_revenue=total_revenue, total_expenses=total_expenses, net_profit=total_revenue - total_expenses)
        await db.monthly_kpis.insert_one(kpi.model_dump())

    # Seed 2023 data for N-1 comparison (12 months, ~15% lower than 2024)
    months_2023 = [
        {"month": "2023-01", "revenue_members": 35000, "revenue_coaching": 6800, "new_members": 12, "lost_members": 6, "total_members": 118, "marketing_spend": 2500, "ad_spend": 1100, "loyer": 7500, "salaires": 18000, "utilities": 2000, "other_expenses": 1500},
        {"month": "2023-02", "revenue_members": 36500, "revenue_coaching": 7500, "new_members": 16, "lost_members": 8, "total_members": 126, "marketing_spend": 2800, "ad_spend": 1300, "loyer": 7500, "salaires": 18000, "utilities": 1900, "other_expenses": 1400},
        {"month": "2023-03", "revenue_members": 38000, "revenue_coaching": 8500, "new_members": 20, "lost_members": 7, "total_members": 139, "marketing_spend": 3200, "ad_spend": 1700, "loyer": 7500, "salaires": 19000, "utilities": 2100, "other_expenses": 1800},
        {"month": "2023-04", "revenue_members": 39500, "revenue_coaching": 9000, "new_members": 19, "lost_members": 10, "total_members": 148, "marketing_spend": 3000, "ad_spend": 1600, "loyer": 7500, "salaires": 19000, "utilities": 1800, "other_expenses": 1600},
        {"month": "2023-05", "revenue_members": 41000, "revenue_coaching": 10500, "new_members": 24, "lost_members": 12, "total_members": 160, "marketing_spend": 3700, "ad_spend": 2000, "loyer": 7500, "salaires": 20000, "utilities": 1700, "other_expenses": 1900},
        {"month": "2023-06", "revenue_members": 40500, "revenue_coaching": 11000, "new_members": 22, "lost_members": 15, "total_members": 167, "marketing_spend": 3400, "ad_spend": 1800, "loyer": 7500, "salaires": 20000, "utilities": 2200, "other_expenses": 1700},
        {"month": "2023-07", "revenue_members": 37000, "revenue_coaching": 7800, "new_members": 10, "lost_members": 19, "total_members": 158, "marketing_spend": 2200, "ad_spend": 1100, "loyer": 7500, "salaires": 20000, "utilities": 2500, "other_expenses": 1200},
        {"month": "2023-08", "revenue_members": 36000, "revenue_coaching": 7200, "new_members": 8, "lost_members": 17, "total_members": 149, "marketing_spend": 1900, "ad_spend": 900, "loyer": 7500, "salaires": 20000, "utilities": 2600, "other_expenses": 1100},
        {"month": "2023-09", "revenue_members": 42000, "revenue_coaching": 12000, "new_members": 30, "lost_members": 9, "total_members": 170, "marketing_spend": 4500, "ad_spend": 2500, "loyer": 7500, "salaires": 21000, "utilities": 2000, "other_expenses": 2200},
        {"month": "2023-10", "revenue_members": 44000, "revenue_coaching": 13500, "new_members": 34, "lost_members": 8, "total_members": 196, "marketing_spend": 5000, "ad_spend": 2800, "loyer": 7500, "salaires": 22000, "utilities": 1900, "other_expenses": 2400},
        {"month": "2023-11", "revenue_members": 45500, "revenue_coaching": 14000, "new_members": 30, "lost_members": 10, "total_members": 216, "marketing_spend": 4800, "ad_spend": 2600, "loyer": 7500, "salaires": 22000, "utilities": 2100, "other_expenses": 2200},
        {"month": "2023-12", "revenue_members": 47000, "revenue_coaching": 15000, "new_members": 28, "lost_members": 13, "total_members": 231, "marketing_spend": 4500, "ad_spend": 2400, "loyer": 7500, "salaires": 23000, "utilities": 2400, "other_expenses": 2600},
    ]
    for m in months_2023:
        total_revenue = m["revenue_members"] + m["revenue_coaching"]
        total_expenses = m["loyer"] + m["salaires"] + m["utilities"] + m["marketing_spend"] + m["ad_spend"] + m["other_expenses"]
        kpi = MonthlyKPI(**m, total_revenue=total_revenue, total_expenses=total_expenses, net_profit=total_revenue - total_expenses)
        await db.monthly_kpis.insert_one(kpi.model_dump())

    transactions_raw = [
        {"date": "2024-12-01", "description": "Loyer décembre", "amount": 8000, "type": "expense", "category": "LOYER", "sub_type": None},
        {"date": "2024-12-05", "description": "Cotisations membres S1", "amount": 13500, "type": "revenue", "category": "COTISATIONS", "sub_type": "members"},
        {"date": "2024-12-10", "description": "Salaires décembre", "amount": 26000, "type": "expense", "category": "SALAIRES", "sub_type": None},
        {"date": "2024-12-12", "description": "Coaching privé - Thomas R.", "amount": 4500, "type": "revenue", "category": "COACHING", "sub_type": "coaching"},
        {"date": "2024-12-15", "description": "Cotisations membres S2", "amount": 14000, "type": "revenue", "category": "COTISATIONS", "sub_type": "members"},
        {"date": "2024-12-18", "description": "Campagne Google Ads", "amount": 3000, "type": "expense", "category": "PUBLICITE", "sub_type": None},
        {"date": "2024-12-20", "description": "Électricité / Gaz", "amount": 2600, "type": "expense", "category": "UTILITIES", "sub_type": None},
        {"date": "2024-12-22", "description": "Boot Camp Holiday", "amount": 7000, "type": "revenue", "category": "COACHING", "sub_type": "coaching"},
        {"date": "2024-12-28", "description": "Cotisations membres S4", "amount": 16000, "type": "revenue", "category": "COTISATIONS", "sub_type": "members"},
        {"date": "2024-11-01", "description": "Loyer novembre", "amount": 8000, "type": "expense", "category": "LOYER", "sub_type": None},
        {"date": "2024-11-05", "description": "Cotisations membres novembre", "amount": 52500, "type": "revenue", "category": "COTISATIONS", "sub_type": "members"},
        {"date": "2024-11-10", "description": "Salaires novembre", "amount": 25000, "type": "expense", "category": "SALAIRES", "sub_type": None},
        {"date": "2024-11-15", "description": "Sessions coaching privées", "amount": 8000, "type": "revenue", "category": "COACHING", "sub_type": "coaching"},
        {"date": "2024-11-22", "description": "Campagne Instagram Ads", "amount": 3200, "type": "expense", "category": "PUBLICITE", "sub_type": None},
        {"date": "2024-10-01", "description": "Loyer octobre", "amount": 8000, "type": "expense", "category": "LOYER", "sub_type": None},
        {"date": "2024-10-05", "description": "Cotisations membres octobre", "amount": 51000, "type": "revenue", "category": "COTISATIONS", "sub_type": "members"},
        {"date": "2024-10-10", "description": "Salaires octobre", "amount": 25000, "type": "expense", "category": "SALAIRES", "sub_type": None},
        {"date": "2024-10-18", "description": "Coaching Rentrée Pack", "amount": 7500, "type": "revenue", "category": "COACHING", "sub_type": "coaching"},
        {"date": "2024-09-03", "description": "Loyer septembre", "amount": 8000, "type": "expense", "category": "LOYER", "sub_type": None},
        {"date": "2024-09-05", "description": "Cotisations Rentrée", "amount": 49000, "type": "revenue", "category": "COTISATIONS", "sub_type": "members"},
    ]
    for tx_data in transactions_raw:
        tx = AccountingTransaction(**tx_data)
        await db.accounting_transactions.insert_one(tx.model_dump())

    # ── Seed: Customer Members (Expiring Subscriptions) ──────────────────────
    members_raw = [
        {"name": "Marie Dupont", "email": "marie@example.com", "phone": "+41 79 123 4567", "membership": "Annuel", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-01-15", "subscription_end_date": "2025-01-15", "cash_collected": 1200},
        {"name": "Jean Martin", "email": "jean@example.com", "phone": "+41 79 234 5678", "membership": "Annuel", "member_type": "Membres PIF", "contract_signed_date": "2024-03-01", "subscription_end_date": "2025-03-01", "cash_collected": 1200},
        {"name": "Sophie Bernard", "email": "sophie@example.com", "phone": "+41 79 345 6789", "membership": "6 Mois", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-09-01", "subscription_end_date": "2025-03-01", "cash_collected": 650},
        {"name": "Pierre Leroy", "email": "pierre@example.com", "phone": "+41 79 456 7890", "membership": "Annuel PT", "member_type": "Membres PT", "contract_signed_date": "2024-06-15", "subscription_end_date": "2025-06-15", "cash_collected": 2400},
        {"name": "Emma Richard", "email": "emma@example.com", "phone": "+41 79 567 8901", "membership": "Mensuel", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-12-01", "subscription_end_date": "2025-01-01", "cash_collected": 120},
        {"name": "Lucas Moreau", "email": "lucas@example.com", "phone": "+41 79 678 9012", "membership": "6 Semaines", "member_type": "Membres PIF", "contract_signed_date": "2024-11-15", "subscription_end_date": "2024-12-27", "cash_collected": 180},
        {"name": "Chloé Simon", "email": "chloe@example.com", "phone": "+41 79 789 0123", "membership": "Annuel", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-02-01", "subscription_end_date": "2025-02-01", "cash_collected": 1200},
        {"name": "Thomas Laurent", "email": "thomas@example.com", "phone": "+41 79 890 1234", "membership": "Annuel PT", "member_type": "Membres PT", "contract_signed_date": "2024-04-15", "subscription_end_date": "2025-04-15", "cash_collected": 2400},
        {"name": "Camille Roux", "email": "camille@example.com", "phone": "+41 79 901 2345", "membership": "3 Mois", "member_type": "Membres Généraux Récurrents", "contract_signed_date": "2024-10-01", "subscription_end_date": "2025-01-01", "cash_collected": 350},
        {"name": "Hugo Petit", "email": "hugo@example.com", "phone": "+41 79 012 3456", "membership": "Annuel", "member_type": "Membres PIF", "contract_signed_date": "2024-08-01", "subscription_end_date": "2025-08-01", "cash_collected": 1200},
    ]
    member_ids = []
    for m in members_raw:
        member = CustomerMember(**m)
        doc = member.model_dump()
        member_ids.append(doc["id"])
        await db.customer_members.insert_one(doc)

    # ── Seed: Weekly Trainings (for KPI Clients) ─────────────────────────────
    import random
    for member_id in member_ids[:6]:  # First 6 members
        for week in range(1, 53):  # All weeks of 2024
            training = WeeklyTraining(
                member_id=member_id,
                calendar_year=2024,
                calendar_week=week,
                trainings_count=random.randint(1, 5)
            )
            await db.weekly_trainings.insert_one(training.model_dump())

    # ── Seed: 6 Weeks Challenge ──────────────────────────────────────────────
    challenge = SixWeeksChallenge(
        name="Challenge Hiver 2024",
        start_date="2024-11-15",
        end_date="2024-12-27",
        is_active=True
    )
    challenge_doc = challenge.model_dump()
    await db.six_weeks_challenges.insert_one(challenge_doc)

    # Add participants
    for i, member_id in enumerate(member_ids[:5]):
        participant = ChallengeParticipant(
            challenge_id=challenge_doc["id"],
            member_id=member_id,
            member_name=members_raw[i]["name"],
            week1=True,
            week2=True,
            week3=i < 4,  # 4 participants completed week 3
            week4=i < 3,  # 3 participants completed week 4
            week5=i < 2,  # 2 participants completed week 5
            week6=i < 1   # 1 participant completed week 6
        )
        await db.challenge_participants.insert_one(participant.model_dump())

    # ── Seed: Instructors ────────────────────────────────────────────────────
    instructors_raw = [
        {"name": "Coach Marc", "email": "marc@club.ch", "hourly_rate": 50, "is_active": True},
        {"name": "Coach Julie", "email": "julie@club.ch", "hourly_rate": 55, "is_active": True},
        {"name": "Coach Alex", "email": "alex@club.ch", "hourly_rate": 45, "is_active": True},
        {"name": "Coach Sarah", "email": "sarah@club.ch", "hourly_rate": 50, "is_active": False},
    ]
    for instr in instructors_raw:
        instructor = Instructor(**instr)
        await db.instructors.insert_one(instructor.model_dump())

    # ── Seed: Course KPIs ────────────────────────────────────────────────────
    courses_raw = [
        {"year": 2024, "month": 12, "day_of_week": "Lundi", "time_slot": "07:00", "course_name": "CrossFit Morning", "instructor": "Coach Marc", "max_capacity": 12, "week1_attendance": 10, "week2_attendance": 11, "week3_attendance": 9, "week4_attendance": 12},
        {"year": 2024, "month": 12, "day_of_week": "Lundi", "time_slot": "18:30", "course_name": "CrossFit Soir", "instructor": "Coach Julie", "max_capacity": 15, "week1_attendance": 14, "week2_attendance": 15, "week3_attendance": 13, "week4_attendance": 14},
        {"year": 2024, "month": 12, "day_of_week": "Mardi", "time_slot": "12:00", "course_name": "HIIT Express", "instructor": "Coach Alex", "max_capacity": 10, "week1_attendance": 8, "week2_attendance": 9, "week3_attendance": 7, "week4_attendance": 10},
        {"year": 2024, "month": 12, "day_of_week": "Mercredi", "time_slot": "07:00", "course_name": "CrossFit Morning", "instructor": "Coach Marc", "max_capacity": 12, "week1_attendance": 11, "week2_attendance": 10, "week3_attendance": 12, "week4_attendance": 11},
        {"year": 2024, "month": 12, "day_of_week": "Mercredi", "time_slot": "19:00", "course_name": "Mobility", "instructor": "Coach Julie", "max_capacity": 8, "week1_attendance": 6, "week2_attendance": 7, "week3_attendance": 8, "week4_attendance": 6},
        {"year": 2024, "month": 12, "day_of_week": "Jeudi", "time_slot": "18:30", "course_name": "CrossFit Soir", "instructor": "Coach Alex", "max_capacity": 15, "week1_attendance": 12, "week2_attendance": 14, "week3_attendance": 11, "week4_attendance": 13},
        {"year": 2024, "month": 12, "day_of_week": "Vendredi", "time_slot": "07:00", "course_name": "CrossFit Morning", "instructor": "Coach Marc", "max_capacity": 12, "week1_attendance": 9, "week2_attendance": 10, "week3_attendance": 8, "week4_attendance": 11},
        {"year": 2024, "month": 12, "day_of_week": "Samedi", "time_slot": "09:00", "course_name": "Open Gym", "instructor": "Coach Julie", "max_capacity": 20, "week1_attendance": 15, "week2_attendance": 18, "week3_attendance": 16, "week4_attendance": 17},
    ]
    for c in courses_raw:
        # Calculate attendance rate
        attendance_fields = ["week1_attendance", "week2_attendance", "week3_attendance", "week4_attendance"]
        total = sum(c.get(f, 0) for f in attendance_fields)
        weeks = sum(1 for f in attendance_fields if c.get(f, 0) > 0)
        rate = round((total / (weeks * c["max_capacity"])) * 100, 1) if weeks > 0 else 0
        
        course = CourseKPI(**c, month_name=MONTHS_FR[c["month"] - 1], attendance_rate=rate, monthly_expenses=c.get("max_capacity", 10) * 25)
        await db.course_kpis.insert_one(course.model_dump())

    return {
        "message": "Données de démonstration chargées",
        "months": len(months_raw) + len(months_2023),
        "transactions": len(transactions_raw),
        "categories": len(categories),
        "members": len(members_raw),
        "instructors": len(instructors_raw),
        "courses": len(courses_raw),
        "challenges": 1
    }


# ── Routes: Customer Members (Expiring Subscriptions) ────────────────────────

@api_router.get("/members")
async def get_members(
    expiring_soon: Optional[bool] = None,
    member_type: Optional[str] = None
):
    """Get all members, optionally filtered by expiring status or type"""
    query = {}
    if member_type:
        query["member_type"] = member_type
    
    docs = await db.customer_members.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    
    # Filter expiring soon (within 30 days)
    if expiring_soon:
        today = datetime.now(timezone.utc).date()
        thirty_days = today + timedelta(days=30)
        docs = [
            d for d in docs
            if d.get("subscription_end_date") and
            today <= datetime.fromisoformat(d["subscription_end_date"]).date() <= thirty_days
        ]
    
    return docs


@api_router.get("/members/expiring")
async def get_expiring_members(days: int = 30):
    """Get members with subscriptions expiring within N days"""
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days)
    
    docs = await db.customer_members.find({}, {"_id": 0}).to_list(1000)
    
    expiring = []
    for d in docs:
        if d.get("subscription_end_date") and not d.get("exit_date"):
            sub_end = datetime.fromisoformat(d["subscription_end_date"]).date()
            if today <= sub_end <= end_date:
                d["days_remaining"] = (sub_end - today).days
                expiring.append(d)
    
    # Sort by days remaining
    expiring.sort(key=lambda x: x.get("days_remaining", 999))
    return expiring


@api_router.get("/members/{member_id}")
async def get_member(member_id: str):
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    return doc


@api_router.post("/members")
async def create_member(data: CustomerMemberCreate):
    member = CustomerMember(**data.model_dump())
    doc = member.model_dump()
    await db.customer_members.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/members/{member_id}")
async def update_member(member_id: str, data: CustomerMemberCreate):
    existing = await db.customer_members.find_one({"id": member_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    
    update = {**data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.customer_members.update_one({"id": member_id}, {"$set": update})
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    return doc


@api_router.delete("/members/{member_id}")
async def delete_member(member_id: str):
    result = await db.customer_members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    # Also delete related data
    await db.weekly_trainings.delete_many({"member_id": member_id})
    await db.challenge_checkins.delete_many({"member_id": member_id})
    await db.member_renewals.delete_many({"member_id": member_id})
    return {"message": "Membre et données associées supprimés"}


@api_router.post("/members/{member_id}/renew")
async def renew_membership(member_id: str, body: dict):
    """Renew a member's subscription"""
    member = await db.customer_members.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    
    new_end_date = body.get("new_end_date")
    renewal_duration = body.get("renewal_duration", "12 mois")
    notes = body.get("notes", "")
    
    if not new_end_date:
        raise HTTPException(status_code=400, detail="new_end_date requis")
    
    # Record renewal history
    renewal = MemberRenewalHistory(
        member_id=member_id,
        previous_end_date=member.get("subscription_end_date"),
        new_end_date=new_end_date,
        renewal_duration=renewal_duration,
        notes=notes
    )
    await db.member_renewals.insert_one(renewal.model_dump())
    
    # Update member
    await db.customer_members.update_one(
        {"id": member_id},
        {"$set": {
            "subscription_end_date": new_end_date,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    return {"member": doc, "message": "Abonnement renouvelé"}


@api_router.get("/members/{member_id}/renewals")
async def get_member_renewals(member_id: str):
    """Get renewal history for a member"""
    docs = await db.member_renewals.find({"member_id": member_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs


# ── Routes: Weekly Trainings (Client KPIs - Engagement) ──────────────────────

@api_router.get("/trainings")
async def get_trainings(
    member_id: Optional[str] = None,
    year: Optional[int] = None,
    week: Optional[int] = None
):
    """Get weekly trainings, optionally filtered"""
    query = {}
    if member_id:
        query["member_id"] = member_id
    if year:
        query["calendar_year"] = year
    if week:
        query["calendar_week"] = week
    
    docs = await db.weekly_trainings.find(query, {"_id": 0}).to_list(5000)
    return docs


@api_router.post("/trainings")
async def upsert_training(data: WeeklyTrainingUpdate):
    """Create or update weekly training record"""
    existing = await db.weekly_trainings.find_one({
        "member_id": data.member_id,
        "calendar_year": data.calendar_year,
        "calendar_week": data.calendar_week
    })
    
    if existing:
        await db.weekly_trainings.update_one(
            {"id": existing["id"]},
            {"$set": {
                "trainings_count": data.trainings_count,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        doc = await db.weekly_trainings.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        training = WeeklyTraining(**data.model_dump())
        doc = training.model_dump()
        await db.weekly_trainings.insert_one(doc)
        doc.pop('_id', None)
    
    return doc


@api_router.get("/trainings/summary/{member_id}")
async def get_member_training_summary(member_id: str, year: Optional[int] = None):
    """Get training summary for a member"""
    query = {"member_id": member_id}
    if year:
        query["calendar_year"] = year
    
    docs = await db.weekly_trainings.find(query, {"_id": 0}).to_list(100)
    
    total_trainings = sum(d.get("trainings_count", 0) for d in docs)
    weeks_with_data = len(docs)
    avg_per_week = round(total_trainings / weeks_with_data, 1) if weeks_with_data > 0 else 0
    
    # Determine engagement level
    if avg_per_week >= 4:
        engagement = "Excellent"
    elif avg_per_week >= 3:
        engagement = "Bon"
    elif avg_per_week >= 2:
        engagement = "Moyen"
    else:
        engagement = "Faible"
    
    return {
        "member_id": member_id,
        "total_trainings": total_trainings,
        "weeks_tracked": weeks_with_data,
        "avg_per_week": avg_per_week,
        "engagement_level": engagement,
        "details": docs
    }


# ── Routes: 6 Weeks Challenge ────────────────────────────────────────────────

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


@api_router.get("/challenges")
async def get_challenges(active_only: Optional[bool] = None):
    """Get all 6-weeks challenges"""
    query = {}
    if active_only:
        query["is_active"] = True
    docs = await db.six_weeks_challenges.find(query, {"_id": 0}).sort("start_date", -1).to_list(100)
    return docs


@api_router.get("/challenges/{challenge_id}")
async def get_challenge(challenge_id: str):
    doc = await db.six_weeks_challenges.find_one({"id": challenge_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Challenge introuvable")
    
    # Get participants
    participants = await db.challenge_participants.find({"challenge_id": challenge_id}, {"_id": 0}).to_list(200)
    doc["participants"] = participants
    doc["participant_count"] = len(participants)
    
    return doc


@api_router.post("/challenges")
async def create_challenge(data: SixWeeksChallengeCreate):
    challenge = SixWeeksChallenge(**data.model_dump())
    doc = challenge.model_dump()
    await db.six_weeks_challenges.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/challenges/{challenge_id}")
async def update_challenge(challenge_id: str, data: SixWeeksChallengeCreate):
    existing = await db.six_weeks_challenges.find_one({"id": challenge_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Challenge introuvable")
    
    await db.six_weeks_challenges.update_one({"id": challenge_id}, {"$set": data.model_dump()})
    doc = await db.six_weeks_challenges.find_one({"id": challenge_id}, {"_id": 0})
    return doc


@api_router.delete("/challenges/{challenge_id}")
async def delete_challenge(challenge_id: str):
    result = await db.six_weeks_challenges.delete_one({"id": challenge_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Challenge introuvable")
    # Delete participants
    await db.challenge_participants.delete_many({"challenge_id": challenge_id})
    return {"message": "Challenge et participants supprimés"}


@api_router.post("/challenges/{challenge_id}/participants")
async def add_challenge_participant(challenge_id: str, data: ChallengeParticipantCreate):
    # Check challenge exists
    challenge = await db.six_weeks_challenges.find_one({"id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge introuvable")
    
    # Check not already participant
    existing = await db.challenge_participants.find_one({
        "challenge_id": challenge_id,
        "member_id": data.member_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ce membre participe déjà au challenge")
    
    participant = ChallengeParticipant(**data.model_dump())
    doc = participant.model_dump()
    await db.challenge_participants.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/challenges/{challenge_id}/participants/{participant_id}")
async def update_participant_checkins(challenge_id: str, participant_id: str, body: dict):
    """Update weekly check-ins for a participant"""
    existing = await db.challenge_participants.find_one({"id": participant_id, "challenge_id": challenge_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Participant introuvable")
    
    update = {
        "week1": body.get("week1", existing.get("week1", False)),
        "week2": body.get("week2", existing.get("week2", False)),
        "week3": body.get("week3", existing.get("week3", False)),
        "week4": body.get("week4", existing.get("week4", False)),
        "week5": body.get("week5", existing.get("week5", False)),
        "week6": body.get("week6", existing.get("week6", False)),
        "notes": body.get("notes", existing.get("notes", "")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.challenge_participants.update_one({"id": participant_id}, {"$set": update})
    doc = await db.challenge_participants.find_one({"id": participant_id}, {"_id": 0})
    return doc


@api_router.delete("/challenges/{challenge_id}/participants/{participant_id}")
async def remove_participant(challenge_id: str, participant_id: str):
    result = await db.challenge_participants.delete_one({"id": participant_id, "challenge_id": challenge_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Participant introuvable")
    return {"message": "Participant retiré du challenge"}


# ── Routes: Course KPIs ──────────────────────────────────────────────────────

@api_router.get("/courses")
async def get_courses(year: Optional[int] = None, month: Optional[int] = None):
    """Get course KPIs, optionally filtered by year/month"""
    query = {}
    if year:
        query["year"] = year
    if month:
        query["month"] = month
    
    docs = await db.course_kpis.find(query, {"_id": 0}).sort([("day_of_week", 1), ("time_slot", 1)]).to_list(500)
    return docs


@api_router.get("/courses/{course_id}")
async def get_course(course_id: str):
    doc = await db.course_kpis.find_one({"id": course_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Cours introuvable")
    return doc


@api_router.post("/courses")
async def create_course(data: CourseKPICreate):
    # Set month name
    month_name = MONTHS_FR[data.month - 1] if 1 <= data.month <= 12 else ""
    
    course = CourseKPI(**data.model_dump(), month_name=month_name)
    doc = course.model_dump()
    await db.course_kpis.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/courses/{course_id}")
async def update_course(course_id: str, body: dict):
    """Update course KPI including weekly attendance"""
    existing = await db.course_kpis.find_one({"id": course_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Cours introuvable")
    
    # Calculate attendance rate
    attendance_fields = ["week1_attendance", "week2_attendance", "week3_attendance", "week4_attendance", "week5_attendance"]
    total_attendance = sum(body.get(f, existing.get(f, 0)) for f in attendance_fields)
    max_capacity = body.get("max_capacity", existing.get("max_capacity", 10))
    weeks_with_data = sum(1 for f in attendance_fields if body.get(f, existing.get(f, 0)) > 0)
    
    if weeks_with_data > 0 and max_capacity > 0:
        attendance_rate = round((total_attendance / (weeks_with_data * max_capacity)) * 100, 1)
    else:
        attendance_rate = 0
    
    body["attendance_rate"] = attendance_rate
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.course_kpis.update_one({"id": course_id}, {"$set": body})
    doc = await db.course_kpis.find_one({"id": course_id}, {"_id": 0})
    return doc


@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    result = await db.course_kpis.delete_one({"id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cours introuvable")
    return {"message": "Cours supprimé"}


@api_router.get("/courses/summary/{year}/{month}")
async def get_courses_summary(year: int, month: int):
    """Get summary statistics for courses in a month"""
    docs = await db.course_kpis.find({"year": year, "month": month}, {"_id": 0}).to_list(500)
    
    if not docs:
        return {
            "year": year,
            "month": month,
            "month_name": MONTHS_FR[month - 1] if 1 <= month <= 12 else "",
            "total_courses": 0,
            "avg_attendance_rate": 0,
            "total_expenses": 0,
            "by_day": {}
        }
    
    total_attendance = sum(d.get("attendance_rate", 0) for d in docs)
    avg_attendance = round(total_attendance / len(docs), 1) if docs else 0
    total_expenses = sum(d.get("monthly_expenses", 0) for d in docs)
    
    # Group by day
    by_day = {}
    for d in docs:
        day = d.get("day_of_week", "Autre")
        if day not in by_day:
            by_day[day] = {"count": 0, "courses": []}
        by_day[day]["count"] += 1
        by_day[day]["courses"].append(d.get("course_name", ""))
    
    return {
        "year": year,
        "month": month,
        "month_name": MONTHS_FR[month - 1] if 1 <= month <= 12 else "",
        "total_courses": len(docs),
        "avg_attendance_rate": avg_attendance,
        "total_expenses": total_expenses,
        "by_day": by_day
    }


# ── Routes: Instructors ──────────────────────────────────────────────────────

@api_router.get("/instructors")
async def get_instructors(active_only: Optional[bool] = None):
    query = {}
    if active_only:
        query["is_active"] = True
    docs = await db.instructors.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    return docs


@api_router.post("/instructors")
async def create_instructor(body: dict):
    instructor = Instructor(
        name=body.get("name", ""),
        email=body.get("email"),
        hourly_rate=body.get("hourly_rate", 0),
        is_active=body.get("is_active", True)
    )
    doc = instructor.model_dump()
    await db.instructors.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.put("/instructors/{instructor_id}")
async def update_instructor(instructor_id: str, body: dict):
    existing = await db.instructors.find_one({"id": instructor_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Instructeur introuvable")
    
    await db.instructors.update_one({"id": instructor_id}, {"$set": body})
    doc = await db.instructors.find_one({"id": instructor_id}, {"_id": 0})
    return doc


@api_router.delete("/instructors/{instructor_id}")
async def delete_instructor(instructor_id: str):
    result = await db.instructors.delete_one({"id": instructor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Instructeur introuvable")
    return {"message": "Instructeur supprimé"}


# ── App Setup ────────────────────────────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
