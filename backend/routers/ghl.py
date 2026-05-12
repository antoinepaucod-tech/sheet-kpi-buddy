"""GoHighLevel sync routes"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging

from core.config import db, exclude_archived
from core.security import get_club_id, get_current_user
from core.club_id_guard import resolve_club_id_or_fallback
from services.ghl import sync_pipeline_data

router = APIRouter(prefix="/ghl", tags=["ghl"])
logger = logging.getLogger(__name__)


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


@router.post("/sync")
async def sync_ghl(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Trigger a manual sync from GoHighLevel pipelines with optional date filter"""
    try:
        data = await sync_pipeline_data(start_date=start_date, end_date=end_date)
    except Exception as e:
        error_msg = str(e)
        logger.error(f"GHL sync failed: {error_msg}")
        await db.ghl_syncs.insert_one({
            "status": "error",
            "error": error_msg,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        })
        raise HTTPException(status_code=502, detail=f"GHL API error: {error_msg}")

    if not data.get("pipelines"):
        raise HTTPException(status_code=404, detail="No pipelines found in GHL")

    # Aggregate funnel from all pipelines
    total_funnel = {
        "new_leads": 0,
        "confirmed_appointment": 0,
        "cancelled": 0,
        "no_showed": 0,
        "showed_sold": 0,
        "showed_lost": 0,
    }
    all_funnel_opps = {k: [] for k in total_funnel}
    total_pipeline_opps = 0

    for p in data["pipelines"]:
        f = p.get("funnel", {})
        for key in total_funnel:
            total_funnel[key] += f.get(key, 0)
        fo = p.get("funnel_opportunities", {})
        for key in all_funnel_opps:
            all_funnel_opps[key].extend(fo.get(key, []))
        total_pipeline_opps += p.get("total_opportunities", 0)

    # "New Leads" = total pipeline opportunities (all leads that entered)
    total_funnel["new_leads"] = total_pipeline_opps

    # Sum monetary values from showed_sold for cash_collected
    cash_from_ghl = sum(
        opp.get("monetary_value", 0) or 0
        for opp in all_funnel_opps.get("showed_sold", [])
    )

    # Store sync result
    sync_record = {
        "status": "success",
        "funnel": total_funnel,
        "total_opportunities": total_pipeline_opps,
        "cash_from_ghl": cash_from_ghl,
        "funnel_opportunities": all_funnel_opps,
        "start_date": start_date,
        "end_date": end_date,
        "pipelines": [{
            "id": p["pipeline_id"],
            "name": p["pipeline_name"],
            "stages": p["stages"],
            "total_opportunities": p["total_opportunities"],
        } for p in data["pipelines"]],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ghl_syncs.insert_one(sync_record)
    sync_record.pop("_id", None)

    # Determine the correct KPI month from date range (not from dashboard selection)
    if end_date:
        kpi_month = end_date[:7]
    elif start_date:
        kpi_month = start_date[:7]
    else:
        kpi_month = datetime.now(timezone.utc).strftime("%Y-%m")

    leads = total_pipeline_opps
    scheduled = total_funnel["confirmed_appointment"] + total_funnel["cancelled"]
    show = total_funnel["showed_sold"] + total_funnel["showed_lost"] + total_funnel["no_showed"]
    close = total_funnel["showed_sold"]

    # Count real active members from DB
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_active = await db.customer_members.count_documents({"subscription_end_date": {"$gte": today_str}})
    pif_count = await db.customer_members.count_documents({
        "subscription_end_date": {"$gte": today_str},
        "member_type": "Membres PIF"
    })
    recurring_count = await db.customer_members.count_documents({
        "subscription_end_date": {"$gte": today_str},
        "member_type": "Membres Généraux Récurrents"
    })

    kpi_update = {
        "leads": leads,
        "scheduled": scheduled,
        "show": show,
        "close": close,
        "cash_collected": cash_from_ghl,
        "avg_per_sale": round(cash_from_ghl / close, 2) if close > 0 else 0,
        "sched_percentage": round((scheduled / leads * 100) if leads > 0 else 0, 1),
        "show_percentage": round((show / scheduled * 100) if scheduled > 0 else 0, 1),
        "close_percentage": round((close / show * 100) if show > 0 else 0, 1),
        "active_members": total_active,
        "pif_members": pif_count,
        "recurring_general_members": recurring_count,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    existing = await db.monthly_kpis.find_one({"month": kpi_month})
    if existing:
        await db.monthly_kpis.update_one({"month": kpi_month}, {"$set": kpi_update})
    else:
        from models.kpi import MonthlyKPI
        kpi = MonthlyKPI(month=kpi_month, **kpi_update)
        await db.monthly_kpis.insert_one(kpi.model_dump())

    sync_record["kpi_month"] = kpi_month
    return sync_record


@router.get("/last-sync")
async def get_last_sync(current_user: dict = Depends(get_current_user)):
    """Get the most recent sync result"""
    doc = await db.ghl_syncs.find_one(
        {"status": "success"},
        {"_id": 0},
        sort=[("synced_at", -1)],
    )
    if not doc:
        return {"status": "no_sync", "message": "Aucune synchronisation effectuee"}
    return doc


@router.get("/sync-history")
async def get_sync_history(
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Get sync history (last 20)"""
    docs = await db.ghl_syncs.find(
        _cq(club_id), {"_id": 0}
    ).sort("synced_at", -1).to_list(20)
    return docs


@router.post("/confirm-sale")
async def confirm_sale(
    body: dict,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """
    Confirm a sale from 'Showed Sold' stage.
    - Creates a member record with full subscription details
    - If 6 Week Challenge: auto-adds to active challenge
    - Updates KPI revenue (fast_cash + total_revenue)
    """
    from models.members import CustomerMember
    from models.challenges import ChallengeParticipant

    opportunity_id = body.get("opportunity_id")
    opportunity_name = body.get("opportunity_name", "")
    contact_email = body.get("contact_email", "")
    contact_phone = body.get("contact_phone", "")
    subscription_type = body.get("subscription_type", "6 Week Challenge")
    member_type = body.get("member_type", "")
    cash_collected = body.get("cash_collected", 599)
    month = body.get("month")
    subscription_end_date = body.get("subscription_end_date", "")
    signature_date = body.get("signature_date", "")
    # Billing fields
    billing_enabled = body.get("billing_enabled", False)
    billing_amount = body.get("billing_amount", 0)
    billing_cycle_type = body.get("billing_cycle_type", "monthly_day")
    billing_cycle_value = body.get("billing_cycle_value", 1)
    billing_payment_method = body.get("billing_payment_method", "prelevement")

    if not opportunity_id:
        raise HTTPException(status_code=400, detail="opportunity_id required")
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")

    # Sprint Hardening club_id (2026-05-12) — mode soft fallback + audit trail
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/ghl/confirm-sale",
    )
    audit_fields = {
        "created_by_user_id": current_user.get("id"),
        "created_by_email": current_user.get("email"),
    }

    # Use GHL closed_at as signature date, fallback to today
    if not signature_date:
        signature_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Check if already confirmed
    existing_sale = await db.ghl_sales.find_one({"opportunity_id": opportunity_id})
    if existing_sale:
        existing_sale.pop("_id", None)
        return existing_sale

    # Determine member_type if not provided
    is_challenge = "challeng" in subscription_type.lower() or "6 week" in subscription_type.lower()
    if not member_type:
        if is_challenge or "annuel" in subscription_type.lower() or "6 mois" in subscription_type.lower():
            member_type = "Membres PIF"
        else:
            member_type = "Membres Généraux Récurrents"

    # Parse signature date as base date for calculations
    base_date = datetime.strptime(signature_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    
    # Calculate end date if not provided
    if not subscription_end_date:
        if is_challenge:
            subscription_end_date = (base_date + timedelta(days=42)).strftime("%Y-%m-%d")
        elif "annuel" in subscription_type.lower():
            subscription_end_date = (base_date + timedelta(days=365)).strftime("%Y-%m-%d")
        elif "6 mois" in subscription_type.lower():
            subscription_end_date = (base_date + timedelta(days=182)).strftime("%Y-%m-%d")
        elif "3 mois" in subscription_type.lower():
            subscription_end_date = (base_date + timedelta(days=91)).strftime("%Y-%m-%d")
        else:
            subscription_end_date = (base_date + timedelta(days=30)).strftime("%Y-%m-%d")

    # 1. Check if member already exists (by name to avoid duplicates)
    existing_member = await db.customer_members.find_one({"name": opportunity_name})

    if existing_member:
        # Update existing member with GHL data
        member_id = existing_member["id"]
        update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if contact_email and not existing_member.get("email"):
            update_fields["email"] = contact_email
        if contact_phone and not existing_member.get("phone"):
            update_fields["phone"] = contact_phone
        await db.customer_members.update_one({"id": member_id}, {"$set": update_fields})
    else:
        member = CustomerMember(
            name=opportunity_name,
            email=contact_email,
            phone=contact_phone,
            membership=subscription_type,
            member_type=member_type,
            contract_signed_date=signature_date,
            subscription_end_date=subscription_end_date,
            cash_collected=cash_collected,
            billing_enabled=billing_enabled,
            billing_amount=billing_amount,
            billing_cycle_type=billing_cycle_type,
            billing_cycle_value=billing_cycle_value,
            billing_payment_method=billing_payment_method,
            onboarding_completed=False,
        )
        member_doc = member.model_dump()
        # Sprint Hardening : défense en profondeur club_id + audit trail
        member_doc["club_id"] = club_id_resolved
        member_doc.update(audit_fields)
        await db.customer_members.insert_one(member_doc)
        member_id = member_doc["id"]
        member_doc.pop("_id", None)

        # Create payment schedule if billing is enabled
        if billing_enabled and billing_amount > 0:
            from models.payments import PaymentSchedule
            schedule = PaymentSchedule(
                member_id=member_id,
                amount=billing_amount,
                recurrence_type=billing_cycle_type,
                recurrence_value=billing_cycle_value,
                start_date=signature_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                payment_method=billing_payment_method,
                is_active=True
            )
            schedule_doc = schedule.model_dump()
            schedule_doc["club_id"] = club_id_resolved
            schedule_doc.update(audit_fields)
            await db.payment_schedules.insert_one(schedule_doc)

        # Create bilan/suivi (annual review) for the new member
        from models.members import AnnualReview
        if is_challenge:
            review_type = "challenge"
            review_date_calc = base_date + timedelta(days=42)
        else:
            review_type = "quarterly"
            review_date_calc = base_date + timedelta(days=90)
        annual_review = AnnualReview(
            member_id=member_id,
            review_date=review_date_calc.strftime("%Y-%m-%d"),
            review_type=review_type,
            status="scheduled"
        )
        review_doc = annual_review.model_dump()
        review_doc.update(audit_fields)
        await db.annual_reviews.insert_one(review_doc)

    # 2. Auto-add to active 6 Week Challenge if applicable
    challenge_added = False
    if is_challenge:
        active_challenge = await db.six_weeks_challenges.find_one({"is_active": True}, {"_id": 0})
        if active_challenge:
            existing_p = await db.challenge_participants.find_one({
                "challenge_id": active_challenge["id"], "member_id": member_id
            })
            if not existing_p:
                participant = ChallengeParticipant(
                    challenge_id=active_challenge["id"],
                    member_id=member_id,
                    member_name=opportunity_name
                )
                participant_doc = participant.model_dump()
                participant_doc.update(audit_fields)
                await db.challenge_participants.insert_one(participant_doc)
                challenge_added = True

    # 3. Store sale confirmation
    sale = {
        "opportunity_id": opportunity_id,
        "opportunity_name": opportunity_name,
        "subscription_type": subscription_type,
        "cash_collected": cash_collected,
        "member_id": member_id,
        "challenge_added": challenge_added,
        "month": month,
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
        **audit_fields,
    }
    await db.ghl_sales.insert_one(sale)
    sale.pop("_id", None)

    # 3b. Create accounting transaction for this sale
    # Find the revenue category for subscriptions
    rev_cat = await db.accounting_categories.find_one({"type": "revenue", "kpi_column": "revenue_members"})
    cat_name = rev_cat["name"] if rev_cat else "ABONNEMENTS"

    tx_doc = {
        "id": f"ghl-sale-{opportunity_id}",
        "date": signature_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "description": f"Vente {subscription_type} - {opportunity_name}",
        "amount": cash_collected,
        "type": "revenue",
        "category": cat_name,
        "club_id": club_id_resolved,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **audit_fields,
    }
    # Avoid duplicates
    existing_tx = await db.accounting_transactions.find_one({"id": tx_doc["id"]})
    if not existing_tx:
        await db.accounting_transactions.insert_one(tx_doc)
        tx_doc.pop("_id", None)

    # 4. Auto-recalculate KPIs from transactions (replaces manual KPI update)
    tx_date = signature_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    from routers.transactions import _auto_recalculate_kpis
    await _auto_recalculate_kpis(tx_date)

    # Update new_members count separately (not derived from transactions)
    existing_kpi = await db.monthly_kpis.find_one({"month": month})
    if existing_kpi:
        new_members_count = existing_kpi.get("new_members", 0) + 1
        await db.monthly_kpis.update_one(
            {"month": month},
            {"$set": {
                "new_members": new_members_count,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

    return sale


@router.get("/sales/{month}")
async def get_sales(month: str, current_user: dict = Depends(get_current_user)):
    """Get confirmed sales for a given month"""
    docs = await db.ghl_sales.find(
        {"month": month}, {"_id": 0}
    ).sort("confirmed_at", -1).to_list(1000)
    return docs


@router.patch("/calls-made")
async def update_calls_made(
    body: dict,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Update the calls_made field for a given month"""
    month = body.get("month")
    calls_made = body.get("calls_made", 0)

    if not month:
        raise HTTPException(status_code=400, detail="month required")

    existing = await db.monthly_kpis.find_one({"month": month})
    if not existing:
        from models.kpi import MonthlyKPI
        kpi = MonthlyKPI(month=month, calls_made=calls_made)
        await db.monthly_kpis.insert_one(kpi.model_dump())
    else:
        leads = existing.get("leads", 0)
        call_pct = round((calls_made / leads * 100) if leads > 0 else 0, 1)
        await db.monthly_kpis.update_one(
            {"month": month},
            {"$set": {
                "calls_made": calls_made,
                "call_percentage": call_pct,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

    doc = await db.monthly_kpis.find_one({"month": month}, {"_id": 0})
    return doc
