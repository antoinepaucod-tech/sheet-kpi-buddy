"""Members routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
from uuid import uuid4

from core.config import db
from core.security import get_club_id
from models.members import (
    CustomerMember, CustomerMemberCreate,
    MemberRenewalHistory, WeeklyTraining, WeeklyTrainingUpdate,
    AnnualReview
)
from models.payments import PaymentSchedule
from models.challenges import ChallengeParticipant

router = APIRouter(prefix="/members", tags=["members"])

FREQUENCY_DELTA = {
    "weekly": relativedelta(weeks=1),
    "monthly": relativedelta(months=1),
    "quarterly": relativedelta(months=3),
    "semi-annually": relativedelta(months=6),
    "annually": relativedelta(years=1),
    "challenge": timedelta(days=42),  # 6 weeks challenge
}


def calc_review_date(contract_date_str, frequency):
    """Calculate first review date from contract date and frequency"""
    try:
        contract_date = datetime.fromisoformat(contract_date_str)
        delta = FREQUENCY_DELTA.get(frequency, relativedelta(years=1))
        return (contract_date + delta).strftime("%Y-%m-%d")
    except Exception:
        return None


COACH_KEYWORDS = ["THE COACH", "VIRTUAL COACH"]

def _is_coach(membership: str) -> bool:
    if not membership:
        return False
    upper = membership.upper()
    return any(kw in upper for kw in COACH_KEYWORDS)


@router.get("")
async def get_members(expiring_soon: Optional[bool] = None, member_type: Optional[str] = None, club_id: Optional[str] = Depends(get_club_id)):
    query = {}
    if club_id:
        query["club_id"] = club_id
    if member_type:
        query["member_type"] = member_type
    
    docs = await db.customer_members.find(query, {"_id": 0}).sort("name", 1).to_list(5000)
    
    # Add computed is_coach field
    for d in docs:
        d["is_coach"] = _is_coach(d.get("membership", ""))
    
    # Separate current vs departed (departed = exit_date in the past only)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    current_docs = [d for d in docs if not d.get("exit_date") or d["exit_date"] in [None, "", "None"] or d["exit_date"] >= today_str]
    departed_docs = [d for d in docs if d.get("exit_date") and d["exit_date"] not in [None, "", "None"] and d["exit_date"] < today_str]
    
    # Deduplicate ONLY within current members
    name_groups = {}
    for d in current_docs:
        name = d.get("name", "")
        if name not in name_groups:
            name_groups[name] = []
        name_groups[name].append(d)
    
    for name, group in name_groups.items():
        if len(group) <= 1:
            continue
        has_coach = any(d["is_coach"] for d in group)
        has_noncoach = any(not d["is_coach"] for d in group)
        if has_coach and has_noncoach:
            for d in group:
                if not d["is_coach"]:
                    d["is_coach_also"] = True
        # Handle true duplicates (same name AND same membership), but NOT DUO pairs
        seen = set()
        for d in group:
            key = d.get("membership", "")
            if key in seen:
                # Don't flag DUO partners as duplicates
                if not d.get("is_duo"):
                    d["is_duplicate"] = True
            seen.add(key)
    
    if expiring_soon:
        today = datetime.now(timezone.utc).date()
        thirty_days = today + timedelta(days=30)
        docs = [
            d for d in docs
            if d.get("subscription_end_date") and
            today <= datetime.fromisoformat(d["subscription_end_date"]).date() <= thirty_days
        ]
    
    return docs


@router.get("/stats")
async def get_member_stats(club_id: Optional[str] = Depends(get_club_id)):
    """Real-time member statistics computed from raw data."""
    query = {}
    if club_id:
        query["club_id"] = club_id
    docs = await db.customer_members.find(query, {"_id": 0}).to_list(5000)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    thirty_days = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")

    departed = [d for d in docs if d.get("exit_date") and d["exit_date"] not in [None, "", "None"] and d["exit_date"] < today]
    current = [d for d in docs if not d.get("exit_date") or d["exit_date"] in [None, "", "None"] or d["exit_date"] >= today]

    # Deduplicate: identify people with both coach + non-coach subscriptions
    name_coach_map = {}
    for d in current:
        name = d.get("name", "")
        is_coach = _is_coach(d.get("membership", ""))
        if name not in name_coach_map:
            name_coach_map[name] = {"coach": False, "noncoach": False, "ids": []}
        if is_coach:
            name_coach_map[name]["coach"] = True
        else:
            name_coach_map[name]["noncoach"] = True
        name_coach_map[name]["ids"].append(d.get("id"))

    # Build sets of IDs to skip (non-coach records of people who are also coaches, and duplicates)
    skip_ids = set()
    seen_memberships = {}
    for name, info in name_coach_map.items():
        if info["coach"] and info["noncoach"]:
            # Skip non-coach records for this person
            for d in current:
                if d.get("name") == name and not _is_coach(d.get("membership", "")):
                    skip_ids.add(d.get("id"))
    # Also skip exact duplicates (same name + same membership), but NOT DUO pairs
    seen = set()
    for d in current:
        key = (d.get("name", ""), d.get("membership", ""))
        if key in seen:
            # Don't skip DUO partners
            if not d.get("is_duo"):
                skip_ids.add(d.get("id"))
        seen.add(key)

    deduped = [d for d in current if d.get("id") not in skip_ids]

    coaches = [d for d in deduped if _is_coach(d.get("membership", ""))]
    non_coaches = [d for d in deduped if not _is_coach(d.get("membership", ""))]

    active_coaches = [d for d in coaches if not d.get("subscription_end_date") or d["subscription_end_date"] >= today]
    active_members = [d for d in non_coaches if not d.get("subscription_end_date") or d["subscription_end_date"] >= today]
    expired_members = [d for d in non_coaches if d.get("subscription_end_date") and d["subscription_end_date"] < today]
    expired_coaches = [d for d in coaches if d.get("subscription_end_date") and d["subscription_end_date"] < today]

    expiring = [d for d in deduped if d.get("subscription_end_date") and today <= d["subscription_end_date"] <= thirty_days]

    pif_active = [d for d in active_members if d.get("member_type") == "Membres PIF"]
    recurring_active = [d for d in active_members if d.get("member_type") == "Membres Généraux Récurrents"]

    return {
        "total": len(docs),
        "active_members": len(active_members),
        "active_coaches": len(active_coaches),
        "expired_members": len(expired_members),
        "expired_coaches": len(expired_coaches),
        "departed": len(departed),
        "expiring_30d": len(expiring),
        "pif_active": len(pif_active),
        "recurring_active": len(recurring_active),
        "total_coaches": len(coaches),
        "total_non_coaches": len(non_coaches),
    }


@router.get("/memberships")
async def get_unique_memberships(club_id: Optional[str] = Depends(get_club_id)):
    """Return all unique membership names from the members collection."""
    query = {}
    if club_id:
        query["club_id"] = club_id
    docs = await db.customer_members.find(query, {"_id": 0, "membership": 1}).to_list(5000)
    memberships = sorted(set(d.get("membership", "") for d in docs if d.get("membership")))
    return memberships




@router.get("/expiring")
async def get_expiring_members(days: int = 30, club_id: Optional[str] = Depends(get_club_id)):
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=days)
    
    query = {}
    if club_id:
        query["club_id"] = club_id
    docs = await db.customer_members.find(query, {"_id": 0}).to_list(1000)
    expiring = []
    for d in docs:
        if d.get("subscription_end_date") and not d.get("exit_date"):
            sub_end = datetime.fromisoformat(d["subscription_end_date"]).date()
            if today <= sub_end <= end_date:
                d["days_remaining"] = (sub_end - today).days
                expiring.append(d)
    
    expiring.sort(key=lambda x: x.get("days_remaining", 999))
    return expiring


@router.get("/{member_id}")
async def get_member(member_id: str):
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    # Enrich duo info
    if doc.get("duo_partner_id"):
        partner = await db.customer_members.find_one(
            {"id": doc["duo_partner_id"]}, {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}
        )
        if partner:
            doc["duo_partner_name"] = partner.get("name", "")
    return doc


@router.post("")
async def create_member(data: CustomerMemberCreate, club_id: Optional[str] = Depends(get_club_id)):
    member_data = data.model_dump()
    
    # Add club_id to the member
    if club_id:
        member_data["club_id"] = club_id
    
    # Auto-detect challenge membership type
    is_challenge = data.membership and "challenge" in data.membership.lower()
    
    # If challenge, override review settings
    if is_challenge:
        member_data["annual_review_enabled"] = True
        member_data["review_frequency"] = "challenge"
        if data.contract_signed_date:
            review_date = calc_review_date(data.contract_signed_date, "challenge")
            if review_date:
                member_data["annual_review_date"] = review_date
    elif data.annual_review_enabled and data.contract_signed_date:
        freq = getattr(data, 'review_frequency', 'annually')
        review_date = calc_review_date(data.contract_signed_date, freq)
        if review_date:
            member_data["annual_review_date"] = review_date
    
    member = CustomerMember(**member_data)
    doc = member.model_dump()
    await db.customer_members.insert_one(doc)
    doc.pop('_id', None)
    
    # Create payment schedule if billing is enabled
    if data.billing_enabled and data.billing_amount > 0:
        schedule = PaymentSchedule(
            member_id=doc["id"],
            amount=data.billing_amount,
            recurrence_type=data.billing_cycle_type,
            recurrence_value=data.billing_cycle_value,
            start_date=data.contract_signed_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            payment_method=data.billing_payment_method,
            is_active=True
        )
        schedule_doc = schedule.model_dump()
        if club_id:
            schedule_doc["club_id"] = club_id
        await db.payment_schedules.insert_one(schedule_doc)
    
    # Create review if enabled or if challenge (auto-enabled)
    if (data.annual_review_enabled or is_challenge) and doc.get("annual_review_date"):
        freq = "challenge" if is_challenge else getattr(data, 'review_frequency', 'annually')
        annual_review = AnnualReview(
            member_id=doc["id"],
            review_date=doc["annual_review_date"],
            review_type=freq,
            status="scheduled"
        )
        review_doc = annual_review.model_dump()
        if club_id:
            review_doc["club_id"] = club_id
        await db.annual_reviews.insert_one(review_doc)

    # Create duo partner if duo subscription
    if data.is_duo and data.duo_partner_name:
        partner = CustomerMember(
            name=data.duo_partner_name,
            email=data.duo_partner_email or "",
            phone=data.duo_partner_phone or "",
            membership=data.membership,
            member_type=data.member_type,
            contract_signed_date=data.contract_signed_date,
            subscription_end_date=data.subscription_end_date,
            cash_collected=0,
            is_duo=True,
            duo_partner_id=doc["id"],
            duo_primary=False,
            notes=f"Partenaire duo de {data.name}",
        )
        partner_doc = partner.model_dump()
        if club_id:
            partner_doc["club_id"] = club_id
        await db.customer_members.insert_one(partner_doc)
        partner_doc.pop("_id", None)

        # Link primary to partner
        await db.customer_members.update_one(
            {"id": doc["id"]},
            {"$set": {"is_duo": True, "duo_partner_id": partner_doc["id"], "duo_primary": True}}
        )
        doc["is_duo"] = True
        doc["duo_partner_id"] = partner_doc["id"]
        doc["duo_primary"] = True

    # Auto-add to active challenge if membership is a challenge type
    if doc.get("membership") and "challenge" in doc["membership"].lower():
        active_challenge = await db.six_weeks_challenges.find_one({"is_active": True}, {"_id": 0})
        if active_challenge:
            # Check not already participant
            existing_p = await db.challenge_participants.find_one({
                "challenge_id": active_challenge["id"], "member_id": doc["id"]
            })
            if not existing_p:
                participant = ChallengeParticipant(
                    challenge_id=active_challenge["id"],
                    member_id=doc["id"],
                    member_name=doc["name"]
                )
                p_doc = participant.model_dump()
                await db.challenge_participants.insert_one(p_doc)

    # Create accounting transaction for the initial payment
    if data.cash_collected and data.cash_collected > 0:
        rev_cat = await db.accounting_categories.find_one({"type": "revenue", "kpi_column": "revenue_members"})
        cat_name = rev_cat["name"] if rev_cat else "ABONNEMENTS"
        tx_doc = {
            "id": f"member-{doc['id']}-initial",
            "date": data.contract_signed_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "description": f"Vente {data.membership} - {data.name}",
            "amount": data.cash_collected,
            "type": "revenue",
            "category": cat_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if club_id:
            tx_doc["club_id"] = club_id
        existing_tx = await db.accounting_transactions.find_one({"id": tx_doc["id"]})
        if not existing_tx:
            await db.accounting_transactions.insert_one(tx_doc)
            tx_doc.pop("_id", None)
        # Auto-recalculate KPIs
        from routers.transactions import _auto_recalculate_kpis
        await _auto_recalculate_kpis(tx_doc["date"])

    # Log creation
    await log_member_activity(doc["id"], "member_created", f"Membre créé : {doc.get('name')}", club_id=club_id)

    return doc


@router.put("/{member_id}")
async def update_member(member_id: str, data: CustomerMemberCreate, club_id: Optional[str] = Depends(get_club_id)):
    existing = await db.customer_members.find_one({"id": member_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    
    update_data = data.model_dump()
    
    # Update review date if enabled and changed
    if data.annual_review_enabled and data.contract_signed_date:
        freq = getattr(data, 'review_frequency', 'annually')
        review_date = calc_review_date(data.contract_signed_date, freq)
        if review_date:
            update_data["annual_review_date"] = review_date
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.customer_members.update_one({"id": member_id}, {"$set": update_data})

    # Sync bilans when review_frequency changes
    old_freq = existing.get("review_frequency", "monthly")
    new_freq = update_data.get("review_frequency", old_freq)
    if new_freq != old_freq:
        # Delete all scheduled reviews for this member
        deleted = await db.annual_reviews.delete_many({
            "member_id": member_id,
            "status": "scheduled",
        })
        # Create a new scheduled review with the correct frequency
        delta = FREQUENCY_DELTA.get(new_freq, relativedelta(months=1))
        # Base: last completed review, or contract_signed_date
        last_completed = await db.annual_reviews.find_one(
            {"member_id": member_id, "status": "completed"},
            {"_id": 0, "review_date": 1},
            sort=[("review_date", -1)]
        )
        if last_completed:
            base_date = datetime.strptime(last_completed["review_date"], "%Y-%m-%d")
        elif update_data.get("contract_signed_date"):
            base_date = datetime.strptime(update_data["contract_signed_date"], "%Y-%m-%d")
        else:
            base_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        next_date = base_date + delta
        today_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        # Advance to current or next period
        while next_date + delta <= today_dt:
            next_date = next_date + delta
        new_review = AnnualReview(
            member_id=member_id,
            review_date=next_date.strftime("%Y-%m-%d"),
            review_type=new_freq,
            status="scheduled",
        )
        await db.annual_reviews.insert_one(new_review.model_dump())
        update_data["annual_review_date"] = next_date.strftime("%Y-%m-%d")
        await db.customer_members.update_one(
            {"id": member_id},
            {"$set": {"annual_review_date": next_date.strftime("%Y-%m-%d")}}
        )
        # Log activity
        await db.activity_logs.insert_one({
            "id": str(uuid4()),
            "member_id": member_id,
            "action": "review_frequency_changed",
            "description": f"Fréquence bilan changée: {old_freq} → {new_freq}. {deleted.deleted_count} bilan(s) planifié(s) supprimé(s), nouveau bilan {new_freq} créé le {next_date.strftime('%Y-%m-%d')}.",
            "user_name": "Utilisateur",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # If DUO primary, propagate key changes to partner
    if existing.get("duo_primary") and existing.get("duo_partner_id"):
        partner_update = {}
        propagate_fields = ["membership", "member_type", "subscription_end_date", "contract_signed_date"]
        for field in propagate_fields:
            new_val = update_data.get(field)
            if new_val is not None and new_val != existing.get(field):
                partner_update[field] = new_val
        # Propagate billing changes too
        billing_fields = ["billing_enabled", "billing_amount", "billing_day",
                          "billing_cycle_type", "billing_cycle_value", "billing_payment_method"]
        for field in billing_fields:
            new_val = update_data.get(field)
            if new_val is not None and new_val != existing.get(field):
                partner_update[field] = new_val
        if partner_update:
            partner_update["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.customer_members.update_one(
                {"id": existing["duo_partner_id"]}, {"$set": partner_update}
            )
    
    # Update payment schedule if billing changed
    existing_schedule = await db.payment_schedules.find_one({"member_id": member_id, "is_active": True})
    
    if data.billing_enabled and data.billing_amount > 0:
        schedule_update = {
            "amount": data.billing_amount,
            "recurrence_type": data.billing_cycle_type,
            "recurrence_value": data.billing_cycle_value,
            "payment_method": data.billing_payment_method,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing_schedule:
            await db.payment_schedules.update_one({"id": existing_schedule["id"]}, {"$set": schedule_update})
        else:
            schedule = PaymentSchedule(
                member_id=member_id,
                amount=data.billing_amount,
                recurrence_type=data.billing_cycle_type,
                recurrence_value=data.billing_cycle_value,
                start_date=data.contract_signed_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                payment_method=data.billing_payment_method,
                is_active=True
            )
            await db.payment_schedules.insert_one(schedule.model_dump())
    elif existing_schedule and not data.billing_enabled:
        await db.payment_schedules.update_one({"id": existing_schedule["id"]}, {"$set": {"is_active": False}})
    
    # Log modification
    await log_member_activity(member_id, "member_updated", f"Fiche membre modifiée : {data.name}", club_id=club_id)

    return await db.customer_members.find_one({"id": member_id}, {"_id": 0})



@router.post("/{member_id}/dissociate-duo")
async def dissociate_duo(member_id: str):
    """Dissociate a DUO pair into two individual subscriptions."""
    member = await db.customer_members.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    if not member.get("is_duo"):
        raise HTTPException(status_code=400, detail="Ce membre n'est pas un DUO")

    partner_id = member.get("duo_partner_id")
    now = datetime.now(timezone.utc).isoformat()

    # Remove DUO flags from this member
    duo_clear = {
        "is_duo": False,
        "duo_partner_id": None,
        "duo_primary": False,
        "updated_at": now,
    }
    await db.customer_members.update_one({"id": member_id}, {"$set": duo_clear})

    # Remove DUO flags from partner
    if partner_id:
        await db.customer_members.update_one({"id": partner_id}, {"$set": duo_clear})
        # Also clear reverse link if partner points back
        await db.customer_members.update_one(
            {"duo_partner_id": member_id}, {"$set": duo_clear}
        )

    return {
        "message": "DUO dissocié. Les deux membres ont maintenant des abonnements individuels.",
        "member_id": member_id,
        "partner_id": partner_id,
    }


@router.delete("/{member_id}")
async def delete_member(member_id: str):
    member = await db.customer_members.find_one({"id": member_id}, {"_id": 0, "name": 1})
    result = await db.customer_members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    await db.weekly_trainings.delete_many({"member_id": member_id})
    await db.challenge_checkins.delete_many({"member_id": member_id})
    await db.member_renewals.delete_many({"member_id": member_id})
    return {"message": "Membre et données associées supprimés"}


@router.post("/{member_id}/renew")
async def renew_membership(member_id: str, body: dict):
    member = await db.customer_members.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    
    new_end_date = body.get("new_end_date")
    renewal_duration = body.get("renewal_duration", "12 mois")
    is_no_commitment = renewal_duration == "Sans engagement"
    
    if not new_end_date and not is_no_commitment:
        raise HTTPException(status_code=400, detail="new_end_date requis")
    
    renewal = MemberRenewalHistory(
        member_id=member_id,
        previous_end_date=member.get("subscription_end_date"),
        new_end_date=new_end_date if new_end_date else "Sans engagement",
        renewal_duration=renewal_duration,
        notes=body.get("notes", "")
    )
    await db.member_renewals.insert_one(renewal.model_dump())
    
    member_update = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if is_no_commitment:
        member_update["subscription_end_date"] = None
    else:
        member_update["subscription_end_date"] = new_end_date
    
    # Update membership type if changing
    if "new_membership" in body:
        member_update["membership"] = body["new_membership"]
    if "new_member_type" in body:
        member_update["member_type"] = body["new_member_type"]
    
    # Auto-add to challenge if new membership is challenge type
    new_membership = body.get("new_membership", member.get("membership", ""))
    if new_membership and "challenge" in new_membership.lower():
        active_challenge = await db.six_weeks_challenges.find_one({"is_active": True}, {"_id": 0})
        if active_challenge:
            existing_p = await db.challenge_participants.find_one({
                "challenge_id": active_challenge["id"], "member_id": member_id
            })
            if not existing_p:
                participant = ChallengeParticipant(
                    challenge_id=active_challenge["id"],
                    member_id=member_id,
                    member_name=member.get("name", "")
                )
                await db.challenge_participants.insert_one(participant.model_dump())
    
    # Update billing cycle if provided
    if "billing_cycle_type" in body:
        member_update["billing_cycle_type"] = body["billing_cycle_type"]
    if "billing_cycle_value" in body:
        member_update["billing_cycle_value"] = body["billing_cycle_value"]
    if "billing_amount" in body:
        member_update["billing_amount"] = body["billing_amount"]
    if "billing_payment_method" in body:
        member_update["billing_payment_method"] = body["billing_payment_method"]
    
    # Schedule next review based on frequency
    if member.get("annual_review_enabled"):
        freq = member.get("review_frequency", "annually")
        delta = FREQUENCY_DELTA.get(freq, relativedelta(years=1))
        try:
            end_date = datetime.fromisoformat(new_end_date)
            review_date = (end_date + delta).strftime("%Y-%m-%d")
            member_update["annual_review_date"] = review_date
            annual_review = AnnualReview(
                member_id=member_id,
                review_date=review_date,
                review_type=freq,
                status="scheduled"
            )
            await db.annual_reviews.insert_one(annual_review.model_dump())
        except Exception:
            pass
    
    await db.customer_members.update_one({"id": member_id}, {"$set": member_update})
    
    # Update payment schedule if billing cycle changed
    if any(k in body for k in ["billing_cycle_type", "billing_cycle_value", "billing_amount", "billing_payment_method"]):
        existing_schedule = await db.payment_schedules.find_one({"member_id": member_id, "is_active": True})
        if existing_schedule:
            schedule_update = {"updated_at": datetime.now(timezone.utc).isoformat()}
            if "billing_cycle_type" in body:
                schedule_update["recurrence_type"] = body["billing_cycle_type"]
            if "billing_cycle_value" in body:
                schedule_update["recurrence_value"] = body["billing_cycle_value"]
            if "billing_amount" in body:
                schedule_update["amount"] = body["billing_amount"]
            if "billing_payment_method" in body:
                schedule_update["payment_method"] = body["billing_payment_method"]
            await db.payment_schedules.update_one({"id": existing_schedule["id"]}, {"$set": schedule_update})
    
    doc = await db.customer_members.find_one({"id": member_id}, {"_id": 0})
    return {"member": doc, "message": "Abonnement renouvelé"}


@router.get("/{member_id}/renewals")
async def get_member_renewals(member_id: str):
    return await db.member_renewals.find({"member_id": member_id}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.put("/{member_id}/onboarding")
async def update_member_onboarding(member_id: str, body: dict):
    """Update onboarding steps for a member"""
    existing = await db.customer_members.find_one({"id": member_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    
    update = {}
    onboarding_fields = [
        "onboarding_bsport", "onboarding_hubfit", "onboarding_nutrition",
        "questionnaire_coaching", "session_introduction"
    ]
    
    for field in onboarding_fields:
        if field in body:
            update[field] = body[field]
    
    all_steps = [update.get(f, existing.get(f, False)) for f in onboarding_fields]
    if all(all_steps):
        update["onboarding_completed"] = True
        update["onboarding_completed_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    else:
        update["onboarding_completed"] = False
        update["onboarding_completed_date"] = None
    
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.customer_members.update_one({"id": member_id}, {"$set": update})
    return await db.customer_members.find_one({"id": member_id}, {"_id": 0})


@router.get("/{member_id}/annual-reviews")
async def get_member_annual_reviews(member_id: str):
    """Get all annual reviews for a specific member"""
    return await db.annual_reviews.find({"member_id": member_id}, {"_id": 0}).sort("review_date", -1).to_list(50)



@router.get("/{member_id}/activity-log")
async def get_member_activity_log(member_id: str):
    """Get full activity log for a member"""
    return await db.activity_logs.find(
        {"member_id": member_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)


async def log_member_activity(member_id: str, action: str, description: str, user_name: str = "Utilisateur", club_id: str = None):
    """Helper to log an activity on a member"""
    doc = {
        "id": str(uuid4()),
        "member_id": member_id,
        "action": action,
        "description": description,
        "user_name": user_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if club_id:
        doc["club_id"] = club_id
    await db.activity_logs.insert_one(doc)
