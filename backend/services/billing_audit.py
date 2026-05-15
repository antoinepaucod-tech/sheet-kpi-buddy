"""
Service Billing Audit — Détection des membres `billing_enabled=true` sans `payment_schedules` actif.
Read-only. Réutilisé par le CRON hebdomadaire (services/orphan_audit.py)
et par l'endpoint admin manuel.

Logique IDENTIQUE au script `scripts/audit_billing_without_schedules.py` :
  - Filtre : `billing_enabled=true` + `club_id` Versoix
  - Exclure : archived OU expired OU category Coach (cascade Sprint C)
  - RED    = 0 schedule + 0 payments  (revenu manqué probable)
  - ORANGE = 0 schedule + >=1 payments (auto-billing KO mais compta OK)
"""
import logging
from collections import defaultdict
from datetime import date, datetime, timezone

from core.member_categorization import get_member_category


logger = logging.getLogger(__name__)

VERSOIX_CLUB_ID = "0a327bf5-c759-49eb-87e4-551913f78bdb"
MAX_DETAILS_PER_BUCKET = 10  # cap pour l'email payload


def _months_between(start_iso: str, end_iso: str) -> int:
    try:
        s = date.fromisoformat(start_iso[:10])
        e = date.fromisoformat(end_iso[:10])
        if e < s:
            return 0
        return max(0, (e.year - s.year) * 12 + (e.month - s.month))
    except Exception:
        return 0


async def run_billing_audit(db, club_id: str = VERSOIX_CLUB_ID) -> dict:
    """Read-only audit. Returns:
        {
          red_count, orange_count, total_billing_on,
          red_details: [..max 10..], orange_details: [..max 10..],
          red_estimated_lost_revenue_chf, scanned_at
        }
    """
    today_iso = date.today().isoformat()

    # Pré-load membership_types pour cascade Sprint C
    mtypes = await db.membership_types.find({}, {"_id": 0}).to_list(length=500)
    mtypes_by_name = {m["name"]: m for m in mtypes if m.get("name")}

    members = await db.customer_members.find(
        {"club_id": club_id, "billing_enabled": True},
        {"_id": 0},
    ).to_list(length=5000)

    # Pré-agrégation payment_schedules + payments par member_id
    ps_by_member = defaultdict(list)
    async for ps in db.payment_schedules.find(
        {"club_id": club_id}, {"_id": 0, "member_id": 1, "is_active": 1}
    ):
        if ps.get("member_id"):
            ps_by_member[ps["member_id"]].append(ps)

    pay_by_member = defaultdict(list)
    async for p in db.payments.find(
        {"club_id": club_id}, {"_id": 0, "member_id": 1, "amount": 1}
    ):
        if p.get("member_id"):
            pay_by_member[p["member_id"]].append(p)

    red_details, orange_details = [], []
    red_lost_sum = 0.0

    for m in members:
        mid = m.get("id")
        category = get_member_category(m, mtypes_by_name)
        if category == "Coach":
            continue  # BLUE (bénin, exempté)
        if m.get("archived_at"):
            continue  # GREY (bénin)
        end = m.get("subscription_end_date")
        if end and end < today_iso:
            continue  # GREY (expiré, bénin)

        schedules = ps_by_member.get(mid, [])
        payments = pay_by_member.get(mid, [])
        if len(schedules) > 0:
            continue  # OUT_OF_SCOPE (sain)

        # On est en RED ou ORANGE
        mt = mtypes_by_name.get(m.get("membership") or "")
        monthly_price = (mt or {}).get("monthly_price") or (mt or {}).get("price") or None
        sub_start = m.get("subscription_start_date") or (m.get("created_at") or "")[:10]
        months_active = _months_between(sub_start, today_iso) if sub_start else 0
        estimated_lost = (monthly_price * months_active) if (monthly_price and monthly_price > 0) else None

        row = {
            "member_id": mid,
            "name": m.get("name"),
            "email": m.get("email"),
            "membership": m.get("membership"),
            "monthly_price": monthly_price,
            "months_active": months_active,
            "estimated_lost_revenue_chf": estimated_lost,
            "n_payments": len(payments),
        }
        if len(payments) == 0:
            red_details.append(row)
            if estimated_lost:
                red_lost_sum += estimated_lost
        else:
            row["sum_payments_chf"] = round(sum(p.get("amount") or 0 for p in payments), 2)
            orange_details.append(row)

    # Cap details count for email payload
    red_details_sorted = sorted(
        red_details,
        key=lambda r: r.get("estimated_lost_revenue_chf") or 0,
        reverse=True,
    )

    return {
        "total_billing_on": len(members),
        "red_count": len(red_details),
        "orange_count": len(orange_details),
        "red_estimated_lost_revenue_chf": round(red_lost_sum, 2),
        "red_details": red_details_sorted[:MAX_DETAILS_PER_BUCKET],
        "orange_details": orange_details[:MAX_DETAILS_PER_BUCKET],
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }
