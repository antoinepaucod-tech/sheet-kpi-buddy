"""Franchise Dashboard routes - Aggregated KPIs across all clubs"""
from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone

from core.config import db
from core.security import get_current_user

router = APIRouter(prefix="/franchise", tags=["franchise"])


@router.get("/dashboard")
async def get_franchise_dashboard(month: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """
    Get aggregated KPIs across all clubs for the franchise dashboard.
    Only accessible to super_admin.
    """
    if current_user.get("role") != "super_admin":
        return {"error": "Accès réservé au Super Admin"}

    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")

    clubs = await db.clubs.find({"is_active": True}, {"_id": 0}).to_list(50)

    club_data = []
    totals = {
        "total_revenue": 0,
        "total_expenses": 0,
        "ad_spend": 0,
        "total_members": 0,
        "new_members": 0,
        "lost_members": 0,
        "coach_members": 0,
    }

    for club in clubs:
        cid = club["id"]

        # Get KPI for this club/month
        kpi = await db.monthly_kpis.find_one(
            {"club_id": cid, "month": month}, {"_id": 0}
        )

        # Get member counts
        active_members = await db.customer_members.count_documents({
            "club_id": cid,
            "member_type": {"$nin": ["coach"]},
            "$or": [
                {"exit_date": None}, {"exit_date": ""},
                {"exit_date": {"$exists": False}},
            ]
        })

        coach_count = await db.customer_members.count_documents({
            "club_id": cid,
            "member_type": "coach",
            "$or": [
                {"exit_date": None}, {"exit_date": ""},
                {"exit_date": {"$exists": False}},
            ]
        })

        revenue = kpi.get("total_revenue", 0) if kpi else 0
        expenses = kpi.get("total_expenses", 0) if kpi else 0
        ad_spend = kpi.get("ad_spend", 0) if kpi else 0
        new = kpi.get("new_members", 0) if kpi else 0
        lost = kpi.get("lost_members", 0) if kpi else 0

        club_entry = {
            "club_id": cid,
            "club_name": club["name"],
            "slug": club.get("slug", ""),
            "total_revenue": revenue,
            "total_expenses": expenses,
            "ad_spend": ad_spend,
            "net_profit": revenue - abs(expenses),
            "active_members": active_members,
            "coach_members": coach_count,
            "new_members": new,
            "lost_members": lost,
            "acrm": round(revenue / active_members, 2) if active_members > 0 else 0,
        }
        club_data.append(club_entry)

        totals["total_revenue"] += revenue
        totals["total_expenses"] += abs(expenses)
        totals["ad_spend"] += ad_spend
        totals["total_members"] += active_members
        totals["new_members"] += new
        totals["lost_members"] += lost
        totals["coach_members"] += coach_count

    totals["net_profit"] = totals["total_revenue"] - totals["total_expenses"]
    totals["acrm"] = round(totals["total_revenue"] / totals["total_members"], 2) if totals["total_members"] > 0 else 0
    totals["churn_rate"] = round(
        (totals["lost_members"] / (totals["total_members"] + totals["lost_members"])) * 100, 1
    ) if (totals["total_members"] + totals["lost_members"]) > 0 else 0

    return {
        "month": month,
        "totals": totals,
        "clubs": club_data,
        "club_count": len(clubs),
    }


@router.get("/trends")
async def get_franchise_trends(months: int = 6, current_user: dict = Depends(get_current_user)):
    """
    Get monthly trends across all clubs for comparison charts.
    """
    if current_user.get("role") != "super_admin":
        return {"error": "Accès réservé au Super Admin"}

    clubs = await db.clubs.find({"is_active": True}, {"_id": 0}).to_list(50)

    # Get all KPIs sorted by month
    all_kpis = await db.monthly_kpis.find(
        {}, {"_id": 0, "month": 1, "club_id": 1, "total_revenue": 1, "total_expenses": 1,
             "ad_spend": 1, "new_members": 1, "lost_members": 1, "total_members": 1}
    ).sort("month", -1).to_list(1000)

    # Group by month
    from collections import defaultdict
    monthly = defaultdict(lambda: {"revenue": 0, "expenses": 0, "ad_spend": 0, "members": 0, "clubs": {}})

    club_map = {c["id"]: c["name"] for c in clubs}

    for kpi in all_kpis:
        m = kpi["month"]
        cid = kpi.get("club_id", "unknown")
        cname = club_map.get(cid, "Unknown")

        monthly[m]["revenue"] += kpi.get("total_revenue", 0)
        monthly[m]["expenses"] += abs(kpi.get("total_expenses", 0))
        monthly[m]["ad_spend"] += kpi.get("ad_spend", 0)
        monthly[m]["members"] += kpi.get("total_members", 0)

        monthly[m]["clubs"][cname] = {
            "revenue": kpi.get("total_revenue", 0),
            "expenses": abs(kpi.get("total_expenses", 0)),
            "ad_spend": kpi.get("ad_spend", 0),
            "members": kpi.get("total_members", 0),
        }

    # Sort and limit
    sorted_months = sorted(monthly.keys(), reverse=True)[:months]
    sorted_months.reverse()

    trends = []
    for m in sorted_months:
        entry = monthly[m]
        entry["month"] = m
        trends.append(entry)

    return {
        "trends": trends,
        "clubs": [c["name"] for c in clubs],
    }


@router.get("/ad-budgets")
async def get_franchise_ad_budgets(current_user: dict = Depends(get_current_user)):
    """
    Get ad spend budgets allocated per club.
    """
    if current_user.get("role") != "super_admin":
        return {"error": "Accès réservé au Super Admin"}

    clubs = await db.clubs.find({"is_active": True}, {"_id": 0}).to_list(50)

    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")

    budgets = []
    total_spend = 0
    total_budget = 0

    for club in clubs:
        cid = club["id"]

        # Get current month KPI for ad_spend
        kpi = await db.monthly_kpis.find_one(
            {"club_id": cid, "month": current_month}, {"_id": 0}
        )

        # Get club settings for budget
        settings = await db.club_settings.find_one(
            {"club_id": cid}, {"_id": 0}
        )

        ad_spend = kpi.get("ad_spend", 0) if kpi else 0
        ad_budget = settings.get("monthly_ad_budget", 0) if settings else 0

        budgets.append({
            "club_id": cid,
            "club_name": club["name"],
            "ad_spend": ad_spend,
            "ad_budget": ad_budget,
            "budget_remaining": ad_budget - ad_spend if ad_budget > 0 else 0,
            "budget_usage_pct": round((ad_spend / ad_budget) * 100, 1) if ad_budget > 0 else 0,
        })

        total_spend += ad_spend
        total_budget += ad_budget

    return {
        "month": current_month,
        "total_spend": total_spend,
        "total_budget": total_budget,
        "clubs": budgets,
    }
