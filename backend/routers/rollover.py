"""Monthly rollover CRON — Automatic month-to-month continuity"""
from datetime import datetime, timezone, timedelta
from calendar import monthrange
from typing import Optional
import logging
import uuid

from fastapi import APIRouter, Depends
from core.config import db, MONTHS_FR, exclude_archived
from core.security import get_club_id

router = APIRouter(prefix="/rollover", tags=["rollover"])
logger = logging.getLogger(__name__)

_rollover_state = {
    "last_run": None,
    "last_status": "never",
    "last_detail": None,
}


def _cq(club_id, base=None):
    q = dict(base or {})
    if club_id:
        q["club_id"] = club_id
    return q


async def _generate_payments_for_month(year: int, month: int, club_id: str) -> int:
    """Generate payments for a given month. Idempotent — skips existing."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_str = f"{year}-{month:02d}"
    days_in_month = monthrange(year, month)[1]

    all_members = await db.customer_members.find(
        exclude_archived(_cq(club_id, {"billing_enabled": True})), {"_id": 0}
    ).to_list(5000)

    members = []
    for m in all_members:
        exit_d = m.get("exit_date")
        if exit_d and exit_d not in (None, "", "None") and exit_d < today_str:
            continue
        if m.get("duo_partner_id") and "&" not in m.get("name", ""):
            continue
        members.append(m)

    created = 0
    for member in members:
        existing = await db.payments.find_one({
            "member_id": member["id"],
            "due_date": {"$regex": f"^{month_str}"}
        })
        if existing:
            continue

        amt = member.get("billing_amount", 0) or 0
        if amt <= 0:
            continue

        cycle_type = member.get("billing_cycle_type", "monthly_day")
        cycle_value = member.get("billing_cycle_value") or member.get("billing_day") or 1

        if cycle_type == "interval_days" and cycle_value and int(cycle_value) > 0:
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
                        continue
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

        payment = {
            "id": str(uuid.uuid4()),
            "member_id": member["id"],
            "schedule_id": member["id"],
            "member_name": member.get("name", ""),
            "amount": amt,
            "due_date": due_date,
            "status": "late" if due_date < today_str else "pending",
            "payment_method": member.get("billing_payment_method", "prelevement"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if club_id:
            payment["club_id"] = club_id
        await db.payments.insert_one(payment)
        created += 1

    return created


async def _generate_recurring_transactions_for_month(year: int, month: int, club_id: str) -> int:
    """Generate recurring transactions for a given month. Idempotent — checks for duplicates."""
    month_str = f"{year}-{month:02d}"
    days_in_month = monthrange(year, month)[1]

    recurring = await db.recurring_transactions.find(
        _cq(club_id, {"is_active": True}), {"_id": 0}
    ).to_list(1000)
    if not recurring:
        return 0

    excluded = await db.excluded_recurring_expenses.find(_cq(club_id), {"_id": 0}).to_list(1000)
    excluded_keys = {(e["category"], e["description"]) for e in excluded}

    # Get existing transactions for this month to avoid duplicates
    existing_txs = await db.accounting_transactions.find(
        _cq(club_id, {"date": {"$regex": f"^{month_str}"}}),
        {"_id": 0, "category": 1, "description": 1}
    ).to_list(10000)
    existing_keys = {(t.get("category", ""), t.get("description", "")) for t in existing_txs}

    created = 0
    for rec in recurring:
        if (rec["category"], rec["description"]) in excluded_keys:
            continue
        if (rec.get("amount", 0) or 0) <= 0:
            continue
        # Duplicate check: skip if a transaction with same category+description already exists this month
        if (rec["category"], rec["description"]) in existing_keys:
            continue

        day = min(rec.get("recurrence_day", 1), days_in_month)
        doc = {
            "id": str(uuid.uuid4()),
            "date": f"{month_str}-{day:02d}",
            "description": rec["description"],
            "amount": rec["amount"],
            "type": rec["type"],
            "category": rec["category"],
            "sub_type": rec.get("sub_type"),
        }
        if club_id:
            doc["club_id"] = club_id
        await db.accounting_transactions.insert_one(doc)
        doc.pop("_id", None)
        created += 1

    return created


async def _mark_late_payments(club_id: str) -> int:
    """Mark all past-due pending payments as late."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = await db.payments.update_many(
        _cq(club_id, {"due_date": {"$lt": today}, "status": "pending"}),
        {"$set": {"status": "late", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return result.modified_count


async def _ensure_kpi_exists(year: int, month: int, club_id: Optional[str]):
    """Ensure a monthly_kpis record exists for the given month.

    Phase 3 Batch 4 (2026-05-19) — défense en profondeur :
      - Garde-fou `club_id is None` : log structuré + SKIP (vs créer orphelin)
      - Bonus : injection `created_at` + `updated_at` pour traçabilité audit
        (l'orphelin monthly_kpis 2026-06 détecté Phase 1 avait `created_at=null`)
    """
    if not club_id:
        logger.warning(
            "ROLLOVER_MISSING_CLUB_ID event=skip_ensure_kpi "
            f"year={year} month={month} club_id={club_id!r}"
        )
        return None
    month_str = f"{year}-{month:02d}"
    existing = await db.monthly_kpis.find_one(_cq(club_id, {"month": month_str}))
    if not existing:
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.monthly_kpis.insert_one({
            "month": month_str,
            "club_id": club_id,
            "total_revenue": 0,
            "total_expenses": 0,
            "net_profit": 0,
            "total_members": 0,
            "new_members": 0,
            "lost_members": 0,
            "churn_rate": 0,
            "ad_spend": 0,
            "leads": 0,
            "cash_collected": 0,
            "roas": 0,
            "cac": 0,
            "created_at": now_iso,  # Phase 3 Batch 4 — traçabilité
            "updated_at": now_iso,
        })


async def run_monthly_rollover_for_club(club_id: str) -> dict:
    """Run the full monthly rollover for a single club."""
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month

    payments_created = await _generate_payments_for_month(year, month, club_id)
    txs_created = await _generate_recurring_transactions_for_month(year, month, club_id)
    late_marked = await _mark_late_payments(club_id)
    await _ensure_kpi_exists(year, month, club_id)

    # Auto-recalculate KPIs for the current month
    try:
        from routers.kpis import recalculate_month
        month_str = f"{year}-{month:02d}"
        await recalculate_month(month_str, club_id)
    except Exception as e:
        logger.warning(f"[Rollover] KPI recalc failed for {club_id}: {e}")

    return {
        "club_id": club_id,
        "month": f"{year}-{month:02d}",
        "payments_created": payments_created,
        "recurring_transactions_created": txs_created,
        "late_payments_marked": late_marked,
    }


async def run_rollover_all_clubs():
    """Run monthly rollover for ALL clubs. Called by APScheduler."""
    logger.info("[Rollover] Starting daily rollover for all clubs...")
    clubs = await db.clubs.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(50)
    results = []

    for club in clubs:
        club_id = club.get("id")
        if not club_id:
            # Phase 3 Batch 4 — défense en profondeur : skip docs legacy sans id
            logger.warning(
                "ROLLOVER_MISSING_CLUB_ID event=skip_legacy_club_doc "
                f"club_name={club.get('name')!r}"
            )
            results.append({"club_id": None, "error": "legacy_club_doc_without_id"})
            continue
        try:
            result = await run_monthly_rollover_for_club(club_id)
            results.append(result)
            logger.info(
                f"[Rollover] {club.get('name', club_id)}: "
                f"{result['payments_created']} paiements, "
                f"{result['recurring_transactions_created']} transactions, "
                f"{result['late_payments_marked']} retards"
            )
        except Exception as e:
            logger.error(f"[Rollover] Error for {club_id}: {e}")
            results.append({"club_id": club_id, "error": str(e)})

    # Trigger Supabase sync after rollover
    try:
        from routers.sync import sync_all_clubs
        await sync_all_clubs()
    except Exception as e:
        logger.warning(f"[Rollover] Supabase sync failed: {e}")

    _rollover_state["last_run"] = datetime.now(timezone.utc).isoformat()
    _rollover_state["last_status"] = "ok"
    _rollover_state["last_detail"] = results
    logger.info(f"[Rollover] Done for {len(results)} clubs.")
    return results


# ── API Endpoints ─────────────────────────────────────────────────────────────

@router.post("/run")
async def manual_rollover(club_id: Optional[str] = Depends(get_club_id)):
    """Manually trigger the monthly rollover for current club or all clubs."""
    if club_id:
        result = await run_monthly_rollover_for_club(club_id)
        _rollover_state["last_run"] = datetime.now(timezone.utc).isoformat()
        _rollover_state["last_status"] = "ok"
        _rollover_state["last_detail"] = [result]
        return result
    else:
        return await run_rollover_all_clubs()


@router.post("/run/all")
async def manual_rollover_all():
    """Manually trigger the monthly rollover for ALL clubs."""
    return await run_rollover_all_clubs()


@router.get("/status")
async def get_rollover_status():
    """Return current rollover status."""
    return _rollover_state
