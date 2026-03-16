"""Transaction, Category, Excluded, Recurring Transaction routes"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime, timezone
from calendar import monthrange
from pydantic import BaseModel

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
    ).to_list(10000)

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

    # Build update with both English and French aliases for expenses
    ALIASES = {
        "rent": "loyer", "salaries": "salaires",
        "salaires_coach": "salaires_coachs",
        "ad_spend": "marketing_spend",
    }
    
    update = {
        **{col: totals_by_col.get(col, 0) for col in {c.get("kpi_column") for c in cats if c.get("kpi_column")}},
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": total_revenue - total_expenses,
        "profit": total_revenue - total_expenses,
        "active_members": active_count,
        "cash_collected": total_rev_tx,
        "revenue_members": totals_by_col.get("general_eft_revenue", 0),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Set aliases
    for eng, fr in ALIASES.items():
        if eng in totals_by_col:
            update[fr] = totals_by_col[eng]
        elif eng in update:
            update[fr] = update[eng]
    
    await db.monthly_kpis.update_one({"month": month}, {"$set": update}, upsert=True)


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get("/transactions")
async def get_transactions(month: Optional[str] = None):
    query = {}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    return await db.accounting_transactions.find(query, {"_id": 0}).sort("date", -1).to_list(10000)


@router.post("/transactions")
async def create_transaction(data: TransactionCreate):
    excluded = await db.excluded_recurring_expenses.find_one({
        "category": data.category, "description": data.description
    })
    if excluded:
        raise HTTPException(status_code=400, detail="Cette transaction a été exclue précédemment")
    tx = AccountingTransaction(**data.model_dump())
    doc = tx.model_dump()
    # Auto-fill year/month from date
    if doc.get("date") and len(doc["date"]) >= 7:
        try:
            doc["year"] = int(doc["date"][:4])
            doc["month"] = int(doc["date"][5:7])
        except (ValueError, IndexError):
            pass
    await db.accounting_transactions.insert_one(doc)
    doc.pop('_id', None)
    await _auto_recalculate_kpis(doc.get("date", ""))
    return doc


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    client_name: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


@router.put("/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, data: TransactionUpdate):
    tx = await db.accounting_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "date" in updates and len(updates["date"]) >= 7:
        try:
            updates["year"] = int(updates["date"][:4])
            updates["month"] = int(updates["date"][5:7])
        except (ValueError, IndexError):
            pass
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.accounting_transactions.update_one({"id": transaction_id}, {"$set": updates})
    # Recalculate KPIs for old and new months
    old_date = tx.get("date", "")
    new_date = updates.get("date", old_date)
    await _auto_recalculate_kpis(old_date)
    if new_date[:7] != old_date[:7]:
        await _auto_recalculate_kpis(new_date)
    updated = await db.accounting_transactions.find_one({"id": transaction_id}, {"_id": 0})
    return updated



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



# ── Monthly Grid (édition des prix par mois) ─────────────────────────────────

MONTH_NAMES = {
    1: "Jan", 2: "Fév", 3: "Mar", 4: "Avr", 5: "Mai", 6: "Jun",
    7: "Jul", 8: "Aoû", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Déc"
}


@router.get("/transactions/monthly-grid")
async def get_monthly_grid(year: int, type: Optional[str] = None):
    """Get transactions summarized by category and month for a given year."""
    cats = await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)
    cat_filter = {}
    if type:
        cat_filter = {"type": type}
        cats = [c for c in cats if c.get("type") == type]

    # Get all transactions for the year
    txs = await db.accounting_transactions.find(
        {"date": {"$regex": f"^{year}"}}, {"_id": 0}
    ).to_list(50000)

    # Build grid: category → month → total amount
    grid = {}
    for tx in txs:
        cat = tx.get("category", "")
        try:
            m = int(tx.get("date", "")[5:7])
        except (ValueError, IndexError):
            continue
        if cat not in grid:
            grid[cat] = {}
        grid[cat][m] = grid[cat].get(m, 0) + tx.get("amount", 0)

    # Format response
    result = []
    for c in sorted(cats, key=lambda x: x.get("position", 0)):
        cat_name = c["name"]
        months = {}
        year_total = 0
        for m in range(1, 13):
            val = round(grid.get(cat_name, {}).get(m, 0), 2)
            months[str(m)] = val
            year_total += val
        result.append({
            "id": c["id"],
            "category": cat_name,
            "type": c["type"],
            "is_recurring": c.get("is_recurring", False),
            "default_amount": c.get("default_amount", 0),
            "revenue_type": c.get("revenue_type"),
            "months": months,
            "year_total": round(year_total, 2),
        })

    return result


class MonthlyAmountUpdate(BaseModel):
    category: str
    year: int
    month: int
    amount: float
    description: Optional[str] = None


@router.put("/transactions/update-monthly-amount")
async def update_monthly_amount(data: MonthlyAmountUpdate):
    """Update or create a transaction for a specific category/month."""
    month_str = f"{data.year}-{data.month:02d}"

    # Find existing transactions for this category/month
    existing = await db.accounting_transactions.find(
        {"category": data.category, "date": {"$regex": f"^{month_str}"}}, {"_id": 0}
    ).to_list(1000)

    # Determine category type
    cat = await db.accounting_categories.find_one({"name": data.category}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")

    if len(existing) == 1:
        # Update the single transaction
        await db.accounting_transactions.update_one(
            {"id": existing[0]["id"]},
            {"$set": {
                "amount": data.amount,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        tx_date = existing[0]["date"]
    elif len(existing) == 0:
        # Create a new transaction
        day = cat.get("recurrence_day", 1) or 1
        max_day = monthrange(data.year, data.month)[1]
        day = min(day, max_day)
        tx_date = f"{data.year}-{data.month:02d}-{day:02d}"
        
        tx = AccountingTransaction(
            date=tx_date,
            description=data.description or cat["name"],
            amount=data.amount,
            type=cat["type"],
            category=data.category,
            is_auto_generated=False,
            year=data.year,
            month=data.month,
            month_name=MONTH_NAMES.get(data.month, ""),
        )
        doc = tx.model_dump()
        await db.accounting_transactions.insert_one(doc)
        doc.pop("_id", None)
    else:
        # Multiple transactions: compute the difference and apply to the first auto-generated or first one
        current_total = sum(t.get("amount", 0) for t in existing)
        diff = data.amount - current_total
        if abs(diff) > 0.01:
            # Find an auto-generated tx to adjust, or the first one
            target = next((t for t in existing if t.get("is_auto_generated")), existing[0])
            new_amount = target["amount"] + diff
            await db.accounting_transactions.update_one(
                {"id": target["id"]},
                {"$set": {
                    "amount": round(new_amount, 2),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        tx_date = existing[0]["date"]

    # Recalculate KPIs
    await _auto_recalculate_kpis(f"{month_str}-01")
    return {"status": "ok", "category": data.category, "month": month_str, "amount": data.amount}
