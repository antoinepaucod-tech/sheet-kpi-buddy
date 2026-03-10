import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { KPICard } from "../components/KPICard";
import { EditKPIModal } from "../components/EditKPIModal";
import { KPIDetailedView } from "../components/KPIDetailedView";
import {
  TrendingUp, Users, Percent, DollarSign, Target, Zap, Loader2, RotateCcw, Pencil,
  ChevronLeft, ChevronRight, FileDown,
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
  revenue: "#E11D48",
  members: "#22C55E",
  coaching: "#10B981",
  expenses: "#3B82F6",
  profit: "#22C55E",
  churn: "#F97316",
  cac: "#8B5CF6",
  roas: "#FACC15",
  loyer: "#3B82F6",
  salaires: "#8B5CF6",
  utilities: "#F59E0B",
  marketing: "#E11D48",
  other: "#6B7280",
};

const ChartTooltip = ({ active, payload, label, isCurrency = true }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#0D0D0F] border border-white/10 p-3 rounded-sm text-xs font-mono shadow-xl">
      <p className="text-white/50 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((item, i) => (
        <div key={i} className="flex justify-between gap-6" style={{ color: item.color }}>
          <span className="text-white/70">{item.name}</span>
          <span className="font-bold">
            {isCurrency ? formatCHF(item.value) : item.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const ChartCard = ({ title, children }) => (
  <div className="bg-[#121214] border border-white/10 rounded-sm p-5">
    <p className="text-xs font-body text-white/50 uppercase tracking-wider mb-4">{title}</p>
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
        members: k.total_members,
        newMembers: k.new_members,
        lostMembers: k.lost_members,
        churn: k.churn_rate,
        cac: k.cac,
        roas: k.roas,
        profitMargin: k.profit_margin,
        revMembers: k.revenue_members,
        revCoaching: k.revenue_coaching,
        loyer: k.loyer,
        salaires: k.salaires,
        utilities: k.utilities,
        marketing: k.marketing_spend + k.ad_spend,
        other: k.other_expenses,
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
      <div className="flex items-center justify-center h-64" data-testid="dashboard-loading">
        <Loader2 className="animate-spin text-rose-500" size={32} />
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4" data-testid="dashboard-empty">
        <p className="text-white/40 font-body">{t("noData")}</p>
        <Button
          onClick={handleSeed}
          disabled={seeding}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider"
          data-testid="seed-btn"
        >
          {seeding ? (
            <Loader2 size={14} className="animate-spin mr-2" />
          ) : (
            <RotateCcw size={14} className="mr-2" />
          )}
          {seeding ? t("seeding") : t("seedData")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-content">
      <Toaster />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl font-extrabold text-white uppercase tracking-tight">
            {settings?.club_name || t("dashboard")}
          </h1>
          {selectedLabel && (
            <p className="text-white/40 text-sm font-body mt-1">{selectedLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Month navigation */}
          <button
            onClick={() => navigateMonth(-1)}
            disabled={!canGoBack}
            className="p-1.5 text-white/30 hover:text-white disabled:opacity-20 transition-colors"
            data-testid="prev-month-btn"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => navigateMonth(1)}
            disabled={!canGoForward}
            className="p-1.5 text-white/30 hover:text-white disabled:opacity-20 transition-colors"
            data-testid="next-month-btn"
          >
            <ChevronRight size={16} />
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditKpiOpen(true)}
            className="text-white/30 hover:text-white hover:bg-white/5 text-xs"
            data-testid="edit-kpi-btn"
            title={lang === "fr" ? "Modifier les KPIs" : "Edit KPIs"}
          >
            <Pencil size={12} className="mr-1.5" />
            {lang === "fr" ? "Modifier" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedMonth) {
                window.open(`${API}/report/pdf/${selectedMonth}`, '_blank');
              }
            }}
            disabled={!selectedMonth}
            className="text-white/30 hover:text-white hover:bg-white/5 text-xs"
            data-testid="export-pdf-btn"
            title={lang === "fr" ? "Télécharger le rapport PDF" : "Download PDF report"}
          >
            <FileDown size={12} className="mr-1.5" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
            className="border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-xs"
            data-testid="reseed-btn"
          >
            {seeding ? (
              <Loader2 size={12} className="animate-spin mr-1.5" />
            ) : (
              <RotateCcw size={12} className="mr-1.5" />
            )}
            {t("seedData")}
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="kpi-grid">
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
          label={t("totalMembers")}
          value={formatNum(current?.total_members)}
          trend={getTrend(current?.total_members, previous?.total_members)}
          vsLabel={t("vsLastMonth")}
          icon={Users}
          data-testid="kpi-members"
        />
        <KPICard
          label={t("churnRate")}
          value={formatPct(current?.churn_rate)}
          trend={
            current?.churn_rate && previous?.churn_rate
              ? { pct: Math.abs(current.churn_rate - previous.churn_rate).toFixed(1), up: current.churn_rate < previous.churn_rate }
              : null
          }
          vsLabel={t("vsLastMonth")}
          icon={Percent}
          data-testid="kpi-churn"
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

      {/* KPI vs Targets */}
      {settings?.targets && current && (
        <div className="bg-[#121214] border border-white/10 rounded-sm p-5">
          <p className="text-xs font-body text-white/40 uppercase tracking-wider mb-4">
            {lang === "fr" ? "Objectifs du mois" : "Monthly targets"}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {[
              {
                label: t("churnRate"),
                actual: current.churn_rate,
                target: settings.targets.churn_rate,
                format: (v) => `${v?.toFixed(1)}%`,
                lower_is_better: true,
                color: "bg-orange-500",
              },
              {
                label: t("cac"),
                actual: current.cac,
                target: settings.targets.cac,
                format: formatCHF,
                lower_is_better: true,
                color: "bg-purple-500",
              },
              {
                label: t("roas"),
                actual: current.roas,
                target: settings.targets.roas,
                format: (v) => `${v?.toFixed(1)}x`,
                lower_is_better: false,
                color: "bg-yellow-400",
              },
              {
                label: t("newMembers"),
                actual: current.new_members,
                target: settings.targets.new_members,
                format: (v) => `${v}`,
                lower_is_better: false,
                color: "bg-green-500",
              },
              {
                label: t("profitMargin"),
                actual: current.profit_margin,
                target: settings.targets.profit_margin,
                format: (v) => `${v?.toFixed(1)}%`,
                lower_is_better: false,
                color: "bg-green-500",
              },
              {
                label: t("totalRevenue"),
                actual: current.total_revenue,
                target: current.total_revenue * (1 + (settings.targets.revenue_growth || 5) / 100),
                format: formatCHF,
                lower_is_better: false,
                color: "bg-rose-500",
              },
            ].map(({ label, actual, target, format, lower_is_better, color }) => {
              const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
              const good = lower_is_better ? actual <= target : actual >= target;
              return (
                <div key={label} className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
                    <span className={`text-xs font-mono font-bold ${good ? "text-green-400" : "text-orange-400"}`}>
                      {format(actual)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: good ? "#22C55E" : "#F97316",
                      }}
                    />
                  </div>
                  <p className="text-xs text-white/20 font-mono">
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
        <TabsList className="bg-[#1C1C1E] border border-white/10 rounded-sm p-1">
          {["revenue", "details", "funnel", "members", "metrics", "annual"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              data-testid={`tab-${tab}`}
              className="rounded-sm text-white/50 data-[state=active]:bg-rose-600 data-[state=active]:text-white font-body text-sm uppercase tracking-wider"
            >
              {tab === "annual" 
                ? (lang === "fr" ? "Annuel" : "Annual") 
                : tab === "details" 
                ? (lang === "fr" ? "Détails" : "Details")
                : t(tab)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4" data-testid="tab-revenue-content">
          {/* N-1 Toggle */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/30 font-mono">
              {showN1 && n1Kpis.length > 0 ? `↗ comparaison ${n1Year}` : ""}
            </p>
            {n1Kpis.length > 0 && (
              <button
                onClick={() => setShowN1(!showN1)}
                className={`text-xs font-mono px-3 py-1 rounded-sm border transition-colors ${showN1 ? "border-rose-500/50 text-rose-400 bg-rose-500/10" : "border-white/10 text-white/30 hover:text-white/60"}`}
                data-testid="n1-toggle-btn"
              >
                {showN1 ? "✓ " : ""} N-1 ({n1Year})
              </button>
            )}
          </div>

          {/* Monthly note */}
          {current?.note && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-sm px-4 py-2.5 flex items-start gap-2">
              <span className="text-yellow-400/60 text-xs mt-0.5">📝</span>
              <p className="text-yellow-300/80 text-sm font-body">{current.note}</p>
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
          <div className="bg-[#121214] border border-white/10 rounded-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-body text-white/50 uppercase tracking-wider">
                {lang === "fr" ? "Données Détaillées du Mois" : "Detailed Monthly Data"}
              </p>
              <span className="text-xs font-mono text-white/30">
                {current?.month ? formatMonthFull(current.month, lang) : ""}
              </span>
            </div>
            <KPIDetailedView kpi={current} lang={lang} />
          </div>
        </TabsContent>

        {/* Funnel Tab */}
        <TabsContent value="funnel" className="space-y-4" data-testid="tab-funnel-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Acquisition stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: t("newMembers"), value: formatNum(current?.new_members), color: "text-green-400" },
                { label: t("lostMembers"), value: formatNum(current?.lost_members), color: "text-red-400" },
                { label: t("marketingSpend"), value: formatCHF(current?.marketing_spend), color: "text-rose-400" },
                { label: t("cac"), value: formatCHF(current?.cac), color: "text-purple-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#121214] border border-white/10 p-5 rounded-sm">
                  <p className="text-xs text-white/50 uppercase tracking-wider">{label}</p>
                  <p className={`text-2xl font-heading font-extrabold mt-2 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <ChartCard title={t("cacEvolution")}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={currentYearData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.cac} strokeDasharray="4 4" />}
                  <Line type="monotone" dataKey="cac" name={t("cac")} stroke={CHART_COLORS.cac} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("acquisitionFunnel")}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={currentYearData} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip isCurrency={false} />} />
                  <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.revenue} strokeDasharray="4 4" />}
                  <Bar dataKey="newMembers" name={t("newMembers")} fill={CHART_COLORS.members} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="lostMembers" name={t("lostMembers")} fill={CHART_COLORS.churn} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4" data-testid="tab-members-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t("membersEvolution")}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={currentYearData}>
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
                  {selectedLabel && <ReferenceLine x={selectedLabel} stroke={CHART_COLORS.members} strokeDasharray="4 4" />}
                  <Area type="monotone" dataKey="members" name={t("totalMembers")} stroke={CHART_COLORS.members} fill="url(#membGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("profitMargin"), value: formatPct(current?.profit_margin) },
              { label: t("roas"), value: `${(current?.roas ?? 0).toFixed(2)}x` },
              { label: t("totalExpenses"), value: formatCHF(current?.total_expenses) },
              { label: t("adSpend"), value: formatCHF(current?.ad_spend) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#121214] border border-white/10 p-4 rounded-sm">
                <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
                <p className="text-xl font-heading font-extrabold text-white mt-1">{value}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Annual Summary Tab */}
        <TabsContent value="annual" className="space-y-4" data-testid="tab-annual-content">
          {annualData && (
            <>
              <div className="flex items-baseline gap-2">
                <h2 className="font-heading text-2xl font-extrabold text-white uppercase">
                  {lang === "fr" ? `Bilan ${currentYear}` : `${currentYear} Summary`}
                </h2>
                <span className="text-white/30 text-sm font-mono">{annualData.months} {lang === "fr" ? "mois" : "months"}</span>
              </div>

              {/* Annual KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: lang === "fr" ? "CA Annuel" : "Annual Revenue", value: formatCHF(annualData.totalRevenue), color: "text-rose-500" },
                  { label: lang === "fr" ? "Bénéfice Annuel" : "Annual Profit", value: formatCHF(annualData.totalProfit), color: annualData.totalProfit >= 0 ? "text-green-400" : "text-red-400" },
                  { label: lang === "fr" ? "Dépenses Annuelles" : "Annual Expenses", value: formatCHF(annualData.totalExpenses), color: "text-blue-400" },
                  { label: lang === "fr" ? "Nouveaux Membres" : "New Members", value: formatNum(annualData.totalNewMembers), color: "text-emerald-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#121214] border border-white/10 p-5 rounded-sm">
                    <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
                    <p className={`text-2xl font-heading font-extrabold mt-2 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Best / Worst / Avg */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#121214] border border-green-500/20 p-5 rounded-sm">
                  <p className="text-xs text-green-400/60 uppercase tracking-wider mb-2">
                    {lang === "fr" ? "Meilleur mois" : "Best month"}
                  </p>
                  <p className="font-heading text-xl font-extrabold text-white uppercase">
                    {formatMonthFull(annualData.bestMonth.month, lang)}
                  </p>
                  <p className="text-green-400 font-mono text-sm mt-1">
                    {formatCHF(annualData.bestMonth.total_revenue)}
                  </p>
                </div>
                <div className="bg-[#121214] border border-orange-500/20 p-5 rounded-sm">
                  <p className="text-xs text-orange-400/60 uppercase tracking-wider mb-2">
                    {lang === "fr" ? "Mois le plus faible" : "Worst month"}
                  </p>
                  <p className="font-heading text-xl font-extrabold text-white uppercase">
                    {formatMonthFull(annualData.worstMonth.month, lang)}
                  </p>
                  <p className="text-orange-400 font-mono text-sm mt-1">
                    {formatCHF(annualData.worstMonth.total_revenue)}
                  </p>
                </div>
                <div className="bg-[#121214] border border-white/10 p-5 rounded-sm">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
                    {lang === "fr" ? "Moyennes annuelles" : "Annual averages"}
                  </p>
                  <div className="space-y-1 text-sm font-mono">
                    <p className="text-white/70">ROAS: <span className="text-yellow-400 font-bold">{annualData.avgRoas.toFixed(1)}x</span></p>
                    <p className="text-white/70">Churn: <span className="text-orange-400 font-bold">{annualData.avgChurn.toFixed(1)}%</span></p>
                    <p className="text-white/70">
                      {lang === "fr" ? "Marge" : "Margin"}: <span className="text-green-400 font-bold">
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
