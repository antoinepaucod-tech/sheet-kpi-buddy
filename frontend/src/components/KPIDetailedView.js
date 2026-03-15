import { useState, useEffect } from "react";
import { formatCHF, formatNum, formatPct } from "../utils/format";
import { useTranslations } from "../hooks/useTranslations";
import axios from "axios";
import {
  Users, DollarSign, TrendingUp, TrendingDown, Target, Phone, Calendar,
  UserPlus, UserMinus, Percent, BarChart3, Wallet, CreditCard,
  RefreshCw, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatBox = ({ label, value, icon: Icon, color = "text-white", subValue }) => (
  <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-3 rounded-[var(--radius-lg)] overflow-hidden">
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon size={12} className="text-[var(--color-text-tertiary)]" />}
      <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider truncate">{label}</span>
    </div>
    <p className={`text-base font-display font-bold ${color} truncate`} style={{ fontFeatureSettings: '"tnum" 1' }}>{value}</p>
    {subValue && <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 truncate">{subValue}</p>}
  </div>
);

const SectionTitle = ({ children }) => (
  <div className="flex items-center gap-2 mb-3 mt-5">
    <div className="w-1 h-4 bg-[var(--color-accent)] rounded-full" />
    <h3 className="text-xs font-display font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{children}</h3>
  </div>
);

const CategoryBreakdown = ({ items, type, lang }) => {
  const [expanded, setExpanded] = useState(null);
  if (!items || items.length === 0) {
    return (
      <p className="text-[var(--color-text-tertiary)] text-sm py-3 text-center italic">
        {lang === "fr" ? "Aucune transaction ce mois" : "No transactions this month"}
      </p>
    );
  }
  const isRevenue = type === "revenue";
  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.category} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === item.category ? null : item.category)}
            className="w-full flex items-center justify-between p-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
            data-testid={`breakdown-${item.category}`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRevenue ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
              <span className="text-sm text-white font-display font-bold">{item.category}</span>
              <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">({item.count} tx)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-sm font-bold ${isRevenue ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                {isRevenue ? '+' : '-'}{formatCHF(item.total)}
              </span>
              {expanded === item.category ? <ChevronUp size={14} className="text-[var(--color-text-tertiary)]" /> : <ChevronDown size={14} className="text-[var(--color-text-tertiary)]" />}
            </div>
          </button>
          {expanded === item.category && (
            <div className="border-t border-[var(--color-border)] px-3 py-2 space-y-1">
              {item.transactions.map((tx, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-text-tertiary)] font-mono">{tx.date}</span>
                    <span className="text-[var(--color-text-secondary)]">{tx.description}</span>
                  </div>
                  <span className={`font-mono font-bold ${isRevenue ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {formatCHF(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const RecurringSection = ({ items, type, lang }) => {
  if (!items || items.length === 0) {
    return (
      <p className="text-[var(--color-text-tertiary)] text-sm py-2 text-center italic">
        {lang === "fr" ? "Aucune recurrence active" : "No active recurring"}
      </p>
    );
  }
  const isRevenue = type === "revenue";
  return (
    <div className="space-y-1">
      {items.map((r) => (
        <div key={r.id} className="flex items-center justify-between p-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <div className="flex items-center gap-2">
            <RefreshCw size={12} className="text-[var(--color-text-tertiary)]" />
            <span className="text-sm text-white">{r.description}</span>
            <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">{r.category}</span>
            <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">J{r.recurrence_day || 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-sm font-bold ${isRevenue ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {isRevenue ? '+' : '-'}{formatCHF(r.amount)}
            </span>
            {r.generated_this_month ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(48,209,88,0.15)] text-[var(--color-success)] font-mono uppercase">
                {lang === "fr" ? "generee" : "generated"}
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(255,69,58,0.15)] text-[var(--color-danger)] font-mono uppercase">
                {lang === "fr" ? "en attente" : "pending"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export function KPIDetailedView({ kpi, lang }) {
  const { t } = useTranslations();
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!kpi?.month) return;
    let cancelled = false;
    setLoadingDetails(true);
    axios.get(`${API}/monthly-kpis/${kpi.month}/details`)
      .then(res => { if (!cancelled) setDetails(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [kpi?.month]);

  if (!kpi) return null;

  const totalRecurringRevenue = details?.recurring_revenue?.reduce((s, r) => s + r.amount, 0) || 0;
  const totalRecurringExpense = details?.recurring_expense?.reduce((s, r) => s + r.amount, 0) || 0;

  return (
    <div className="space-y-4" data-testid="kpi-detailed-view">

      {/* Revenue & Expenses from Transactions */}
      {loadingDetails ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[var(--color-accent)]" />
        </div>
      ) : details ? (
        <>
          {/* Revenue Transactions Breakdown */}
          <SectionTitle>{lang === "fr" ? "Revenus - Transactions du mois" : "Revenue - Monthly Transactions"}</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            <StatBox
              label={lang === "fr" ? "Total Revenus (Transactions)" : "Total Revenue (Transactions)"}
              value={formatCHF(details.total_revenue_from_transactions)}
              icon={TrendingUp}
              color="text-[var(--color-success)]"
              subValue={`${details.revenue_breakdown?.length || 0} ${lang === "fr" ? "categories" : "categories"}`}
            />
            <StatBox
              label="Fast Cash Revenue"
              value={formatCHF(kpi.fast_cash_revenue)}
              icon={Wallet}
              color="text-[var(--color-warning)]"
              subValue={lang === "fr" ? "Valeur importee/manuelle" : "Imported/manual value"}
            />
            <StatBox
              label={lang === "fr" ? "Total Revenus KPI" : "Total Revenue KPI"}
              value={formatCHF(kpi.total_revenue)}
              icon={DollarSign}
              color="text-[var(--color-accent)]"
            />
          </div>
          <CategoryBreakdown items={details.revenue_breakdown} type="revenue" lang={lang} />

          {/* Expenses Transactions Breakdown */}
          <SectionTitle>{lang === "fr" ? "Depenses - Transactions du mois" : "Expenses - Monthly Transactions"}</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            <StatBox
              label={lang === "fr" ? "Total Depenses (Transactions)" : "Total Expenses (Transactions)"}
              value={formatCHF(details.total_expenses_from_transactions)}
              icon={TrendingDown}
              color="text-[var(--color-danger)]"
              subValue={`${details.expense_breakdown?.length || 0} ${lang === "fr" ? "categories" : "categories"}`}
            />
            <StatBox
              label={lang === "fr" ? "Total Depenses KPI" : "Total Expenses KPI"}
              value={formatCHF(kpi.total_expenses)}
              icon={DollarSign}
              color="text-[var(--color-danger)]"
            />
            <StatBox
              label={lang === "fr" ? "Profit Net" : "Net Profit"}
              value={formatCHF(kpi.net_profit)}
              icon={DollarSign}
              color={kpi.net_profit >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}
            />
          </div>
          <CategoryBreakdown items={details.expense_breakdown} type="expense" lang={lang} />

          {/* Recurring Transactions */}
          <SectionTitle>{lang === "fr" ? "Transactions Recurrentes" : "Recurring Transactions"}</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <StatBox
              label={lang === "fr" ? "Recurrences Actives" : "Active Recurring"}
              value={(details.recurring_revenue?.length || 0) + (details.recurring_expense?.length || 0)}
              icon={RefreshCw}
              color="text-[var(--color-accent)]"
            />
            <StatBox
              label={lang === "fr" ? "Revenus Recurrents" : "Recurring Revenue"}
              value={formatCHF(totalRecurringRevenue)}
              icon={TrendingUp}
              color="text-[var(--color-success)]"
              subValue={`${details.recurring_revenue?.length || 0} ${lang === "fr" ? "modeles" : "templates"}`}
            />
            <StatBox
              label={lang === "fr" ? "Depenses Recurrentes" : "Recurring Expenses"}
              value={formatCHF(totalRecurringExpense)}
              icon={TrendingDown}
              color="text-[var(--color-danger)]"
              subValue={`${details.recurring_expense?.length || 0} ${lang === "fr" ? "modeles" : "templates"}`}
            />
            <StatBox
              label={lang === "fr" ? "Impact Net Recurrent" : "Net Recurring Impact"}
              value={formatCHF(totalRecurringRevenue - totalRecurringExpense)}
              icon={DollarSign}
              color={(totalRecurringRevenue - totalRecurringExpense) >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}
            />
          </div>
          {(details.recurring_revenue?.length > 0 || details.recurring_expense?.length > 0) && (
            <div className="space-y-3">
              {details.recurring_revenue?.length > 0 && (
                <div>
                  <p className="text-[10px] text-[var(--color-success)] uppercase tracking-wider font-bold mb-1.5">
                    {lang === "fr" ? "Revenus recurrents" : "Recurring revenue"}
                  </p>
                  <RecurringSection items={details.recurring_revenue} type="revenue" lang={lang} />
                </div>
              )}
              {details.recurring_expense?.length > 0 && (
                <div>
                  <p className="text-[10px] text-[var(--color-danger)] uppercase tracking-wider font-bold mb-1.5">
                    {lang === "fr" ? "Depenses recurrentes" : "Recurring expenses"}
                  </p>
                  <RecurringSection items={details.recurring_expense} type="expense" lang={lang} />
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* Sales Funnel Section */}
      <SectionTitle>{lang === "fr" ? "Entonnoir de Vente" : "Sales Funnel"}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatBox label="Leads" value={formatNum(kpi.leads)} icon={UserPlus} color="text-[var(--color-accent)]" />
        <StatBox label={lang === "fr" ? "Appels" : "Calls"} value={formatNum(kpi.calls_made)} icon={Phone} subValue={kpi.call_percentage > 0 ? `${kpi.call_percentage.toFixed(1)}%` : null} />
        <StatBox label={lang === "fr" ? "Planifies" : "Scheduled"} value={formatNum(kpi.scheduled)} icon={Calendar} subValue={kpi.sched_percentage > 0 ? `${kpi.sched_percentage.toFixed(1)}%` : null} />
        <StatBox label="Show" value={formatNum(kpi.show)} icon={Users} subValue={kpi.show_percentage > 0 ? `${kpi.show_percentage.toFixed(1)}%` : null} />
        <StatBox label="Close" value={formatNum(kpi.close)} icon={Target} color="text-[var(--color-success)]" subValue={kpi.close_percentage > 0 ? `${kpi.close_percentage.toFixed(1)}%` : null} />
        <StatBox label={lang === "fr" ? "Cash Collecte" : "Cash Collected"} value={formatCHF(kpi.cash_collected)} icon={Wallet} color="text-[var(--color-success)]" subValue={kpi.avg_per_sale > 0 ? `Moy: ${formatCHF(kpi.avg_per_sale)}` : null} />
      </div>

      {/* Organic & Trials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionTitle>{lang === "fr" ? "Leads Organiques" : "Organic Leads"}</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Leads" value={formatNum(kpi.organic_leads)} icon={UserPlus} color="text-[var(--color-success)]" />
            <StatBox label="Close" value={formatNum(kpi.organic_close)} icon={Target} subValue={kpi.organic_close_percentage > 0 ? `${kpi.organic_close_percentage.toFixed(1)}%` : null} />
            <StatBox label="Cash" value={formatCHF(kpi.organic_cash_collected)} icon={Wallet} color="text-[var(--color-success)]" />
          </div>
        </div>
        <div>
          <SectionTitle>{lang === "fr" ? "Essais / Conversions" : "Trials / Conversions"}</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            <StatBox label={lang === "fr" ? "En Essai" : "In Trial"} value={formatNum(kpi.in_trial)} icon={Users} color="text-[var(--color-warning)]" />
            <StatBox label={lang === "fr" ? "Fin Essai" : "Ending"} value={formatNum(kpi.trial_ending)} icon={Calendar} />
            <StatBox label={lang === "fr" ? "Convertis" : "Converted"} value={formatNum(kpi.converted)} icon={Target} color="text-[var(--color-success)]" />
            <StatBox label={lang === "fr" ? "Taux Conv." : "Conv. Rate"} value={`${(kpi.conversion_percentage || 0).toFixed(1)}%`} icon={Percent} color={kpi.conversion_percentage > 50 ? "text-[var(--color-success)]" : "text-[var(--color-warning)]"} />
          </div>
        </div>
      </div>

      {/* Members Detailed */}
      <SectionTitle>{lang === "fr" ? "Detail des Membres" : "Members Breakdown"}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <StatBox label={lang === "fr" ? "Membres Actifs" : "Active Members"} value={formatNum(kpi.active_members || kpi.total_active_members || kpi.total_members)} icon={Users} color="text-[var(--color-accent)]" />
        <StatBox label="PIF Members" value={formatNum(kpi.pif_members)} icon={Users} subValue={kpi.pif_exits > 0 ? `Exits: ${kpi.pif_exits}` : null} />
        <StatBox label={lang === "fr" ? "Recurrents" : "Recurring"} value={formatNum(kpi.recurring_general_members)} icon={Users} subValue={kpi.general_exits > 0 ? `Exits: ${kpi.general_exits}` : null} />
        <StatBox label={lang === "fr" ? "General Churn" : "General Churn"} value={`${(kpi.general_churn || 0).toFixed(2)}%`} icon={TrendingDown} color={kpi.general_churn < 5 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"} />
        <StatBox label="Pauses" value={formatNum(kpi.pauses)} icon={UserMinus} color="text-[var(--color-warning)]" />
      </div>

      {/* Advanced Metrics */}
      <SectionTitle>{lang === "fr" ? "Metriques Avancees" : "Advanced Metrics"}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatBox label={lang === "fr" ? "ACRM General" : "General ACRM"} value={formatCHF(kpi.general_acrm)} icon={DollarSign} color="text-[var(--color-info)]" />
        <StatBox label={lang === "fr" ? "LTV General" : "General LTV"} value={formatCHF(kpi.general_ltv)} icon={TrendingUp} color="text-[var(--color-info)]" />
        <StatBox label="PT ACRM" value={formatCHF(kpi.pt_acrm)} icon={DollarSign} color="text-[var(--color-info)]" />
        <StatBox label="PT LTV" value={formatCHF(kpi.pt_ltv)} icon={TrendingUp} color="text-[var(--color-info)]" />
        <StatBox label="CPL" value={formatCHF(kpi.cpl)} icon={Target} subValue="Cost Per Lead" />
        <StatBox label="CPR" value={formatCHF(kpi.cpr)} icon={Target} subValue="Cost Per Result" />
      </div>
    </div>
  );
}
