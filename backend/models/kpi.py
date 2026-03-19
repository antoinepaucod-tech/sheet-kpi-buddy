"""KPI and financial models"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class MonthlyKPI(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    month: str  # format: "YYYY-MM"
    year: Optional[int] = None
    month_name: Optional[str] = ""
    
    # Revenue - Base
    total_revenue: float = 0
    revenue_members: float = 0
    revenue_coaching: float = 0
    
    # Revenue - Detailed
    general_eft_revenue: float = 0
    pt_revenue: float = 0
    retail_revenue: float = 0
    coaching_virtuel_revenue: float = 0
    fast_cash_revenue: float = 0
    
    # Members - Base
    total_members: int = 0
    new_members: int = 0
    lost_members: int = 0
    
    # Members - Detailed
    pif_members: int = 0
    pif_exits: int = 0
    pif_churn: float = 0
    pauses: int = 0
    recurring_general_members: int = 0
    general_exits: int = 0
    general_churn: float = 0
    pt_members: int = 0
    pt_exits: int = 0
    pt_churn: float = 0
    total_active_members: int = 0
    
    # Funnel - Sales
    leads: int = 0
    calls_made: int = 0
    call_percentage: float = 0
    scheduled: int = 0
    sched_percentage: float = 0
    show: int = 0
    show_percentage: float = 0
    close: int = 0
    close_percentage: float = 0
    cash_collected: float = 0
    avg_per_sale: float = 0
    
    # Organic
    organic_leads: int = 0
    organic_close: int = 0
    organic_close_percentage: float = 0
    organic_cash_collected: float = 0
    
    # Trials
    in_trial: int = 0
    trial_ending: int = 0
    converted: int = 0
    conversion_percentage: float = 0
    
    # Expenses - Base
    total_expenses: float = 0
    marketing_spend: float = 0
    ad_spend: float = 0
    
    # Expenses - Detailed
    loyer: float = 0
    salaires: float = 0
    salaires_coach: float = 0
    salaires_coachs: float = 0
    utilities: float = 0
    other_expenses: float = 0
    other_expenses_misc: float = 0
    
    # Expenses - Extended
    rent: float = 0
    repairs_maintenance: float = 0
    computer_software: float = 0
    internet_telephone: float = 0
    subscriptions: float = 0
    bank_finance_charges: float = 0
    insurance: float = 0
    food_expenses: float = 0
    credit_repayment: float = 0
    
    # Metrics - Base
    churn_rate: float = 0
    cac: float = 0
    roas: float = 0
    net_profit: float = 0
    profit_margin: float = 0
    
    # Metrics - Advanced
    profit: float = 0
    profit_percentage: float = 0
    general_acrm: float = 0
    general_ltv: float = 0
    pt_acrm: float = 0
    pt_ltv: float = 0
    cpl: float = 0
    cpr: float = 0
    ro_ads: float = 0
    gym_floor_sqft: float = 0
    total_classes: int = 0
    
    # Notes & timestamps
    note: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MonthlyKPICreate(BaseModel):
    month: str
    revenue_members: float = 0
    revenue_coaching: float = 0
    total_revenue: float = 0
    total_expenses: float = 0
    net_profit: float = 0
    new_members: int = 0
    lost_members: int = 0
    total_members: int = 0
    marketing_spend: float = 0
    ad_spend: float = 0
    loyer: float = 0
    salaires: float = 0
    utilities: float = 0
    other_expenses: float = 0
    note: Optional[str] = ""


class ClubSettings(BaseModel):
    club_name: str = "Mon Club"
    targets: dict = Field(default_factory=lambda: {
        "churn_rate": 3.0,
        "cac": 150.0,
        "roas": 20.0,
        "new_members": 30,
        "profit_margin": 30.0,
        "revenue_growth": 5.0,
    })
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def compute_metrics(kpi: dict) -> dict:
    """Compute derived metrics for a KPI record"""
    members_start = kpi.get('total_members', 0) + kpi.get('lost_members', 0)
    churn_rate = round((kpi.get('lost_members', 0) / members_start * 100) if members_start > 0 else 0, 2)
    new_m = kpi.get('new_members', 0)
    total_marketing = kpi.get('marketing_spend', 0) + kpi.get('marketing_cost', 0)
    cac = round((total_marketing / new_m) if new_m > 0 else 0, 2)
    ad = kpi.get('ad_spend', 0)
    roas = round((kpi.get('total_revenue', 0) / ad) if ad > 0 else 0, 2)
    rev = kpi.get('total_revenue', 0)
    profit_margin = round((kpi.get('net_profit', 0) / rev * 100) if rev > 0 else 0, 2)

    # Recalculate funnel percentages from raw counts
    leads = kpi.get('leads', 0) or 0
    calls = kpi.get('calls_made', 0) or 0
    scheduled = kpi.get('scheduled', 0) or 0
    show = kpi.get('show', 0) or 0
    close = kpi.get('close', 0) or 0
    call_percentage = round((calls / leads * 100), 1) if leads > 0 else 0
    sched_percentage = round((scheduled / calls * 100), 1) if calls > 0 else 0
    show_percentage = round((show / scheduled * 100), 1) if scheduled > 0 else 0
    close_percentage = round((close / show * 100), 1) if show > 0 else 0

    # Recalculate avg_per_sale from cash_collected and close
    cash_collected = kpi.get('cash_collected', 0) or 0
    avg_per_sale = round((cash_collected / close), 2) if close > 0 else 0

    return {
        **kpi,
        'churn_rate': churn_rate,
        'cac': cac,
        'roas': roas,
        'profit_margin': profit_margin,
        'call_percentage': call_percentage,
        'sched_percentage': sched_percentage,
        'show_percentage': show_percentage,
        'close_percentage': close_percentage,
        'avg_per_sale': avg_per_sale,
    }
