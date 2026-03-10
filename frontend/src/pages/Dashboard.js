import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { KPICard } from "../components/KPICard";
import {
  TrendingUp, Users, Percent, DollarSign, Target, Zap, Loader2, RotateCcw,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useTranslations } from "../hooks/useTranslations";
import { useMonthlyKPIData } from "../hooks/useMonthlyKPIData";
import { useSettings } from "../hooks/useSettings";
import { Toaster } from "../components/ui/toaster";
import { useToast } from "../hooks/use-toast";
import { formatCHF, formatPct, formatMonthLabel, formatNum, getTrend } from "../utils/format";
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

export default function Dashboard({ selectedMonth }) {
  const { t, lang } = useTranslations();
  const { kpis, loading, refetch, getKpiByMonth, getPreviousKpi } = useMonthlyKPIData();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);

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

  const current = getKpiByMonth(selectedMonth);
  const previous = getPreviousKpi(selectedMonth);

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
            {t("dashboard")}
          </h1>
          {selectedLabel && (
            <p className="text-white/40 text-sm font-body mt-1">{selectedLabel}</p>
          )}
        </div>
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
          {["revenue", "funnel", "members", "metrics"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              data-testid={`tab-${tab}`}
              className="rounded-sm text-white/50 data-[state=active]:bg-rose-600 data-[state=active]:text-white font-body text-sm uppercase tracking-wider"
            >
              {t(tab)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4" data-testid="tab-revenue-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t("revenueEvolution")}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
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
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("memberVsCoaching")}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barSize={14}>
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
                <BarChart data={chartData} barSize={12}>
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
                <AreaChart data={chartData}>
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
                <LineChart data={chartData}>
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
                <BarChart data={chartData} barSize={12}>
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
                <AreaChart data={chartData}>
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
                <ComposedChart data={chartData}>
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
                <ComposedChart data={chartData}>
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
                <ComposedChart data={chartData}>
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
      </Tabs>
    </div>
  );
}
