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


@router.post("/{month}/recalculate")
async def recalculate_month(month: str):
    cats = await db.accounting_categories.find({}, {"_id": 0}).to_list(1000)
    cat_map = {c["name"]: c for c in cats}

    txs = await db.accounting_transactions.find(
        {"date": {"$regex": f"^{month}"}}, {"_id": 0}
    ).to_list(1000)

    existing = await db.monthly_kpis.find_one({"month": month}, {"_id": 0}) or {}

    # Calculate totals per kpi_column from transactions
    totals_by_col = {}
    for tx in txs:
        cat_info = cat_map.get(tx["category"])
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
    total_revenue = max(total_revenue_from_tx, fast_cash) if total_revenue_from_tx == 0 else total_revenue_from_tx

    update = {
        **{col: totals_by_col[col] for col in totals_by_col},
        "total_revenue": total_revenue,
        "total_expenses": total_expenses_from_tx,
        "net_profit": total_revenue - total_expenses_from_tx,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.monthly_kpis.update_one({"month": month}, {"$set": update})
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
