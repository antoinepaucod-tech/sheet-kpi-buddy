import { useMemo, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { KPICard } from "../components/KPICard";
import { EditKPIModal } from "../components/EditKPIModal";
import { KPIDetailedView } from "../components/KPIDetailedView";
import { GHLFunnelSection } from "../components/GHLFunnelSection";
import {
  TrendingUp, Users, Percent, DollarSign, Target, Zap, Loader2, RotateCcw, Pencil,
  ChevronLeft, ChevronRight, FileDown, UserCheck, UserX, AlertTriangle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useTranslations } from "../hooks/useTranslations";
import { useMonthlyKPIData } from "../hooks/useMonthlyKPIData";
import { useSettings } from "../hooks/useSettings";
import { Toaster } from "../components/ui/toaster";
import { useToast } from "../hooks/use-toast";
import { formatCHF, formatPct, formatMonthLabel, formatNum, getTrend, formatMonthFull } from "../utils/format";
import axios from "axios";
import { useState } from "react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_COLORS = {
  revenue: "#0A84FF",
  members: "#30D158",
  coaching: "#30D158",
  expenses: "#FF453A",
  profit: "#30D158",
  churn: "#FF453A",
  cac: "#64D2FF",
  roas: "#FFD60A",
  loyer: "#0A84FF",
  salaires: "#64D2FF",
  utilities: "#FFD60A",
  marketing: "#FF453A",
  other: "#3A3A3C",
};

const ChartTooltip = ({ active, payload, label, isCurrency = true }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontFamily: 'var(--font-display)', fontFeatureSettings: '"tnum" 1' }} className="text-xs shadow-xl">
      <p className="tf-label mb-2">{label}</p>
      {payload.map((item, i) => (
        <div key={i} className="flex justify-between gap-6" style={{ color: item.color }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>{item.name}</span>
          <span style={{ fontWeight: 'var(--font-bold)' }}>
            {isCurrency ? formatCHF(item.value) : item.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ChartCard = ({ title, children }) => (
  <div className="tf-card">
    <p className="tf-label" style={{ marginBottom: 'var(--space-4)' }}>{title}</p>
    {children}
  </div>
);

export default function Dashboard({ selectedMonth, setSelectedMonth }) {
  const { t, lang } = useTranslations();
  const { kpis, loading, refetch, getKpiByMonth, getPreviousKpi } = useMonthlyKPIData();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);
  const [editKpiOpen, setEditKpiOpen] = useState(false);
  const [showN1, setShowN1] = useState(false);
  const [memberStats, setMemberStats] = useState(null);
  const [expiringMembers, setExpiringMembers] = useState([]);

  // Fetch real-time member stats + expiring members
  useEffect(() => {
    axios.get(`${API}/members/stats`).then(r => setMemberStats(r.data)).catch(() => {});
    axios.get(`${API}/members/expiring?days=60`).then(r => setExpiringMembers(r.data)).catch(() => {});
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/seed`);
      await refetch();
      toast({ title: lang === "fr" ? "Données rechargées" : "Data reloaded" });
    } finally {
      setSeeding(false);
    }
  };

  // Month navigation
  const navigateMonth = (direction) => {
    if (!kpis.length || !selectedMonth) return;
    const idx = kpis.findIndex((k) => k.month === selectedMonth);
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < kpis.length) {
      setSelectedMonth(kpis[newIdx].month);
    }
  };
  const canGoBack = kpis.findIndex((k) => k.month === selectedMonth) > 0;
  const canGoForward = kpis.findIndex((k) => k.month === selectedMonth) < kpis.length - 1;

  // Annual summary
  const annualData = useMemo(() => {
    const year = selectedMonth?.split("-")[0];
    const yearKpis = kpis.filter((k) => k.month.startsWith(year || "2024"));
    if (!yearKpis.length) return null;
    return {
      totalRevenue: yearKpis.reduce((s, k) => s + k.total_revenue, 0),
      totalExpenses: yearKpis.reduce((s, k) => s + k.total_expenses, 0),
      totalProfit: yearKpis.reduce((s, k) => s + k.net_profit, 0),
      totalNewMembers: yearKpis.reduce((s, k) => s + k.new_members, 0),
      avgChurn: yearKpis.reduce((s, k) => s + k.churn_rate, 0) / yearKpis.length,
      avgRoas: yearKpis.reduce((s, k) => s + k.roas, 0) / yearKpis.length,
      bestMonth: yearKpis.reduce((best, k) => k.total_revenue > best.total_revenue ? k : best),
      worstMonth: yearKpis.reduce((worst, k) => k.total_revenue < worst.total_revenue ? k : worst),
      months: yearKpis.length,
    };
  }, [kpis, selectedMonth]);

  const currentYear = selectedMonth?.split("-")[0] || "2024";
  const current = getKpiByMonth(selectedMonth);
  const previous = getPreviousKpi(selectedMonth);

  /* Chart click → select month */
  const handleChartClick = (data) => {
    if (data?.activeLabel && setSelectedMonth) {
      const found = kpis.find((k) => formatMonthLabel(k.month, lang) === data.activeLabel);
      if (found) setSelectedMonth(found.month);
    }
  };

  // N-1 comparison data
  const n1Year = String(parseInt(currentYear) - 1);
  const n1Kpis = useMemo(() => kpis.filter((k) => k.month.startsWith(n1Year)), [kpis, n1Year]);

  // Combined chart data: current year + N-1 for comparison
  const chartData = useMemo(
    () =>
      kpis.map((k) => ({
        label: formatMonthLabel(k.month, lang),
        month: k.month,
        revenue: k.total_revenue,
        expenses: k.total_expenses,
        profit: k.net_profit,
        members: k.active_members || k.total_active_members || k.total_members,
        newMembers: k.new_members,
        lostMembers: k.lost_members,
        churn: k.churn_rate,
        cac: k.cac,
        roas: k.roas,
        profitMargin: Math.max(-200, Math.min(200, k.profit_margin)),
        revMembers: k.revenue_members || k.general_eft_revenue,
        revCoaching: k.revenue_coaching || k.pt_revenue,
        loyer: k.loyer || k.rent,
        salaires: k.salaires || k.salaries,
        utilities: k.utilities,
        marketing: (k.marketing_spend || 0) + (k.ad_spend || 0),
        other: k.other_expenses || k.other_expenses_misc,
      })),
    [kpis, lang]
  );

  // Current year data for all non-revenue charts
  const currentYearData = useMemo(
    () => chartData.filter((d) => d.month.startsWith(currentYear)),
    [chartData, currentYear]
  );
  const chartDataWithN1 = useMemo(() => {
    if (!showN1 || !n1Kpis.length) return chartData.filter((d) => d.month.startsWith(currentYear));
    return chartData
      .filter((d) => d.month.startsWith(currentYear))
      .map((d, idx) => ({
        ...d,
        revenue_n1: n1Kpis[idx]?.total_revenue,
        expenses_n1: n1Kpis[idx]?.total_expenses,
        members_n1: n1Kpis[idx]?.total_members,
      }));
  }, [chartData, n1Kpis, showN1, currentYear]);

  const selectedLabel = current
    ? formatMonthLabel(current.month, lang)
    : null;

  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        {/* Skeleton header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="tf-skeleton" style={{ width: '180px', height: '28px', marginBottom: '8px' }} />
            <div className="tf-skeleton" style={{ width: '120px', height: '14px' }} />
          </div>
        </div>
        {/* Skeleton KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="tf-stat">
              <div className="tf-skeleton tf-skeleton-text" style={{ width: '60%' }} />
              <div className="tf-skeleton tf-skeleton-value" />
            </div>
          ))}
        </div>
        {/* Skeleton chart */}
        <div className="tf-card">
          <div className="tf-skeleton tf-skeleton-text" style={{ width: '30%' }} />
          <div className="tf-skeleton" style={{ height: '200px', marginTop: '16px' }} />
        </div>
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4" data-testid="dashboard-empty">
        <p style={{ color: 'var(--color-text-secondary)' }}>{t("noData")}</p>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="tf-btn-primary flex items-center gap-2"
          data-testid="seed-btn"
        >
          {seeding ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RotateCcw size={14} />
          )}
          {seeding ? t("seeding") : t("seedData")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-content">
      <Toaster />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header">
            {settings?.club_name || t("dashboard")}
          </h1>
          {selectedLabel && (
            <p className="tf-page-subtitle">{selectedLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Month navigation */}
          <button
            onClick={() => navigateMonth(-1)}
            disabled={!canGoBack}
            style={{ color: 'var(--color-text-tertiary)', transition: 'var(--transition-fast)' }}
            className="p-1.5 disabled:opacity-20"
            data-testid="prev-month-btn"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => navigateMonth(1)}
            disabled={!canGoForward}
            style={{ color: 'var(--color-text-tertiary)', transition: 'var(--transition-fast)' }}
            className="p-1.5 disabled:opacity-20"
            data-testid="next-month-btn"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setEditKpiOpen(true)}
            className="tf-btn-secondary flex items-center gap-1.5"
            style={{ padding: '6px 12px', fontSize: 'var(--text-xs)' }}
            data-testid="edit-kpi-btn"
            title={lang === "fr" ? "Modifier les KPIs" : "Edit KPIs"}
          >
            <Pencil size={12} />
            {lang === "fr" ? "Modifier" : "Edit"}
          </button>
          <button
            onClick={() => {
              if (selectedMonth) {
                window.open(`${API}/report/pdf/${selectedMonth}`, '_blank');
              }
            }}
            disabled={!selectedMonth}
            className="tf-btn-secondary flex items-center gap-1.5"
            style={{ padding: '6px 12px', fontSize: 'var(--text-xs)' }}
            data-testid="export-pdf-btn"
            title={lang === "fr" ? "Telecharger le rapport PDF" : "Download PDF report"}
          >
            <FileDown size={12} />
            PDF
          </button>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="tf-btn-secondary flex items-center gap-1.5"
            style={{ padding: '6px 12px', fontSize: 'var(--text-xs)' }}
            data-testid="reseed-btn"
          >
            {seeding ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RotateCcw size={12} />
            )}
            {t("seedData")}
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 tf-stagger" data-testid="kpi-grid">
        <KPICard
          label={t("totalRevenue")}
          value={formatCHF(current?.total_revenue)}
          trend={getTrend(current?.total_revenue, previous?.total_revenue)}
          vsLabel={t("vsLastMonth")}
          icon={TrendingUp}
          accent
          data-testid="kpi-revenue"
        />
        <KPICard
          label={t("netProfit")}
          value={formatCHF(current?.net_profit)}
          trend={getTrend(current?.net_profit, previous?.net_profit)}
          vsLabel={t("vsLastMonth")}
          icon={DollarSign}
          data-testid="kpi-profit"
        />
        <KPICard
          label={lang === "fr" ? "Membres actifs" : "Active Members"}
          value={formatNum(memberStats?.active_members ?? current?.active_members ?? 0)}
          trend={null}
          vsLabel={memberStats ? `${memberStats.departed} partis` : ""}
          icon={UserCheck}
          data-testid="kpi-members"
        />
        <KPICard
          label={lang === "fr" ? "Coachs actifs" : "Active Coaches"}
          value={formatNum(memberStats?.active_coaches ?? 0)}
          trend={null}
          vsLabel={memberStats ? `${memberStats.expired_coaches + memberStats.expired_members} expirés` : ""}
          icon={Users}
          data-testid="kpi-coaches"
        />
        <KPICard
          label={t("cac")}
          value={formatCHF(current?.cac)}
          trend={
            current?.cac && previous?.cac
              ? { pct: Math.abs(((current.cac - previous.cac) / previous.cac) * 100).toFixed(1), up: current.cac < previous.cac }
              : null
          }
          vsLabel={t("vsLastMonth")}
          icon={Target}
          data-testid="kpi-cac"
        />
        <KPICard
          label={t("roas")}
          value={`${(current?.roas ?? 0).toFixed(1)}x`}
          trend={getTrend(current?.roas, previous?.roas)}
          vsLabel={t("vsLastMonth")}
          icon={Zap}
          data-testid="kpi-roas"
        />
      </div>

      {/* Alert Zone - Expiring subscriptions */}
      {expiringMembers.length > 0 && (
        <div className="tf-card" style={{ borderLeft: '3px solid var(--color-warning)', background: 'rgba(255,214,10,0.04)' }} data-testid="alert-zone">
          <div className="flex items-center justify-between mb-3">
            <p className="tf-label flex items-center gap-2" style={{ color: 'var(--color-warning)' }}>
              <AlertTriangle size={16} />
              Abonnements expirant bientôt ({expiringMembers.length})
            </p>
            <a href="/members" className="text-xs text-[var(--color-accent)] hover:underline" data-testid="alert-view-all">
              Voir tous les membres
            </a>
          </div>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {expiringMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg"
                style={{ background: 'var(--color-bg-secondary)' }}
                data-testid={`alert-member-${m.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <a
                      href={`/members`}
                      className="text-white text-sm font-medium hover:text-[var(--color-accent)] truncate block"
                    >
                      {m.name}
                    </a>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      {m.membership}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: m.days_remaining <= 7
                        ? 'rgba(255,69,58,0.15)'
                        : m.days_remaining <= 30
                          ? 'rgba(255,214,10,0.15)'
                          : 'rgba(48,209,88,0.15)',
                      color: m.days_remaining <= 7
                        ? 'var(--color-error)'
                        : m.days_remaining <= 30
                          ? 'var(--color-warning)'
                          : 'var(--color-success)',
                    }}
                    data-testid={`alert-days-${m.id}`}
                  >
                    {m.days_remaining === 0
                      ? "Expire aujourd'hui"
                      : m.days_remaining === 1
                        ? "1 jour restant"
                        : `${m.days_remaining}j restants`}
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    Fin: {m.subscription_end_date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI vs Targets */}
      {settings?.targets && current && (
        <div className="tf-card">
          <p className="tf-label" style={{ marginBottom: 'var(--space-4)' }}>
            {lang === "fr" ? "Objectifs du mois" : "Monthly targets"}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 tf-stagger">
            {[
              {
                label: t("churnRate"),
                actual: current.churn_rate,
                target: settings.targets.churn_rate,
                format: (v) => `${v?.toFixed(1)}%`,
                lower_is_better: true,
              },
              {
                label: t("cac"),
                actual: current.cac,
                target: settings.targets.cac,
                format: formatCHF,
                lower_is_better: true,
              },
              {
                label: t("roas"),
                actual: current.roas,
                target: settings.targets.roas,
                format: (v) => `${v?.toFixed(1)}x`,
                lower_is_better: false,
              },
              {
                label: t("newMembers"),
                actual: current.new_members,
                target: settings.targets.new_members,
                format: (v) => `${v}`,
                lower_is_better: false,
              },
              {
                label: t("profitMargin"),
                actual: current.profit_margin,
                target: settings.targets.profit_margin,
                format: (v) => `${v?.toFixed(1)}%`,
                lower_is_better: false,
              },
              {
                label: t("totalRevenue"),
                actual: current.total_revenue,
                target: current.total_revenue * (1 + (settings.targets.revenue_growth || 5) / 100),
                format: formatCHF,
                lower_is_better: false,
              },
            ].map(({ label, actual, target, format, lower_is_better }) => {
              const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
              const good = lower_is_better ? actual <= target : actual >= target;
              return (
                <div key={label} className="space-y-1.5 overflow-hidden">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="tf-label truncate">{label}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', fontFeatureSettings: '"tnum" 1', whiteSpace: 'nowrap', color: good ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {format(actual)}
                    </span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--color-bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: good ? 'var(--color-success)' : 'var(--color-warning)',
                        transition: 'width 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)',
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xs)', fontFeatureSettings: '"tnum" 1', color: 'var(--color-text-tertiary)' }}>
                    {lang === "fr" ? "Obj." : "Target"}: {format(target)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="tf-tabs-list" style={{ border: '1px solid var(--color-border)' }}>
          {["revenue", "details", "funnel", "members", "metrics", "annual"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              data-testid={`tab-${tab}`}
              className="tf-tabs-trigger"
            >
              {tab === "annual" 
                ? (lang === "fr" ? "Annuel" : "Annual") 
                : tab === "details" 
                ? (lang === "fr" ? "Details" : "Details")
                : t(tab)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4" data-testid="tab-revenue-content">
          {/* N-1 Toggle */}
          <div className="flex items-center justify-between">
            <p className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {showN1 && n1Kpis.length > 0 ? `comparaison ${n1Year}` : ""}
            </p>
            {n1Kpis.length > 0 && (
              <button
                onClick={() => setShowN1(!showN1)}
                className="font-mono"
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: showN1 ? '1px solid rgba(10,132,255,0.5)' : '1px solid var(--color-border)',
                  color: showN1 ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                  background: showN1 ? 'var(--color-accent-subtle)' : 'transparent',
                  transition: 'var(--transition-fast)',
                }}
                data-testid="n1-toggle-btn"
              >
                {showN1 ? "N-1 " : "N-1 "} ({n1Year})
              </button>
            )}
          </div>

          {/* Monthly note */}
          {current?.note && (
            <div className="bg-[rgba(255,214,10,0.05)] border border-[rgba(255,214,10,0.15)] rounded-[var(--radius-lg)] px-4 py-2.5 flex items-start gap-2">
              <span className="text-[var(--color-warning)] opacity-60 text-xs mt-0.5">📝</span>
              <p className="text-[var(--color-warning)] text-sm font-text">{current.note}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t("revenueEvolution")}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartDataWithN1} onClick={handleChartClick} style={{ cursor: "pointer" }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.expenses} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={CHART_COLORS.expenses} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.revenue} strokeDasharray="4 4" strokeWidth={1.5} />}
                  <Area type="monotone" dataKey="revenue" name={t("totalRevenue")} stroke={CHART_COLORS.revenue} fill="url(#revGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="expenses" name={t("expenses")} stroke={CHART_COLORS.expenses} fill="url(#expGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  {showN1 && <Line type="monotone" dataKey="revenue_n1" name={`CA ${n1Year}`} stroke={CHART_COLORS.revenue} strokeWidth={1.5} strokeDasharray="5 3" dot={false} opacity={0.5} />}
                  {showN1 && <Line type="monotone" dataKey="expenses_n1" name={`Dép. ${n1Year}`} stroke={CHART_COLORS.expenses} strokeWidth={1.5} strokeDasharray="5 3" dot={false} opacity={0.5} />}
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("memberVsCoaching")}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={currentYearData} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.revenue} strokeDasharray="4 4" />}
                  <Bar dataKey="revMembers" name={t("revenueMembers")} fill={CHART_COLORS.members} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="revCoaching" name={t("revenueCoaching")} fill={CHART_COLORS.coaching} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("expensesBreakdown")}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={currentYearData} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                  <Bar dataKey="loyer" name={t("loyer")} stackId="exp" fill={CHART_COLORS.loyer} />
                  <Bar dataKey="salaires" name={t("salaires")} stackId="exp" fill={CHART_COLORS.salaires} />
                  <Bar dataKey="utilities" name={t("utilities")} stackId="exp" fill={CHART_COLORS.utilities} />
                  <Bar dataKey="marketing" name={t("marketing")} stackId="exp" fill={CHART_COLORS.marketing} />
                  <Bar dataKey="other" name={t("other")} stackId="exp" fill={CHART_COLORS.other} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("profitEvolution")}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={currentYearData}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.profit} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.profit} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.profit} strokeDasharray="4 4" />}
                  <Area type="monotone" dataKey="profit" name={t("netProfit")} stroke={CHART_COLORS.profit} fill="url(#profitGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </TabsContent>

        {/* Details Tab - All detailed KPI fields */}
        <TabsContent value="details" className="space-y-4" data-testid="tab-details-content">
          <div className="tf-card">
            <div className="flex items-center justify-between mb-4">
              <p className="tf-label">
                {lang === "fr" ? "Donnees Detaillees du Mois" : "Detailed Monthly Data"}
              </p>
              <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {current?.month ? formatMonthFull(current.month, lang) : ""}
              </span>
            </div>
            <KPIDetailedView kpi={current} lang={lang} />
          </div>
        </TabsContent>

        {/* Funnel Tab */}
        <TabsContent value="funnel" className="space-y-4" data-testid="tab-funnel-content">
          <GHLFunnelSection
            currentMonth={selectedMonth}
            lang={lang}
            onKpiRefresh={refetch}
            onMonthChange={setSelectedMonth}
          />
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4" data-testid="tab-members-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t("membersEvolution")}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={currentYearData}>
                  <defs>
                    <linearGradient id="membGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.members} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.members} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip isCurrency={false} />} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.members} strokeDasharray="4 4" />}
                  <Bar dataKey="lostMembers" name={lang === "fr" ? "Perdus" : "Lost"} fill={CHART_COLORS.expenses} opacity={0.6} barSize={12} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="newMembers" name={lang === "fr" ? "Nouveaux" : "New"} fill={CHART_COLORS.members} opacity={0.8} barSize={12} radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="members" name={t("totalMembers")} stroke={CHART_COLORS.members} fill="url(#membGrad)" strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.members }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("churnEvolution")}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={currentYearData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<ChartTooltip isCurrency={false} />} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.churn} strokeDasharray="4 4" />}
                  <Bar yAxisId="left" dataKey="lostMembers" name={t("lostMembers")} fill={CHART_COLORS.churn} opacity={0.6} barSize={12} radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="churn" name="Churn %" stroke={CHART_COLORS.churn} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4" data-testid="tab-metrics-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t("roasEvolution")}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={currentYearData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}x`} />
                  <Tooltip content={<ChartTooltip isCurrency={false} />} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.roas} strokeDasharray="4 4" />}
                  <Bar yAxisId="left" dataKey="revenue" name={t("totalRevenue")} fill={CHART_COLORS.revenue} opacity={0.4} barSize={12} radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke={CHART_COLORS.roas} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("profitMargin")}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={currentYearData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<ChartTooltip isCurrency={false} />} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.profit} strokeDasharray="4 4" />}
                  <Bar yAxisId="left" dataKey="profit" name={t("netProfit")} fill={CHART_COLORS.profit} opacity={0.5} barSize={12} radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="profitMargin" name={t("profitMargin")} stroke={CHART_COLORS.profit} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Summary metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tf-stagger">
            {[
              { label: t("profitMargin"), value: formatPct(current?.profit_margin) },
              { label: t("roas"), value: `${(current?.roas ?? 0).toFixed(2)}x` },
              { label: t("totalExpenses"), value: formatCHF(current?.total_expenses) },
              { label: t("adSpend"), value: formatCHF(current?.ad_spend) },
            ].map(({ label, value }) => (
              <div key={label} className="tf-stat">
                <p className="tf-stat-label">{label}</p>
                <p className="tf-stat-value">{value}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Annual Summary Tab */}
        <TabsContent value="annual" className="space-y-4" data-testid="tab-annual-content">
          {annualData && (
            <>
              <div className="flex items-baseline gap-2">
                <h2 className="font-display" style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                  {lang === "fr" ? `Bilan ${currentYear}` : `${currentYear} Summary`}
                </h2>
                <span className="font-mono" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>{annualData.months} {lang === "fr" ? "mois" : "months"}</span>
              </div>

              {/* Annual KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tf-stagger">
                {[
                  { label: lang === "fr" ? "CA ANNUEL" : "ANNUAL REVENUE", value: formatCHF(annualData.totalRevenue), color: "var(--color-accent)" },
                  { label: lang === "fr" ? "BENEFICE ANNUEL" : "ANNUAL PROFIT", value: formatCHF(annualData.totalProfit), color: annualData.totalProfit >= 0 ? "var(--color-success)" : "var(--color-danger)" },
                  { label: lang === "fr" ? "DEPENSES ANNUELLES" : "ANNUAL EXPENSES", value: formatCHF(annualData.totalExpenses), color: "var(--color-danger)" },
                  { label: lang === "fr" ? "NOUVEAUX MEMBRES" : "NEW MEMBERS", value: formatNum(annualData.totalNewMembers), color: "var(--color-success)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="tf-stat">
                    <p className="tf-stat-label">{label}</p>
                    <p className="tf-number-large" style={{ color, marginTop: 'var(--space-2)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Best / Worst / Avg */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="tf-card" style={{ borderColor: 'rgba(48, 209, 88, 0.2)' }}>
                  <p className="tf-label" style={{ color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>
                    {lang === "fr" ? "MEILLEUR MOIS" : "BEST MONTH"}
                  </p>
                  <p className="font-display" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                    {formatMonthFull(annualData.bestMonth.month, lang)}
                  </p>
                  <p className="font-mono" style={{ color: 'var(--color-success)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                    {formatCHF(annualData.bestMonth.total_revenue)}
                  </p>
                </div>
                <div className="tf-card" style={{ borderColor: 'rgba(255, 214, 10, 0.2)' }}>
                  <p className="tf-label" style={{ color: 'var(--color-warning)', marginBottom: 'var(--space-2)' }}>
                    {lang === "fr" ? "MOIS LE PLUS FAIBLE" : "WORST MONTH"}
                  </p>
                  <p className="font-display" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                    {formatMonthFull(annualData.worstMonth.month, lang)}
                  </p>
                  <p className="font-mono" style={{ color: 'var(--color-warning)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                    {formatCHF(annualData.worstMonth.total_revenue)}
                  </p>
                </div>
                <div className="tf-card">
                  <p className="tf-label" style={{ marginBottom: 'var(--space-2)' }}>
                    {lang === "fr" ? "MOYENNES ANNUELLES" : "ANNUAL AVERAGES"}
                  </p>
                  <div className="space-y-1 font-mono" style={{ fontSize: 'var(--text-sm)' }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>ROAS: <span style={{ color: 'var(--color-warning)', fontWeight: 'var(--font-bold)' }}>{annualData.avgRoas.toFixed(1)}x</span></p>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Churn: <span style={{ color: 'var(--color-danger)', fontWeight: 'var(--font-bold)' }}>{annualData.avgChurn.toFixed(1)}%</span></p>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      {lang === "fr" ? "Marge" : "Margin"}: <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-bold)' }}>
                        {((annualData.totalProfit / annualData.totalRevenue) * 100).toFixed(1)}%
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Annual revenue chart */}
              <ChartCard title={lang === "fr" ? `Revenus vs Dépenses ${currentYear}` : `Revenue vs Expenses ${currentYear}`}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData.filter((d) => d.month.startsWith(currentYear))} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                    <Bar dataKey="revenue" name={lang === "fr" ? "Revenus" : "Revenue"} fill={CHART_COLORS.revenue} opacity={0.8} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="expenses" name={lang === "fr" ? "Dépenses" : "Expenses"} fill={CHART_COLORS.expenses} opacity={0.6} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          )}
        </TabsContent>

      </Tabs>

      {/* Edit KPI Modal */}
      <EditKPIModal
        open={editKpiOpen}
        onClose={() => setEditKpiOpen(false)}
        kpi={current}
        onSaved={refetch}
      />
    </div>
  );
}
