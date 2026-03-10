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


MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
             "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]


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

    return {
        "message": "Données de démonstration chargées",
        "months": len(months_raw) + len(months_2023),
        "transactions": len(transactions_raw),
        "categories": len(categories)
    }


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
