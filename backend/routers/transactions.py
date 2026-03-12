"""Transaction, Category, Excluded, Recurring Transaction routes"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime, timezone
from calendar import monthrange

from core.config import db, MONTHS_FR
from models.transactions import (
    AccountingCategory, CategoryCreate,
    AccountingTransaction, TransactionCreate,
    ExcludedRecurringExpense, RecurringTransaction, RecurringTransactionCreate
)

router = APIRouter(tags=["transactions"])


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get("/transactions")
async def get_transactions(month: Optional[str] = None):
    query = {}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    return await db.accounting_transactions.find(query, {"_id": 0}).sort("date", -1).to_list(1000)


@router.post("/transactions")
async def create_transaction(data: TransactionCreate):
    excluded = await db.excluded_recurring_expenses.find_one({
        "category": data.category, "description": data.description
    })
    if excluded:
        raise HTTPException(status_code=400, detail="Cette transaction a été exclue précédemment")
    tx = AccountingTransaction(**data.model_dump())
    doc = tx.model_dump()
    await db.accounting_transactions.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.delete("/transactions/{transaction_id}")
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


@router.post("/transactions/bulk")
async def bulk_import_transactions(transactions: List[TransactionCreate]):
    imported, skipped = [], []
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


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories")
async def get_categories():
    return await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)


@router.post("/categories")
async def create_category(data: CategoryCreate):
    cat = AccountingCategory(**data.model_dump())
    doc = cat.model_dump()
    await db.accounting_categories.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    result = await db.accounting_categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    return {"message": "Catégorie supprimée"}


# ── Excluded ──────────────────────────────────────────────────────────────────

@router.get("/excluded")
async def get_excluded():
    return await db.excluded_recurring_expenses.find({}, {"_id": 0}).to_list(1000)


@router.delete("/excluded/{excluded_id}")
async def remove_from_exclusions(excluded_id: str):
    result = await db.excluded_recurring_expenses.delete_one({"id": excluded_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exclusion introuvable")
    return {"message": "Exclusion supprimée"}


# ── Recurring Transactions ────────────────────────────────────────────────────

@router.get("/recurring-transactions")
async def get_recurring_transactions():
    return await db.recurring_transactions.find({}, {"_id": 0}).to_list(1000)


@router.post("/recurring-transactions")
async def create_recurring_transaction(data: RecurringTransactionCreate):
    rec = RecurringTransaction(**data.model_dump())
    doc = rec.model_dump()
    await db.recurring_transactions.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/recurring-transactions/{rec_id}")
async def update_recurring_transaction(rec_id: str, data: RecurringTransactionCreate):
    existing = await db.recurring_transactions.find_one({"id": rec_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction récurrente introuvable")
    update = {**data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.recurring_transactions.update_one({"id": rec_id}, {"$set": update})
    return await db.recurring_transactions.find_one({"id": rec_id}, {"_id": 0})


@router.delete("/recurring-transactions/{rec_id}")
async def delete_recurring_transaction(rec_id: str):
    result = await db.recurring_transactions.delete_one({"id": rec_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction récurrente introuvable")
    return {"message": "Transaction récurrente supprimée"}


@router.post("/recurring-transactions/generate/{year}/{month}")
async def generate_monthly_transactions(year: int, month: int):
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mois invalide (1-12)")
    recurring = await db.recurring_transactions.find({"is_active": True}, {"_id": 0}).to_list(1000)
    if not recurring:
        raise HTTPException(status_code=404, detail="Aucune transaction récurrente active")
    excluded = await db.excluded_recurring_expenses.find({}, {"_id": 0}).to_list(1000)
    excluded_keys = {(e["category"], e["description"]) for e in excluded}
    month_str = f"{year}-{month:02d}"
    days_in_month = monthrange(year, month)[1]
    created, skipped = [], []
    for rec in recurring:
        if (rec["category"], rec["description"]) in excluded_keys:
            skipped.append(rec["description"])
            continue
        day = min(rec.get("recurrence_day", 1), days_in_month)
        tx = AccountingTransaction(
            date=f"{month_str}-{day:02d}",
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
        "month_name": MONTHS_FR[month - 1],
        "created": len(created),
        "skipped": len(skipped),
        "transactions": created
    }
