"""KPI routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from core.config import db
from core.security import get_club_id
from models.kpi import MonthlyKPI, MonthlyKPICreate, compute_metrics

router = APIRouter(prefix="/monthly-kpis", tags=["kpis"])


def _cq(club_id, base=None):
    """Build a club-filtered query"""
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


@router.get("")
async def get_monthly_kpis(club_id: Optional[str] = Depends(get_club_id)):
    docs = await db.monthly_kpis.find(_cq(club_id), {"_id": 0}).sort("month", 1).to_list(1000)

    # Enrich with real churn from member exit_dates
    members = await db.customer_members.find(
        _cq(club_id), {"_id": 0, "exit_date": 1, "subscription_end_date": 1, "is_duplicate": 1}
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
async def get_monthly_kpi(month: str, club_id: Optional[str] = Depends(get_club_id)):
    doc = await db.monthly_kpis.find_one(_cq(club_id, {"month": month}), {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    return compute_metrics(doc)


@router.post("")
async def upsert_monthly_kpi(data: MonthlyKPICreate, club_id: Optional[str] = Depends(get_club_id)):
    existing = await db.monthly_kpis.find_one(_cq(club_id, {"month": data.month}))
    payload = data.model_dump()
    if club_id:
        payload["club_id"] = club_id
    if existing:
        payload['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.monthly_kpis.update_one(_cq(club_id, {"month": data.month}), {"$set": payload})
        doc = await db.monthly_kpis.find_one(_cq(club_id, {"month": data.month}), {"_id": 0})
    else:
        kpi = MonthlyKPI(**payload)
        doc = kpi.model_dump()
        await db.monthly_kpis.insert_one(doc)
        doc.pop('_id', None)
    return compute_metrics(doc)


@router.post("/bulk")
async def bulk_import_kpis(data: List[dict], club_id: Optional[str] = Depends(get_club_id)):
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
        if club_id:
            mapped["club_id"] = club_id
        existing = await db.monthly_kpis.find_one(_cq(club_id, {"month": month}))
        if existing:
            mapped['updated_at'] = datetime.now(timezone.utc).isoformat()
            await db.monthly_kpis.update_one(_cq(club_id, {"month": month}), {"$set": mapped})
            updated += 1
        else:
            kpi = MonthlyKPI(**{k: v for k, v in mapped.items() if v is not None})
            await db.monthly_kpis.insert_one(kpi.model_dump())
            imported += 1
    return {"imported": imported, "updated": updated, "total": imported + updated}


@router.patch("/{month}/note")
async def update_note(month: str, body: dict, club_id: Optional[str] = Depends(get_club_id)):
    note = body.get("note", "")
    await db.monthly_kpis.update_one(
        _cq(club_id, {"month": month}),
        {"$set": {"note": note, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    doc = await db.monthly_kpis.find_one(_cq(club_id, {"month": month}), {"_id": 0})
    return compute_metrics(doc) if doc else {"error": "Mois introuvable"}


@router.get("/{month}/details")
async def get_monthly_kpi_details(month: str, club_id: Optional[str] = Depends(get_club_id)):
    """Return KPI data enriched with transaction breakdown and recurring info."""
    doc = await db.monthly_kpis.find_one(_cq(club_id, {"month": month}), {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Mois introuvable")
    kpi = compute_metrics(doc)

    # Get categories
    cats = await db.accounting_categories.find(_cq(club_id), {"_id": 0}).to_list(1000)
    cat_map = {c["name"]: c for c in cats}

    # Get actual transactions for this month
    txs = await db.accounting_transactions.find(
        _cq(club_id, {"date": {"$regex": f"^{month}"}}), {"_id": 0}
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

    # Get ALL active recurring billing from members (including coaches)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bm_q = {"billing_enabled": True, "billing_amount": {"$gt": 0},
         "$or": [
             {"exit_date": None}, {"exit_date": ""},
             {"exit_date": {"$exists": False}}, {"exit_date": {"$gte": today_str}}
         ]}
    if club_id:
        bm_q["club_id"] = club_id
    billing_members = await db.customer_members.find(
        bm_q,
        {"_id": 0, "id": 1, "name": 1, "billing_amount": 1, "membership": 1,
         "billing_cycle_type": 1, "billing_cycle_value": 1, "billing_payment_method": 1,
         "is_coach": 1}
    ).to_list(5000)

    recurring_revenue = [{
        "id": m["id"],
        "member_id": m["id"],
        "member_name": m.get("name", ""),
        "membership": m.get("membership", ""),
        "amount": m.get("billing_amount", 0),
        "billing_cycle_type": m.get("billing_cycle_type", "monthly_day"),
        "billing_cycle_value": m.get("billing_cycle_value", 1),
        "billing_payment_method": m.get("billing_payment_method", "prelevement"),
        "type": "revenue",
        "description": m.get("membership", ""),
        "is_active": True,
        "source": "billing",
    } for m in billing_members if m.get("billing_amount", 0) > 0]

    # Also get recurring revenue templates from recurring_transactions
    recurring_rev_docs = await db.recurring_transactions.find(
        _cq(club_id, {"is_active": True, "type": "revenue"}), {"_id": 0}
    ).to_list(1000)
    for doc in recurring_rev_docs:
        doc["source"] = "template"
    recurring_revenue.extend(recurring_rev_docs)

    # Get recurring expense templates from recurring_transactions
    recurring_exp_docs = await db.recurring_transactions.find(
        _cq(club_id, {"is_active": True, "type": "expense"}), {"_id": 0}
    ).to_list(1000)
    for doc in recurring_exp_docs:
        doc["source"] = "template"

    # Also add recurring expense categories that have is_recurring=True
    recurring_cats = await db.accounting_categories.find(
        _cq(club_id, {"is_recurring": True, "type": "expense"}), {"_id": 0}
    ).to_list(100)
    existing_expense_descs = {d.get("description", "") for d in recurring_exp_docs}
    for cat in recurring_cats:
        if cat["name"] not in existing_expense_descs:
            recurring_exp_docs.append({
                "id": cat["id"],
                "description": cat["name"],
                "category": cat["name"],
                "amount": cat.get("default_amount", 0),
                "recurrence_day": cat.get("recurrence_day", 1),
                "type": "expense",
                "is_active": True,
                "source": "category",
            })

    recurring_expense = recurring_exp_docs

    # Mark generated and validated status
    generated_descriptions = {tx["description"] for tx in txs}
    for r in recurring_revenue + recurring_expense:
        r["generated_this_month"] = r.get("description", "") in generated_descriptions or r.get("membership", "") in generated_descriptions

    validations = await db.recurring_validations.find(
        _cq(club_id, {"month": month}), {"_id": 0}
    ).to_list(1000)
    validated_ids = {v["recurring_id"] for v in validations}
    for r in recurring_revenue + recurring_expense:
        r["validated_this_month"] = r.get("id", "") in validated_ids

    # Funnel data from GHL
    ghl_sales = await db.ghl_sales.find(
        _cq(club_id, {"month": month}), {"_id": 0}
    ).to_list(100)
    funnel = {
        "leads": kpi.get("funnel_leads") or kpi.get("leads", 0) or 0,
        "appointments": kpi.get("funnel_appointments") or kpi.get("appointments", 0) or 0,
        "show": kpi.get("funnel_show") or kpi.get("show", 0) or 0,
        "converted": kpi.get("funnel_converted") or kpi.get("close", 0) or 0,
        "cash": kpi.get("funnel_cash") or 0,
    }
    if ghl_sales:
        funnel["details"] = ghl_sales

    # New members this month (exclude coaches, HUBFIT, and renewals)
    new_members_raw = await db.customer_members.find(
        _cq(club_id, {"contract_signed_date": {"$regex": f"^{month}"}}),
        {"_id": 0, "id": 1, "name": 1, "membership": 1, "contract_signed_date": 1, "cash_collected": 1}
    ).to_list(1000)
    exclude_kw = ["THE COACH", "VIRTUAL COACH", "HUBFIT"]
    new_members_filtered = [m for m in new_members_raw
                            if not any(kw in (m.get("membership") or "").upper() for kw in exclude_kw)]
    # Exclude renewals: keep only members who had NO prior contract
    month_start = f"{month}-01"
    new_members = []
    for m in new_members_filtered:
        prior = await db.customer_members.find_one(
            {"name": m["name"], "contract_signed_date": {"$lt": month_start, "$exists": True, "$ne": ""}},
            {"_id": 1}
        )
        if not prior:
            new_members.append(m)

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
        "funnel": funnel,
        "new_members": new_members,
    }


@router.post("/{month}/recalculate")
async def recalculate_month(month: str, club_id: Optional[str] = Depends(get_club_id)):
    cats = await db.accounting_categories.find(_cq(club_id), {"_id": 0}).to_list(1000)
    cat_map = {c["name"]: c for c in cats}

    txs = await db.accounting_transactions.find(
        _cq(club_id, {"date": {"$regex": f"^{month}"}}), {"_id": 0}
    ).to_list(10000)

    existing = await db.monthly_kpis.find_one(_cq(club_id, {"month": month}), {"_id": 0}) or {}

    # Calculate totals per kpi_column from transactions
    # Use the TRANSACTION's own type field, not the category type
    totals_by_col = {}
    total_revenue_direct = 0
    total_expenses_direct = 0
    for tx in txs:
        tx_type = tx.get("type", "")
        cat_info = cat_map.get(tx.get("category"))
        if cat_info and cat_info.get("kpi_column"):
            col = cat_info["kpi_column"]
            totals_by_col[col] = totals_by_col.get(col, 0) + tx["amount"]
        # Sum revenue/expenses using the transaction's own type
        if tx_type == "revenue":
            total_revenue_direct += tx.get("amount", 0)
        elif tx_type == "expense":
            total_expenses_direct += tx.get("amount", 0)

    merged = dict(existing)
    for col, val in totals_by_col.items():
        merged[col] = val

    # Revenue: use direct transaction type sums (most accurate)
    total_revenue = total_revenue_direct if total_revenue_direct > 0 else merged.get("fast_cash_revenue", 0)
    total_expenses_from_tx = total_expenses_direct


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

    # --- Funnel: Populate from GHL data ---
    ghl_sales = await db.ghl_sales.find(_cq(club_id, {"month": month}), {"_id": 0}).to_list(100)
    if ghl_sales:
        # Calculate funnel from GHL
        ghl_cash = sum(s.get("cash_collected", 0) or 0 for s in ghl_sales)
        update["funnel_converted"] = len(ghl_sales)
        update["funnel_cash"] = ghl_cash
    # Use existing values for leads/appointments/show if set
    update["funnel_leads"] = merged.get("funnel_leads") or merged.get("leads", 0) or 0
    update["funnel_appointments"] = merged.get("funnel_appointments") or merged.get("appointments", 0) or 0
    update["funnel_show"] = merged.get("funnel_show") or merged.get("show", 0) or 0
    if "funnel_converted" not in update:
        update["funnel_converted"] = merged.get("funnel_converted") or merged.get("close", 0) or 0
    if "funnel_cash" not in update:
        update["funnel_cash"] = merged.get("funnel_cash") or merged.get("cash_collected", 0) or 0

    # New members count (exclude coaches, HUBFIT, and renewals)
    new_members_raw = await db.customer_members.find(
        _cq(club_id, {"contract_signed_date": {"$regex": f"^{month}"}}),
        {"_id": 0, "name": 1, "membership": 1, "contract_signed_date": 1}
    ).to_list(1000)
    exclude_kw_new = ["THE COACH", "VIRTUAL COACH", "HUBFIT"]
    new_filtered = [m for m in new_members_raw
                    if not any(kw in (m.get("membership") or "").upper() for kw in exclude_kw_new)]
    # Exclude renewals
    new_month_start = f"{month}-01"
    new_count = 0
    for m in new_filtered:
        prior = await db.customer_members.find_one(
            {"name": m["name"], "contract_signed_date": {"$lt": new_month_start, "$exists": True, "$ne": ""}},
            {"_id": 1}
        )
        if not prior:
            new_count += 1
    update["new_members"] = new_count

    # --- Member counts: Calculate active members for this specific month ---
    year_int, month_int = int(month[:4]), int(month[5:7])
    if month_int == 12:
        month_end_str = f"{year_int + 1}-01-01"
    else:
        month_end_str = f"{year_int}-{month_int + 1:02d}-01"
    month_start_str = f"{month}-01"

    all_members_for_count = await db.customer_members.find(
        _cq(club_id, {"contract_signed_date": {"$lt": month_end_str}}),
        {"_id": 0, "name": 1, "membership": 1, "exit_date": 1,
         "subscription_end_date": 1, "is_duo": 1, "is_coach": 1,
         "billing_amount": 1, "billing_cycle_type": 1, "billing_cycle_value": 1,
         "billing_enabled": 1}
    ).to_list(10000)

    # Filter: not departed before start of month, and subscription not ended before start of month
    current_members = []
    for m in all_members_for_count:
        exit_d = m.get("exit_date")
        if exit_d and exit_d not in (None, "", "None") and exit_d < month_start_str:
            continue
        sub_end = m.get("subscription_end_date")
        if sub_end and sub_end not in (None, "", "None") and sub_end < month_start_str:
            continue
        current_members.append(m)

    # Deduplicate: group by name, handle coach/non-coach overlap
    coach_kw_count = ["THE COACH", "VIRTUAL COACH"]
    name_groups = {}
    for m in current_members:
        name = m.get("name", "")
        if name not in name_groups:
            name_groups[name] = []
        name_groups[name].append(m)

    active_members_count = 0
    coach_members_count = 0
    for name, group in name_groups.items():
        has_coach = any(any(kw in (g.get("membership") or "").upper() for kw in coach_kw_count) for g in group)
        has_noncoach = any(not any(kw in (g.get("membership") or "").upper() for kw in coach_kw_count) for g in group)
        if has_coach and has_noncoach:
            # Person with both: count as coach only
            coach_members_count += 1
        elif has_coach:
            coach_members_count += 1
        else:
            # Count unique non-coach (deduplicate same name+membership)
            seen_ms = set()
            for g in group:
                ms = g.get("membership", "")
                key = ms
                if key not in seen_ms or g.get("is_duo"):
                    if key not in seen_ms:
                        active_members_count += 1
                    seen_ms.add(key)

    # Lost members: departed this month
    lost_this_month = sum(
        1 for m in all_members_for_count
        if m.get("exit_date") and m["exit_date"].startswith(month)
    )

    update["active_members"] = active_members_count
    update["coach_members"] = coach_members_count
    update["total_members"] = active_members_count + coach_members_count
    update["total_active_members"] = active_members_count + coach_members_count
    update["lost_members"] = lost_this_month

    # --- Recurring: Calculate from active billing members (exclude coaches) ---
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    coach_kw_rec = ["THE COACH", "VIRTUAL COACH"]
    rec_q = {"billing_enabled": True, "billing_amount": {"$gt": 0},
         "$or": [
             {"exit_date": None}, {"exit_date": ""},
             {"exit_date": {"$exists": False}}, {"exit_date": {"$gte": today_str}}
         ]}
    if club_id:
        rec_q["club_id"] = club_id
    active_recurring = await db.customer_members.find(
        rec_q,
        {"_id": 0, "billing_amount": 1, "is_coach": 1, "membership": 1}
    ).to_list(5000)

    # Exclude coaches
    active_recurring = [m for m in active_recurring if not m.get("is_coach") and
                        not any(kw in (m.get("membership") or "").upper() for kw in coach_kw_rec)]

    recurring_count = len(active_recurring)
    recurring_rev = sum(m.get("billing_amount", 0) for m in active_recurring)

    # Recurring expenses from expense categories marked as recurring
    rec_exp_q = {"date": {"$regex": f"^{month}"}, "amount": {"$lt": 0},
         "$or": [{"is_recurring": True}, {"description": {"$regex": "MENSUEL|LOYER|ABONNEMENT|SALAIRE", "$options": "i"}}]}
    if club_id:
        rec_exp_q["club_id"] = club_id
    recurring_expense_txs = await db.accounting_transactions.find(
        rec_exp_q,
        {"_id": 0, "amount": 1}
    ).to_list(5000)
    recurring_exp = abs(sum(tx.get("amount", 0) for tx in recurring_expense_txs))

    update["active_recurrences"] = recurring_count
    update["recurring_revenue"] = recurring_rev
    update["recurring_expenses"] = recurring_exp
    update["recurring_net_impact"] = recurring_rev - recurring_exp

    # --- Expected revenue & Collection Rate ---
    expected_revenue = 0.0
    for m in current_members:
        if m.get("is_coach"):
            continue
        ms = (m.get("membership") or "").upper()
        if any(kw in ms for kw in coach_kw_count):
            continue
        amt = m.get("billing_amount", 0) or 0
        if amt <= 0:
            continue
        cycle_type = m.get("billing_cycle_type", "monthly")
        cycle_val = m.get("billing_cycle_value", 30) or 30
        if cycle_type == "interval_days" and cycle_val > 0:
            monthly_amt = amt * (30.44 / cycle_val)
        else:
            monthly_amt = amt
        expected_revenue += monthly_amt

    update["expected_revenue"] = round(expected_revenue, 2)
    update["acrm_expected"] = round(expected_revenue / active_members_count, 2) if active_members_count > 0 else 0
    update["collection_rate"] = round((update.get("total_revenue", 0) / expected_revenue * 100), 1) if expected_revenue > 0 else 0

    # Set aliases
    for eng, fr in ALIASES.items():
        if eng in totals_by_col:
            update[fr] = totals_by_col[eng]

    await db.monthly_kpis.update_one(_cq(club_id, {"month": month}), {"$set": update}, upsert=True)
    doc = await db.monthly_kpis.find_one(_cq(club_id, {"month": month}), {"_id": 0})
    return compute_metrics(doc) if doc else {"error": "Mois introuvable"}


@router.post("/recalculate-all")
async def recalculate_all(club_id: Optional[str] = Depends(get_club_id)):
    months = await db.monthly_kpis.find(_cq(club_id), {"_id": 0, "month": 1}).to_list(1000)
    results = []
    for m in months:
        try:
            await recalculate_month(m["month"])
            results.append({"month": m["month"], "status": "ok"})
        except Exception as e:
            results.append({"month": m["month"], "status": "skipped", "reason": str(e)})
    return {"recalculated": len([r for r in results if r["status"] == "ok"]), "details": results}
