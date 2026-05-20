"""Payment routes"""
import re
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
from calendar import monthrange

from core.config import db, MONTHS_FR, exclude_archived, check_member_not_archived, get_member_archived_warning, get_archived_member_ids
from core.security import get_club_id, get_current_user
from core.club_id_guard import resolve_club_id_or_fallback
from models.payments import (
    PaymentSchedule, PaymentScheduleCreate,
    Payment, PaymentCreate, PaymentUpdate
)

router = APIRouter(tags=["payments"])


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


# Payment Schedule Routes
@router.get("/payment-schedules")
async def get_payment_schedules(member_id: Optional[str] = None, active_only: Optional[bool] = None, club_id: Optional[str] = Depends(get_club_id)):
    query = _cq(club_id)
    if member_id:
        query["member_id"] = member_id
    if active_only:
        query["is_active"] = True
    schedules = await db.payment_schedules.find(query, {"_id": 0}).to_list(1000)
    # Enrich with member names if missing
    for s in schedules:
        if not s.get("member_name"):
            member = await db.customer_members.find_one({"id": s.get("member_id")}, {"_id": 0, "name": 1})
            s["member_name"] = member.get("name", "Inconnu") if member else "Inconnu"
    return schedules


@router.post("/payment-schedules")
async def create_payment_schedule(
    data: PaymentScheduleCreate,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    schedule = PaymentSchedule(**data.model_dump())
    doc = schedule.model_dump()
    # Phase 3 Batch 3 — défense en profondeur club_id (Sprint Hardening pattern)
    doc["club_id"] = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/payment-schedules (POST)",
    )
    await db.payment_schedules.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/payment-schedules/{schedule_id}")
async def update_payment_schedule(schedule_id: str, body: dict):
    existing = await db.payment_schedules.find_one({"id": schedule_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Planning de paiement introuvable")
    
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.payment_schedules.update_one({"id": schedule_id}, {"$set": body})
    return await db.payment_schedules.find_one({"id": schedule_id}, {"_id": 0})


@router.delete("/payment-schedules/{schedule_id}")
async def delete_payment_schedule(schedule_id: str):
    result = await db.payment_schedules.delete_one({"id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Planning de paiement introuvable")
    return {"message": "Planning de paiement supprimé"}


@router.post("/payments/sync-with-members")
async def sync_payments_with_members(
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Full sync: regenerate payment_schedules and payments from billing_enabled members."""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    current_year = now.year
    current_month = now.month
    days_in_month = monthrange(current_year, current_month)[1]
    month_str = f"{current_year}-{current_month:02d}"

    # Phase 3 Batch 3 — défense en profondeur club_id (Sprint Hardening pattern).
    # Résolu UNE seule fois : 1 seul log MISSING_CLUB_ID si fallback (vs N inserts).
    resolved_club_id = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/payments/sync-with-members",
    )

    # 1. Get all billing_enabled active members (including coaches)
    all_members = await db.customer_members.find(
        exclude_archived(_cq(club_id, {"billing_enabled": True})),
        {"_id": 0}
    ).to_list(5000)

    active_billing = []
    for m in all_members:
        exit_d = m.get("exit_date")
        if exit_d and exit_d not in (None, "", "None") and exit_d < today_str:
            continue
        active_billing.append(m)

    # 2. Sync payment_schedules: clear and recreate (ALL billing members, including amount=0)
    # Phase 5 Batch 1.A — scope club_id strict (cf. audit 2026-05-20 L119 🔴).
    await db.payment_schedules.delete_many({"club_id": resolved_club_id})
    schedules_created = 0
    for m in active_billing:
        cycle_value = m.get("billing_cycle_value") or m.get("billing_day") or 1
        schedule = {
            "id": m["id"],
            "member_id": m["id"],
            "member_name": m.get("name", ""),
            "amount": m.get("billing_amount", 0) or 0,
            "frequency": "monthly",
            "billing_day": cycle_value,
            "payment_method": m.get("billing_payment_method", "prelevement"),
            "is_active": True,
            "start_date": m.get("contract_signed_date", today_str),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "club_id": resolved_club_id,  # Phase 3 Batch 3 — défense en profondeur
        }
        await db.payment_schedules.insert_one(schedule)
        schedules_created += 1

    # 3. Sync payments for current month (including 0 CHF for offerts)
    # First: delete only pending/late payments to recreate them
    # Phase 5 Batch 1.A — scope club_id strict (cf. audit 2026-05-20 L145 🔴).
    await db.payments.delete_many(
        {"club_id": resolved_club_id, "status": {"$in": ["pending", "late"]}}
    )
    payments_created = 0
    import uuid

    # Build set of member_ids that already have a paid/cancelled payment this month
    existing_paid = await db.payments.find(
        _cq(club_id, {"due_date": {"$regex": f"^{month_str}"}, "status": {"$in": ["paid", "cancelled"]}}),
        {"_id": 0, "member_id": 1}
    ).to_list(5000)
    already_paid_members = {p["member_id"] for p in existing_paid}

    for m in active_billing:
        # Skip if this member already has a paid/cancelled payment this month
        if m["id"] in already_paid_members:
            continue

        # Skip DUO secondary members:
        # If member has duo_partner_id AND their name does NOT contain "&" (combined), they are the secondary
        if m.get("duo_partner_id"):
            member_name = m.get("name", "")
            if "&" not in member_name:
                # This is the individual (secondary) DUO member, skip payment
                continue

        amt = m.get("billing_amount", 0) or 0

        # Skip members with 0 CHF billing (offerts, DUO secondaries without amount, unset amounts)
        if amt <= 0:
            continue

        cycle_type = m.get("billing_cycle_type", "monthly_day")
        cycle_value = m.get("billing_cycle_value") or m.get("billing_day") or 1

        # Calculate due date based on cycle type
        if cycle_type == "interval_days" and cycle_value and int(cycle_value) > 0:
            # Calculate from contract start date + N-day intervals
            start_str = m.get("contract_signed_date", "")
            if start_str:
                try:
                    start_dt = datetime.strptime(start_str[:10], "%Y-%m-%d")
                    interval = int(cycle_value)
                    # Find the due date that falls in the current month
                    month_start = datetime(current_year, current_month, 1)
                    month_end = datetime(current_year, current_month, days_in_month, 23, 59, 59)
                    # Calculate first occurrence after month_start
                    days_since = (month_start - start_dt).days
                    if days_since < 0:
                        due_dt = start_dt
                    else:
                        cycles_passed = days_since // interval
                        due_dt = start_dt + timedelta(days=cycles_passed * interval)
                        if due_dt < month_start:
                            due_dt += timedelta(days=interval)
                    if month_start <= due_dt <= month_end:
                        due_date = due_dt.strftime("%Y-%m-%d")
                    else:
                        continue  # No payment due this month
                except (ValueError, TypeError):
                    day = min(int(cycle_value), days_in_month)
                    due_date = f"{month_str}-{day:02d}"
            else:
                day = min(int(cycle_value), days_in_month)
                due_date = f"{month_str}-{day:02d}"
        else:
            day = min(int(cycle_value), days_in_month)
            due_date = f"{month_str}-{day:02d}"

        payment = {
            "id": str(uuid.uuid4()),
            "member_id": m["id"],
            "schedule_id": m["id"],
            "member_name": m.get("name", ""),
            "amount": amt,
            "due_date": due_date,
            "status": "late" if due_date < today_str else "pending",
            "payment_method": m.get("billing_payment_method", "prelevement"),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "club_id": resolved_club_id,  # Phase 3 Batch 3 — défense en profondeur
        }
        await db.payments.insert_one(payment)
        payments_created += 1

    return {
        "message": "Synchronisation terminée",
        "schedules_created": schedules_created,
        "payments_created": payments_created,
        "month": month_str,
    }


# Payment Routes
@router.get("/payments/unified")
async def get_payments_unified(
    month: str,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """F1 — Vue unifiée paiements + historique accounting_transactions (lecture seule).

    Stratégie de dédup cascade D:
      A) payment_id direct (lien fort posé par le code applicatif)
      B) fallback (member_name + date EXACT + amount) — strict, 0 ambiguïté

    Priorité en cas de conflit: `payments` (cycle court, source de vérité statut).
    Les accounting_transactions matchés sont écartés du retour 'historical'.

    Réponse: {payments:[...], historical:[...], total:int, breakdown:{payments:int, historical:int}}
    """
    # Validation format mois YYYY-MM
    if not month or len(month) != 7 or month[4] != "-":
        raise HTTPException(status_code=400, detail="Format 'month' invalide. Attendu: YYYY-MM")
    try:
        year_i, month_i = int(month[:4]), int(month[5:7])
        if not (1 <= month_i <= 12):
            raise ValueError("month out of range")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format 'month' invalide. Attendu: YYYY-MM")

    resolved_club_id = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="payments.unified",
    )

    # === 1) PAYMENTS du mois ===
    p_query = _cq(resolved_club_id)
    last_day = monthrange(year_i, month_i)[1]
    p_query["due_date"] = {"$gte": f"{month}-01", "$lte": f"{month}-{last_day:02d}"}
    p_docs = await db.payments.find(p_query, {"_id": 0}).sort("due_date", -1).to_list(2000)

    # Filtre Type B silencieux : retirer payments de membres archivés
    archived_ids = await get_archived_member_ids(resolved_club_id)
    p_docs = [d for d in p_docs if d.get("member_id") not in archived_ids]

    # Enrichir member_name (cohérent avec /payments)
    member_ids = list({d.get("member_id") for d in p_docs if d.get("member_id")})
    members_map = {}
    if member_ids:
        async for m in db.customer_members.find(
            {"id": {"$in": member_ids}},
            {"_id": 0, "id": 1, "name": 1}
        ):
            members_map[m["id"]] = m.get("name", "Inconnu")
    for d in p_docs:
        if not d.get("member_name"):
            d["member_name"] = members_map.get(d.get("member_id"), "Inconnu")
        d["source"] = "payments"

    # === 2) ACCOUNTING_TRANSACTIONS revenue du mois ===
    at_query = {"type": "revenue"}
    if resolved_club_id:
        at_query["club_id"] = resolved_club_id
    at_query["date"] = {"$gte": f"{month}-01", "$lte": f"{month}-{last_day:02d}"}
    at_docs = await db.accounting_transactions.find(at_query, {"_id": 0}).sort("date", -1).to_list(5000)

    # === 3) DÉDUP CASCADE D ===
    # Index pour stratégie A (payment_id)
    p_id_set = {p["id"] for p in p_docs}
    # Index pour stratégie B (member_name lower + date exact + amount)
    p_keys_b = {}
    for p in p_docs:
        key = (
            (p.get("member_name") or "").strip().lower(),
            p.get("due_date"),
            float(p.get("amount") or 0),
        )
        p_keys_b.setdefault(key, []).append(p)

    historical = []
    for tx in at_docs:
        # Stratégie A : lien explicite
        if tx.get("payment_id") and tx.get("payment_id") in p_id_set:
            continue  # dédupé, payments gagne
        # Stratégie B : fallback sémantique strict
        cn = (tx.get("client_name") or "").strip().lower()
        if cn:
            key = (cn, tx.get("date"), float(tx.get("amount") or 0))
            if key in p_keys_b:
                continue  # dédupé
        # Non-matché → historique
        historical.append({
            "id": tx.get("id"),
            "member_name": tx.get("client_name") or tx.get("member_name"),
            "due_date": tx.get("date"),
            "paid_date": tx.get("date"),
            "amount": tx.get("amount"),
            "status": "paid",  # accounting_tx revenue = encaissé par définition
            "payment_method": tx.get("payment_method"),
            "category": tx.get("category"),
            "club_id": tx.get("club_id"),
            "source": "historical",
            "notes": tx.get("notes") or tx.get("description"),
        })

    return {
        "payments": p_docs,
        "historical": historical,
        "total": len(p_docs) + len(historical),
        "breakdown": {
            "payments": len(p_docs),
            "historical": len(historical),
        },
    }


@router.get("/payments")
async def get_payments(
    month: Optional[str] = None,
    member_id: Optional[str] = None,
    status: Optional[str] = None,
    due_from: Optional[str] = None,
    due_to: Optional[str] = None,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    # Sprint Hardening — validation format month strict (YYYY-MM)
    if month is not None and not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", month):
        raise HTTPException(
            status_code=400,
            detail="Invalid month format. Expected YYYY-MM (e.g. 2026-05).",
        )

    query = _cq(club_id)
    if member_id:
        query["member_id"] = member_id
    if status:
        query["status"] = status
    if month:
        # Convert YYYY-MM to range query on due_date (cohérent avec storage YYYY-MM-DD)
        year_i, month_i = int(month[:4]), int(month[5:7])
        last_day = monthrange(year_i, month_i)[1]
        query["due_date"] = {"$gte": f"{month}-01", "$lte": f"{month}-{last_day:02d}"}
    elif due_from or due_to:
        query["due_date"] = {}
        if due_from:
            query["due_date"]["$gte"] = due_from
        if due_to:
            query["due_date"]["$lte"] = due_to
    
    docs = await db.payments.find(query, {"_id": 0}).sort("due_date", -1).to_list(1000)
    
    # Type B: silently filter out payments linked to archived members
    archived_ids = await get_archived_member_ids(club_id)
    docs = [d for d in docs if d.get("member_id") not in archived_ids]
    
    # Enrich with member names and filter out departed members' pending/late payments
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = []
    for doc in docs:
        member = await db.customer_members.find_one({"id": doc.get("member_id")}, {"_id": 0, "name": 1, "exit_date": 1, "membership": 1})
        doc["member_name"] = member.get("name", "Inconnu") if member else "Inconnu"
        
        # Auto-cancel departed members' pending/late payments
        if doc["status"] in ("pending", "late") and member:
            exit_d = member.get("exit_date")
            is_departed = exit_d and exit_d not in (None, "", "None") and exit_d < today
            # HUBFIT special: check other entries
            if not is_departed and "HUBFIT" in (member.get("membership", "") or "").upper():
                member_name = member.get("name", "")
                if member_name:
                    other_entries = await db.customer_members.find(
                        {"name": member_name, "id": {"$ne": doc["member_id"]}},
                        {"_id": 0, "exit_date": 1}
                    ).to_list(20)
                    if other_entries and all(
                        e.get("exit_date") and e["exit_date"] not in (None, "", "None") and e["exit_date"] < today
                        for e in other_entries
                    ):
                        is_departed = True
            if is_departed:
                await db.payments.update_one(
                    {"id": doc["id"]},
                    {"$set": {"status": "cancelled", "notes": "Membre parti", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                doc["status"] = "cancelled"
                doc["notes"] = "Membre parti"
        result.append(doc)
    
    return result


@router.get("/payments/late")
async def get_late_payments(club_id: Optional[str] = Depends(get_club_id)):
    """Get all late payments (past due and not paid), excluding departed members"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    q = {"due_date": {"$lt": today}, "status": {"$in": ["pending", "late"]}}
    if club_id:
        q["club_id"] = club_id
    docs = await db.payments.find(q, {"_id": 0}).sort("due_date", 1).to_list(500)
    
    # Type B: silently filter archived members
    archived_ids = await get_archived_member_ids(club_id)
    docs = [d for d in docs if d.get("member_id") not in archived_ids]
    
    # Filter out payments for departed members
    filtered_docs = []
    for doc in docs:
        member = await db.customer_members.find_one(
            {"id": doc["member_id"]},
            {"_id": 0, "name": 1, "email": 1, "phone": 1, "exit_date": 1, "membership": 1}
        )
        if not member:
            continue
        # Skip if member has departed (direct exit_date check)
        exit_d = member.get("exit_date")
        member_departed = exit_d and exit_d not in (None, "", "None") and exit_d < today

        # Extra check ONLY for HUBFIT entries: if all other entries for same name departed, treat as departed
        if not member_departed and "HUBFIT" in (member.get("membership", "") or "").upper():
            member_name = member.get("name", "")
            if member_name:
                all_entries = await db.customer_members.find(
                    {"name": member_name, "club_id": doc.get("club_id")},
                    {"_id": 0, "exit_date": 1, "id": 1}
                ).to_list(20)
                if len(all_entries) > 1:
                    other_entries = [e for e in all_entries if e.get("id") != doc["member_id"]]
                    if other_entries and all(
                        e.get("exit_date") and e["exit_date"] not in (None, "", "None") and e["exit_date"] < today
                        for e in other_entries
                    ):
                        member_departed = True

        if member_departed:
            await db.payments.update_one(
                {"id": doc["id"]},
                {"$set": {"status": "cancelled", "notes": "Membre parti", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            continue
        
        if doc["status"] == "pending":
            await db.payments.update_one(
                {"id": doc["id"]},
                {"$set": {"status": "late", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            doc["status"] = "late"
        
        doc["member_name"] = member.get("name", "Inconnu")
        doc["member_email"] = member.get("email", "")
        doc["member_phone"] = member.get("phone", "")
        filtered_docs.append(doc)
    
    return filtered_docs


@router.get("/payments/upcoming")
async def get_upcoming_payments(days: int = 7, club_id: Optional[str] = Depends(get_club_id)):
    """Get payments due in the next N days"""
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days)

    q = {"due_date": {"$gte": today.isoformat(), "$lte": end_date.isoformat()}, "status": "pending"}
    if club_id:
        q["club_id"] = club_id
    docs = await db.payments.find(q, {"_id": 0}).sort("due_date", 1).to_list(500)
    
    # Type B: silently filter archived members
    archived_ids = await get_archived_member_ids(club_id)
    docs = [d for d in docs if d.get("member_id") not in archived_ids]
    
    for doc in docs:
        member = await db.customer_members.find_one({"id": doc["member_id"]}, {"_id": 0, "name": 1, "email": 1})
        if member:
            doc["member_name"] = member.get("name", "")
            doc["member_email"] = member.get("email", "")
    
    return docs


@router.post("/payments")
async def create_payment(
    data: PaymentCreate,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    # Type C: block if target member is archived
    await check_member_not_archived(data.member_id)
    club_id_resolved = resolve_club_id_or_fallback(
        club_id=club_id, current_user=current_user, endpoint="/api/payments (POST)",
    )
    payment = Payment(**data.model_dump())
    doc = payment.model_dump()
    doc["club_id"] = club_id_resolved
    await db.payments.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.put("/payments/{payment_id}")
async def update_payment(payment_id: str, data: PaymentUpdate):
    existing = await db.payments.find_one({"id": payment_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.payments.update_one({"id": payment_id}, {"$set": update})
    return await db.payments.find_one({"id": payment_id}, {"_id": 0})


@router.post("/payments/{payment_id}/mark-paid")
async def mark_payment_paid(
    payment_id: str,
    body: dict = {},
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Quick action to mark a payment as paid and create a revenue transaction."""
    existing = await db.payments.find_one({"id": payment_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    
    paid_date = body.get("paid_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    
    update = {
        "status": "paid",
        "paid_date": paid_date,
        "payment_method": body.get("payment_method", existing.get("payment_method")),
        "reference": body.get("reference", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.update_one({"id": payment_id}, {"$set": update})
    
    # Create corresponding accounting transaction (revenue)
    member = await db.customer_members.find_one(
        {"id": existing["member_id"]},
        {"_id": 0, "name": 1, "membership": 1}
    )
    member_name = member.get("name", "Inconnu") if member else "Inconnu"
    membership = (member.get("membership", "") or "") if member else ""
    
    # Determine category based on membership
    coach_kw = ["THE COACH", "VIRTUAL COACH"]
    is_coach = any(kw in membership.upper() for kw in coach_kw)
    category = "THE COACH PASS MENSUEL" if is_coach else "ABONNEMENTS"
    
    import uuid
    # Cascade : existing.club_id (source la plus fiable) > header > user > fallback Versoix
    tx_club_id = existing.get("club_id") or resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/payments/{id}/mark-paid",
    )
    tx = {
        "id": str(uuid.uuid4()),
        "date": paid_date,
        "type": "revenue",
        "amount": existing.get("amount", 0),
        "category": category,
        "description": f"Paiement validé - {member_name}",
        "client_name": member_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "payment_validation",
        "payment_id": payment_id,
        "club_id": tx_club_id,
    }
    await db.accounting_transactions.insert_one(tx)
    
    # Recalculate KPI for the month
    month_str = paid_date[:7]
    from routers.kpis import recalculate_month
    payment_club_id = existing.get("club_id")
    await recalculate_month(month_str, payment_club_id)
    
    result = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    result["transaction_created"] = True
    warnings = await get_member_archived_warning(existing.get("member_id", ""))
    if warnings:
        result["warnings"] = warnings
    return result


@router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str):
    result = await db.payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    return {"message": "Paiement supprimé"}


@router.post("/payments/{payment_id}/revert-to-unpaid")
async def revert_payment_to_unpaid(payment_id: str):
    """Revert a paid payment back to pending or late based on due_date."""
    doc = await db.payments.find_one({"id": payment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    if doc.get("status") != "paid":
        raise HTTPException(status_code=400, detail=f"Transition impossible : le paiement est en statut '{doc.get('status')}', seul 'paid' peut être repassé en impayé")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    due_date = doc.get("due_date", "")
    new_status = "late" if due_date < today else "pending"

    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    updated = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    warnings = await get_member_archived_warning(doc.get("member_id", ""))
    if warnings:
        return {**updated, "warnings": warnings}
    return updated


@router.post("/payments/generate/{year}/{month}")
async def generate_monthly_payments(
    year: int,
    month: int,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    """Generate payments for a month based on active billing-enabled members"""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Mois invalide (1-12)")

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_str = f"{year}-{month:02d}"
    days_in_month = monthrange(year, month)[1]

    # Phase 3 Batch 3 fix 19/05 : club_id propagation orphan-detected.
    # Origine confirmée des 2 payments Mauricio + Valentina créés 19/05 09:43 UTC.
    # Résolu UNE seule fois (1 seul log MISSING_CLUB_ID si fallback, vs N membres).
    resolved_club_id = resolve_club_id_or_fallback(
        club_id=club_id,
        current_user=current_user,
        endpoint="/api/payments/generate/{year}/{month}",
    )
    
    # Get billing-enabled members (active, including coaches and offerts, non-departed, non-archived)
    all_members = await db.customer_members.find(
        exclude_archived(_cq(club_id, {"billing_enabled": True})),
        {"_id": 0}
    ).to_list(5000)
    
    members = []
    for m in all_members:
        exit_d = m.get("exit_date")
        if exit_d and exit_d not in (None, "", "None") and exit_d < today_str:
            continue
        # Skip DUO secondary members
        if m.get("duo_partner_id") and "&" not in m.get("name", ""):
            continue
        members.append(m)
    
    if not members:
        return {"message": "Aucun membre avec facturation active", "created": 0}
    
    created = []
    
    for member in members:
        # Check if payment already exists for this member this month
        existing = await db.payments.find_one({
            "member_id": member["id"],
            "due_date": {"$regex": f"^{month_str}"}
        })
        if existing:
            continue
        
        # Calculate due date from billing cycle
        cycle_type = member.get("billing_cycle_type", "monthly_day")
        cycle_value = member.get("billing_cycle_value", 1)
        
        if cycle_type == "interval_days" and cycle_value and int(cycle_value) > 0:
            # Calculate from contract start date + N-day intervals
            start_str = member.get("contract_signed_date", "")
            if start_str:
                try:
                    start_dt = datetime.strptime(start_str[:10], "%Y-%m-%d")
                    interval = int(cycle_value)
                    month_start = datetime(year, month, 1)
                    month_end = datetime(year, month, days_in_month, 23, 59, 59)
                    days_since = (month_start - start_dt).days
                    if days_since < 0:
                        due_dt = start_dt
                    else:
                        cycles_passed = days_since // interval
                        due_dt = start_dt + timedelta(days=cycles_passed * interval)
                        if due_dt < month_start:
                            due_dt += timedelta(days=interval)
                    if month_start <= due_dt <= month_end:
                        due_date = due_dt.strftime("%Y-%m-%d")
                    else:
                        continue  # No payment due this month
                except (ValueError, TypeError):
                    day = min(int(cycle_value or 1), days_in_month)
                    due_date = f"{month_str}-{day:02d}"
            else:
                day = min(int(cycle_value or 1), days_in_month)
                due_date = f"{month_str}-{day:02d}"
        elif cycle_type == "monthly_day":
            day = min(cycle_value or 1, days_in_month)
            due_date = f"{month_str}-{day:02d}"
        else:
            due_date = f"{month_str}-01"
        
        amt = member.get("billing_amount", 0) or 0
        
        # Skip members with 0 CHF billing
        if amt <= 0:
            continue
        
        payment = Payment(
            member_id=member["id"],
            schedule_id=member["id"],
            amount=amt,
            due_date=due_date,
            status="pending",
            payment_method=member.get("billing_payment_method", "prelevement")
        )
        doc = payment.model_dump()
        doc["member_name"] = member["name"]
        doc["club_id"] = resolved_club_id  # Phase 3 Batch 3 — défense en profondeur

        await db.payments.insert_one(doc)
        doc.pop('_id', None)
        created.append(doc)
    
    return {
        "month": month_str,
        "month_name": MONTHS_FR[month - 1],
        "created": len(created),
        "payments": created
    }
