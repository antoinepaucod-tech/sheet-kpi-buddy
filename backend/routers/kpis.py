"""KPI routes"""
from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime, timezone

from core.config import db
from models.kpi import MonthlyKPI, MonthlyKPICreate, compute_metrics

router = APIRouter(prefix="/monthly-kpis", tags=["kpis"])


@router.get("")
async def get_monthly_kpis():
    docs = await db.monthly_kpis.find({}, {"_id": 0}).sort("month", 1).to_list(1000)

    # Enrich with real churn from member exit_dates
    members = await db.customer_members.find(
        {}, {"_id": 0, "exit_date": 1, "subscription_end_date": 1, "is_duplicate": 1}
    ).to_list(10000)

    for doc in docs:
        month = doc.get("month", "")  # e.g. "2026-03"
        if not month:
            continue
        # Count members who left this month (exit_date starts with this month)
        lost = sum(
            1 for m in members
            if m.get("exit_date") and m["exit_date"].startswith(month)
            and not m.get("is_duplicate")
        )
        if lost > 0 and doc.get("lost_members", 0) == 0:
            doc["lost_members"] = lost

    return [compute_metrics(d) for d in docs]


@router.get("/{month}")
async def get_monthly_kpi(month: str):
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    return compute_metrics(doc)


@router.post("")
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


@router.post("/bulk")
async def bulk_import_kpis(data: List[dict]):
    imported, updated = 0, 0
    for kpi_data in data:
        month = kpi_data.get("month")
        if not month:
            continue
        mapped = {
            "month": month,
            "year": kpi_data.get("year"),
            "month_name": kpi_data.get("month_name", ""),
            "total_revenue": kpi_data.get("total_revenue", 0),
            "revenue_members": kpi_data.get("revenue_members", 0),
            "revenue_coaching": kpi_data.get("revenue_coaching", 0),
            "total_members": kpi_data.get("total_members", kpi_data.get("total_active_members", 0)),
            "new_members": kpi_data.get("new_members", 0),
            "lost_members": kpi_data.get("lost_members", 0),
            "total_expenses": kpi_data.get("total_expenses", 0),
            "marketing_spend": kpi_data.get("marketing_spend", 0),
            "ad_spend": kpi_data.get("ad_spend", 0),
            "loyer": kpi_data.get("loyer", kpi_data.get("rent", 0)),
            "salaires": kpi_data.get("salaires", 0),
            "utilities": kpi_data.get("utilities", 0),
            "other_expenses": kpi_data.get("other_expenses", 0),
            "note": kpi_data.get("note", ""),
        }
        existing = await db.monthly_kpis.find_one({"month": month})
        if existing:
            mapped['updated_at'] = datetime.now(timezone.utc).isoformat()
            await db.monthly_kpis.update_one({"month": month}, {"$set": mapped})
            updated += 1
        else:
            kpi = MonthlyKPI(**{k: v for k, v in mapped.items() if v is not None})
            await db.monthly_kpis.insert_one(kpi.model_dump())
            imported += 1
    return {"imported": imported, "updated": updated, "total": imported + updated}


@router.patch("/{month}/note")
async def update_note(month: str, body: dict):
    note = body.get("note", "")
    await db.monthly_kpis.update_one(
        {"month": month},
        {"$set": {"note": note, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    return compute_metrics(doc) if doc else {"error": "Mois introuvable"}


@router.get("/{month}/details")
async def get_monthly_kpi_details(month: str):
    """Return KPI data enriched with transaction breakdown and recurring info."""
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    kpi = compute_metrics(doc)

    # Get categories
    cats = await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)
    cat_map = {c["name"]: c for c in cats}

    # Get actual transactions for this month
    txs = await db.accounting_transactions.find(
        {"date": {"$regex": f"^{month}"}}, {"_id": 0}
    ).to_list(1000)

    # Build breakdown by category using the TRANSACTION's own type field
    revenue_breakdown = []
    expense_breakdown = []
    for cat_name, cat_info in cat_map.items():
        cat_txs = [tx for tx in txs if tx.get("category") == cat_name]
        if not cat_txs:
            continue
        total = sum(tx["amount"] for tx in cat_txs)
        entry = {
            "category": cat_name,
            "kpi_column": cat_info.get("kpi_column", ""),
            "total": total,
            "count": len(cat_txs),
            "transactions": [
                {"date": tx["date"], "description": tx["description"], "amount": tx["amount"], "client_name": tx.get("client_name", "")}
                for tx in cat_txs
            ],
        }
        # Use individual transaction types; if mixed, use majority
        tx_types = [tx.get("type", cat_info["type"]) for tx in cat_txs]
        is_revenue = tx_types.count("revenue") >= tx_types.count("expense")
        if is_revenue:
            revenue_breakdown.append(entry)
        else:
            expense_breakdown.append(entry)

    # Also handle transactions with categories NOT in accounting_categories
    categorized_cats = set(cat_map.keys())
    uncategorized_txs = [tx for tx in txs if tx.get("category") not in categorized_cats]
    if uncategorized_txs:
        # Group by category
        uncat_groups = {}
        for tx in uncategorized_txs:
            cat = tx.get("category", "Autre")
            uncat_groups.setdefault(cat, []).append(tx)
        for cat, group_txs in uncat_groups.items():
            total = sum(tx["amount"] for tx in group_txs)
            entry = {
                "category": cat,
                "kpi_column": "",
                "total": total,
                "count": len(group_txs),
                "transactions": [
                    {"date": tx["date"], "description": tx["description"], "amount": tx["amount"], "client_name": tx.get("client_name", "")}
                    for tx in group_txs
                ],
            }
            tx_types = [tx.get("type", "revenue") for tx in group_txs]
            if tx_types.count("revenue") >= tx_types.count("expense"):
                revenue_breakdown.append(entry)
            else:
                expense_breakdown.append(entry)

    # Get active recurring billing from payment_schedules and members
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    schedules = await db.payment_schedules.find(
        {"is_active": True,
         "start_date": {"$lte": f"{month}-31"},
         "$or": [
             {"end_date": {"$gte": f"{month}-01"}},
             {"end_date": None}, {"end_date": ""},
             {"end_date": {"$exists": False}}
         ]},
        {"_id": 0}
    ).to_list(5000)

    # If no payment_schedules match, fall back to billing-enabled members
    if not schedules:
        billing_members = await db.customer_members.find(
            {"billing_enabled": True, "billing_amount": {"$gt": 0},
             "$or": [
                 {"exit_date": None}, {"exit_date": ""},
                 {"exit_date": {"$exists": False}}, {"exit_date": {"$gte": today_str}}
             ]},
            {"_id": 0, "id": 1, "name": 1, "billing_amount": 1, "membership": 1,
             "billing_cycle_type": 1, "billing_cycle_value": 1, "billing_payment_method": 1}
        ).to_list(5000)
        schedules = [{
            "id": m["id"],
            "member_name": m.get("name", ""),
            "membership": m.get("membership", ""),
            "amount": m.get("billing_amount", 0),
            "billing_cycle_type": m.get("billing_cycle_type", "monthly_day"),
            "billing_cycle_value": m.get("billing_cycle_value", 1),
            "billing_payment_method": m.get("billing_payment_method", "prelevement"),
            "type": "revenue",
            "description": m.get("membership", ""),
            "is_active": True,
        } for m in billing_members]

    recurring_revenue = [s for s in schedules if s.get("amount", 0) > 0]
    recurring_expense = []

    # Also get recurring expense templates
    recurring_exp_docs = await db.recurring_transactions.find(
        {"is_active": True, "type": "expense"}, {"_id": 0}
    ).to_list(1000)
    recurring_expense = recurring_exp_docs

    # Mark generated and validated status
    generated_descriptions = {tx["description"] for tx in txs}
    for r in recurring_revenue + recurring_expense:
        r["generated_this_month"] = r.get("description", "") in generated_descriptions or r.get("membership", "") in generated_descriptions

    validations = await db.recurring_validations.find(
        {"month": month}, {"_id": 0}
    ).to_list(1000)
    validated_ids = {v["recurring_id"] for v in validations}
    for r in recurring_revenue + recurring_expense:
        r["validated_this_month"] = r.get("id", "") in validated_ids

    return {
        "kpi": kpi,
        "revenue_breakdown": revenue_breakdown,
        "expense_breakdown": expense_breakdown,
        "total_revenue_from_transactions": sum(e["total"] for e in revenue_breakdown),
        "total_expenses_from_transactions": sum(e["total"] for e in expense_breakdown),
        "recurring_revenue": recurring_revenue,
        "recurring_expense": recurring_expense,
        "recurring_validations": validations,
        "transactions_count": len(txs),
    }


@router.post("/{month}/recalculate")
async def recalculate_month(month: str):
    cats = await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)
    cat_map = {c["name"]: c for c in cats}

    txs = await db.accounting_transactions.find(
        {"date": {"$regex": f"^{month}"}}, {"_id": 0}
    ).to_list(10000)

    existing = await db.monthly_kpis.find_one({"month": month}, {"_id": 0}) or {}

    # Calculate totals per kpi_column from transactions
    totals_by_col = {}
    for tx in txs:
        cat_info = cat_map.get(tx.get("category"))
        if cat_info and cat_info.get("kpi_column"):
            col = cat_info["kpi_column"]
            totals_by_col[col] = totals_by_col.get(col, 0) + tx["amount"]

    merged = dict(existing)
    for col, val in totals_by_col.items():
        merged[col] = val

    # Dynamically sum revenue and expense columns based on category types
    revenue_cols = set()
    expense_cols = set()
    for c in cats:
        kpi_col = c.get("kpi_column")
        if kpi_col:
            if c["type"] == "revenue":
                revenue_cols.add(kpi_col)
            elif c["type"] == "expense":
                expense_cols.add(kpi_col)

    total_revenue_from_tx = sum(merged.get(col, 0) for col in revenue_cols)
    total_expenses_from_tx = sum(merged.get(col, 0) for col in expense_cols)

    # Revenue: use transactions if available, else fallback to fast_cash_revenue
    fast_cash = merged.get("fast_cash_revenue", 0)
    total_revenue = total_revenue_from_tx if total_revenue_from_tx > 0 else fast_cash


    # Zero out kpi_columns that have no transactions anymore
    zero_updates = {}
    for c in cats:
        kpi_col = c.get("kpi_column")
        if kpi_col and kpi_col not in totals_by_col:
            zero_updates[kpi_col] = 0

    # Build aliases for French/English expense fields
    ALIASES = {
        "rent": "loyer", "salaries": "salaires",
        "salaires_coach": "salaires_coachs",
        "ad_spend": "marketing_spend",
    }

    update = {
        **zero_updates,
        **{col: totals_by_col[col] for col in totals_by_col},
        "total_revenue": total_revenue,
        "total_expenses": total_expenses_from_tx,
        "net_profit": total_revenue - total_expenses_from_tx,
        "profit": total_revenue - total_expenses_from_tx,
        "revenue_members": totals_by_col.get("general_eft_revenue", 0),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # --- Funnel: Use GHL sync data if available, do NOT override ---
    # Check if GHL has already set funnel data for this month
    existing_leads = merged.get("leads", 0)
    existing_close = merged.get("close", 0)

    # Only fill funnel from new sign-ups if GHL hasn't provided data at all
    if existing_leads == 0 and existing_close == 0:
        new_members_this_month = await db.customer_members.find(
            {"contract_signed_date": {"$regex": f"^{month}"}},
            {"_id": 0, "name": 1, "billing_amount": 1}
        ).to_list(1000)

        if new_members_this_month:
            new_member_names = [m.get("name") for m in new_members_this_month if m.get("name")]
            first_tx_total = 0
            for name in new_member_names:
                first_tx = await db.accounting_transactions.find_one(
                    {"client_name": name, "date": {"$regex": f"^{month}"}, "amount": {"$gt": 0}},
                    {"_id": 0, "amount": 1}
                )
                if first_tx:
                    first_tx_total += first_tx.get("amount", 0)
            update["new_members"] = len(new_members_this_month)
        else:
            update["cash_collected"] = 0
    # If GHL data exists, don't touch funnel fields (leads, close, cash_collected, etc.)

    # --- Recurring: Calculate from active billing members ---
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    active_recurring = await db.customer_members.find(
        {"billing_enabled": True, "billing_amount": {"$gt": 0},
         "$or": [
             {"exit_date": None}, {"exit_date": ""},
             {"exit_date": {"$exists": False}}, {"exit_date": {"$gte": today_str}}
         ]},
        {"_id": 0, "billing_amount": 1}
    ).to_list(5000)

    recurring_count = len(active_recurring)
    recurring_rev = sum(m.get("billing_amount", 0) for m in active_recurring)

    # Recurring expenses from expense categories marked as recurring
    recurring_expense_txs = await db.accounting_transactions.find(
        {"date": {"$regex": f"^{month}"}, "amount": {"$lt": 0},
         "$or": [{"is_recurring": True}, {"description": {"$regex": "MENSUEL|LOYER|ABONNEMENT|SALAIRE", "$options": "i"}}]},
        {"_id": 0, "amount": 1}
    ).to_list(5000)
    recurring_exp = abs(sum(tx.get("amount", 0) for tx in recurring_expense_txs))

    update["active_recurrences"] = recurring_count
    update["recurring_revenue"] = recurring_rev
    update["recurring_expenses"] = recurring_exp
    update["recurring_net_impact"] = recurring_rev - recurring_exp

    # Set aliases
    for eng, fr in ALIASES.items():
        if eng in totals_by_col:
            update[fr] = totals_by_col[eng]

    await db.monthly_kpis.update_one({"month": month}, {"$set": update}, upsert=True)
    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    return compute_metrics(doc) if doc else {"error": "Mois introuvable"}


@router.post("/recalculate-all")
async def recalculate_all():
    months = await db.monthly_kpis.find({}, {"_id": 0, "month": 1}).to_list(1000)
    results = []
    for m in months:
        try:
            await recalculate_month(m["month"])
            results.append({"month": m["month"], "status": "ok"})
        except Exception as e:
            results.append({"month": m["month"], "status": "skipped", "reason": str(e)})
    return {"recalculated": len([r for r in results if r["status"] == "ok"]), "details": results}
