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


async def _auto_recalculate_kpis(tx_date: str):
    """Auto-recalculate KPIs for the month of the given transaction date."""
    if not tx_date or len(tx_date) < 7:
        return
    month = tx_date[:7]  # "YYYY-MM"

    cats = await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)
    cat_map = {c["name"]: c for c in cats}

    txs = await db.accounting_transactions.find(
        {"date": {"$regex": f"^{month}"}}, {"_id": 0}
    ).to_list(1000)

    existing = await db.monthly_kpis.find_one({"month": month}, {"_id": 0}) or {}

    # Sum by kpi_column
    totals_by_col = {}
    for tx in txs:
        cat_info = cat_map.get(tx.get("category"))
        if cat_info and cat_info.get("kpi_column"):
            col = cat_info["kpi_column"]
            totals_by_col[col] = totals_by_col.get(col, 0) + tx["amount"]

    merged = dict(existing)
    for col, val in totals_by_col.items():
        merged[col] = val
    # Zero out kpi_columns that have no transactions anymore
    for c in cats:
        kpi_col = c.get("kpi_column")
        if kpi_col and kpi_col not in totals_by_col:
            merged[kpi_col] = 0

    revenue_cols = {c["kpi_column"] for c in cats if c.get("kpi_column") and c["type"] == "revenue"}
    expense_cols = {c["kpi_column"] for c in cats if c.get("kpi_column") and c["type"] == "expense"}

    total_rev_tx = sum(merged.get(col, 0) for col in revenue_cols)
    fast_cash = merged.get("fast_cash_revenue", 0)
    total_revenue = total_rev_tx if total_rev_tx > 0 else fast_cash
    total_expenses = sum(merged.get(col, 0) for col in expense_cols)

    # Count actual active members
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    active_count = await db.customer_members.count_documents({
        "subscription_end_date": {"$gte": today}
    })

    update = {
        **{col: totals_by_col.get(col, 0) for col in {c.get("kpi_column") for c in cats if c.get("kpi_column")}},
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": total_revenue - total_expenses,
        "active_members": active_count,
        "cash_collected": total_rev_tx,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.monthly_kpis.update_one({"month": month}, {"$set": update}, upsert=True)


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
    await _auto_recalculate_kpis(doc.get("date", ""))
    return doc


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    tx = await db.accounting_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    # Only create exclusion if this transaction matches a recurring template
    recurring = await db.recurring_transactions.find_one({
        "category": tx.get("category", ""),
        "description": tx.get("description", ""),
    }, {"_id": 0})
    if recurring:
        excl = ExcludedRecurringExpense(
            original_transaction_id=transaction_id,
            category=tx.get('category', ''),
            description=tx.get('description', ''),
            amount=tx.get('amount', 0),
            type=tx.get('type', 'expense'),
            sub_type=tx.get('sub_type'),
            date=tx.get('date'),
        )
        await db.excluded_recurring_expenses.insert_one(excl.model_dump())
    await db.accounting_transactions.delete_one({"id": transaction_id})
    await _auto_recalculate_kpis(tx.get("date", ""))
    return {"message": "Transaction supprimée"}


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


@router.put("/categories/{category_id}")
async def update_category(category_id: str, data: CategoryCreate):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.accounting_categories.update_one(
        {"id": category_id}, {"$set": update}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    doc = await db.accounting_categories.find_one({"id": category_id}, {"_id": 0})
    return doc



# ── Excluded ──────────────────────────────────────────────────────────────────

@router.get("/excluded")
async def get_excluded():
    return await db.excluded_recurring_expenses.find({}, {"_id": 0}).to_list(1000)


@router.delete("/excluded/{excluded_id}")
async def remove_from_exclusions(excluded_id: str):
    # Find the excluded record first
    excl = await db.excluded_recurring_expenses.find_one({"id": excluded_id}, {"_id": 0})
    if not excl:
        raise HTTPException(status_code=404, detail="Exclusion introuvable")

    # Restore the transaction back to accounting_transactions
    restored_tx = AccountingTransaction(
        date=excl.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        description=excl.get("description", ""),
        amount=excl.get("amount", 0),
        type=excl.get("type", "expense"),
        category=excl.get("category", ""),
    )
    doc = restored_tx.model_dump()
    await db.accounting_transactions.insert_one(doc)
    doc.pop("_id", None)

    # Remove from exclusions
    await db.excluded_recurring_expenses.delete_one({"id": excluded_id})
    await _auto_recalculate_kpis(doc.get("date", ""))
    return {"message": "Transaction restaurée", "transaction": doc}


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
    # Auto-recalculate KPIs for the generated month
    if created:
        await _auto_recalculate_kpis(created[0]["date"])

    return {
        "month": month_str,
        "month_name": MONTHS_FR[month - 1],
        "created": len(created),
        "skipped": len(skipped),
        "transactions": created
    }



# ── Recurring Validations ─────────────────────────────────────────────────────

@router.get("/recurring-validations/{year_month}")
async def get_recurring_validations(year_month: str):
    """Get all validations for a given month."""
    docs = await db.recurring_validations.find(
        {"month": year_month}, {"_id": 0}
    ).to_list(1000)
    return docs


@router.post("/recurring-validations")
async def validate_recurring(body: dict):
    """Validate (confirm payment/receipt) a recurring transaction for a month."""
    recurring_id = body.get("recurring_id")
    month = body.get("month")
    if not recurring_id or not month:
        raise HTTPException(status_code=400, detail="recurring_id et month requis")

    existing = await db.recurring_validations.find_one(
        {"recurring_id": recurring_id, "month": month}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Déjà validée pour ce mois")

    rec = await db.recurring_transactions.find_one({"id": recurring_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Transaction récurrente introuvable")

    validation = {
        "id": str(__import__("uuid").uuid4()),
        "recurring_id": recurring_id,
        "month": month,
        "description": rec.get("description", ""),
        "category": rec.get("category", ""),
        "amount": rec.get("amount", 0),
        "type": rec.get("type", "expense"),
        "validated": True,
        "validated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.recurring_validations.insert_one(validation)
    validation.pop("_id", None)
    return validation


@router.delete("/recurring-validations/{validation_id}")
async def unvalidate_recurring(validation_id: str):
    """Remove a validation (unconfirm)."""
    result = await db.recurring_validations.delete_one({"id": validation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Validation introuvable")
    return {"message": "Validation annulée"}
