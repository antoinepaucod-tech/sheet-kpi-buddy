from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
    excluded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


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
        amount=tx.get('amount', 0)
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
