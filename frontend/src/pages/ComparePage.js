import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Percent, Calendar,
  ArrowLeft, Download, BarChart3, PieChart, Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useMonthlyKPIData } from "../hooks/useMonthlyKPIData";
import { useTranslations } from "../hooks/useTranslations";
import { formatCHF, formatMonthLabel, formatNum, formatPct } from "../utils/format";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_COLORS = {
  revenue: "#E11D48",
  expenses: "#3B82F6",
  profit: "#22C55E",
  members: "#8B5CF6",
  churn: "#F97316",
  cac: "#06B6D4",
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#0D0D0F] border border-white/10 p-3 rounded-sm text-xs font-mono shadow-xl">
      <p className="text-white/50 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((item, i) => (
        <div key={i} className="flex justify-between gap-6" style={{ color: item.color }}>
          <span className="text-white/70">{item.name}</span>
          <span className="font-bold">{formatCHF(item.value)}</span>
        </div>
      ))}
    </div>
  );
};

const MetricCard = ({ label, value, trend, icon: Icon, variant = "default" }) => {
  const variants = {
    default: "border-white/10",
    success: "border-green-500/30 bg-green-500/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    danger: "border-red-500/30 bg-red-500/5",
  };
  
  return (
    <div className={`bg-[#121214] border ${variants[variant]} rounded-sm p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={14} className="text-white/20" />}
      </div>
      <p className="text-xl font-heading font-extrabold text-white">{value}</p>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};

export default function ComparePage() {
  const { t, lang } = useTranslations();
  const { kpis, loading } = useMonthlyKPIData();
  
  // Date range selection
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  
  // Initialize with last 6 months if not set
  useMemo(() => {
    if (kpis.length > 0 && !startMonth && !endMonth) {
      const end = kpis[kpis.length - 1].month;
      const startIdx = Math.max(0, kpis.length - 6);
      const start = kpis[startIdx].month;
      setStartMonth(start);
      setEndMonth(end);
    }
  }, [kpis, startMonth, endMonth]);

  // Filter KPIs by date range
  const filteredKpis = useMemo(() => {
    if (!startMonth || !endMonth) return kpis;
    return kpis.filter(k => k.month >= startMonth && k.month <= endMonth);
  }, [kpis, startMonth, endMonth]);

  // Calculate aggregated metrics
  const summary = useMemo(() => {
    if (filteredKpis.length === 0) return null;
    
    const total = {
      revenue: filteredKpis.reduce((s, k) => s + (k.total_revenue || 0), 0),
      expenses: filteredKpis.reduce((s, k) => s + (k.total_expenses || 0), 0),
      profit: filteredKpis.reduce((s, k) => s + (k.net_profit || 0), 0),
      newMembers: filteredKpis.reduce((s, k) => s + (k.new_members || 0), 0),
      lostMembers: filteredKpis.reduce((s, k) => s + (k.lost_members || 0), 0),
      marketing: filteredKpis.reduce((s, k) => s + (k.marketing_spend || 0), 0),
    };
    
    const avg = {
      revenue: total.revenue / filteredKpis.length,
      expenses: total.expenses / filteredKpis.length,
      profit: total.profit / filteredKpis.length,
      churn: filteredKpis.reduce((s, k) => s + (k.churn_rate || 0), 0) / filteredKpis.length,
      roas: filteredKpis.reduce((s, k) => s + (k.roas || 0), 0) / filteredKpis.length,
      cac: filteredKpis.reduce((s, k) => s + (k.cac || 0), 0) / filteredKpis.length,
    };
    
    // Best and worst months
    const best = filteredKpis.reduce((b, k) => (k.total_revenue > b.total_revenue ? k : b));
    const worst = filteredKpis.reduce((w, k) => (k.total_revenue < w.total_revenue ? k : w));
    
    // Profit margin
    const profitMargin = total.revenue > 0 ? (total.profit / total.revenue) * 100 : 0;
    
    // Growth (first vs last month)
    const firstMonth = filteredKpis[0];
    const lastMonth = filteredKpis[filteredKpis.length - 1];
    const revenueGrowth = firstMonth.total_revenue > 0 
      ? ((lastMonth.total_revenue - firstMonth.total_revenue) / firstMonth.total_revenue) * 100 
      : 0;
    
    return { total, avg, best, worst, profitMargin, revenueGrowth, months: filteredKpis.length };
  }, [filteredKpis]);

  // Chart data
  const chartData = useMemo(() => 
    filteredKpis.map(k => ({
      label: formatMonthLabel(k.month, lang),
      month: k.month,
      revenue: k.total_revenue || 0,
      expenses: k.total_expenses || 0,
      profit: k.net_profit || 0,
      members: k.total_members || 0,
      newMembers: k.new_members || 0,
      lostMembers: k.lost_members || 0,
      churn: k.churn_rate || 0,
      cac: k.cac || 0,
      roas: k.roas || 0,
      loyer: k.loyer || 0,
      salaires: k.salaires || 0,
      marketing: k.marketing_spend || 0,
    }))
  , [filteredKpis, lang]);

  // Quick range presets
  const setQuickRange = (months) => {
    if (kpis.length === 0) return;
    const end = kpis[kpis.length - 1].month;
    const startIdx = Math.max(0, kpis.length - months);
    setStartMonth(kpis[startIdx].month);
    setEndMonth(end);
  };

  // Available months for selectors
  const availableMonths = useMemo(() => 
    kpis.map(k => ({
      value: k.month,
      label: formatMonthLabel(k.month, lang),
    }))
  , [kpis, lang]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-white/40">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="compare-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-white uppercase tracking-tight">
            {lang === "fr" ? "Analyse Multi-Mois" : "Multi-Month Analysis"}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {summary ? `${summary.months} ${lang === "fr" ? "mois sélectionnés" : "months selected"}` : ""}
          </p>
        </div>
        <Link to="/">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-white/50 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft size={14} className="mr-1.5" />
            {lang === "fr" ? "Retour" : "Back"}
          </Button>
        </Link>
      </div>

      {/* Date Range Selector */}
      <div className="bg-[#121214] border border-white/10 rounded-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-white/40" />
            <span className="text-xs text-white/40 uppercase">{lang === "fr" ? "Période" : "Period"}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger className="w-40 bg-[#1C1C1E] border-white/10 text-white text-sm h-9">
                <SelectValue placeholder={lang === "fr" ? "Début" : "Start"} />
              </SelectTrigger>
              <SelectContent className="bg-[#1C1C1E] border-white/10">
                {availableMonths.map(m => (
                  <SelectItem key={m.value} value={m.value} className="text-white focus:bg-white/10">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <span className="text-white/30">→</span>
            
            <Select value={endMonth} onValueChange={setEndMonth}>
              <SelectTrigger className="w-40 bg-[#1C1C1E] border-white/10 text-white text-sm h-9">
                <SelectValue placeholder={lang === "fr" ? "Fin" : "End"} />
              </SelectTrigger>
              <SelectContent className="bg-[#1C1C1E] border-white/10">
                {availableMonths.map(m => (
                  <SelectItem key={m.value} value={m.value} className="text-white focus:bg-white/10">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Quick presets */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-white/30 mr-2">{lang === "fr" ? "Raccourcis:" : "Quick:"}</span>
            {[3, 6, 12].map(m => (
              <Button
                key={m}
                variant="ghost"
                size="sm"
                onClick={() => setQuickRange(m)}
                className="text-white/40 hover:text-white hover:bg-white/5 text-xs px-2 h-7"
              >
                {m}M
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStartMonth(kpis[0]?.month || ""); setEndMonth(kpis[kpis.length-1]?.month || ""); }}
              className="text-white/40 hover:text-white hover:bg-white/5 text-xs px-2 h-7"
            >
              {lang === "fr" ? "Tout" : "All"}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            label={lang === "fr" ? "CA Total" : "Total Revenue"}
            value={formatCHF(summary.total.revenue)}
            trend={summary.revenueGrowth}
            icon={DollarSign}
            variant={summary.total.revenue > 0 ? "success" : "default"}
          />
          <MetricCard
            label={lang === "fr" ? "Bénéfice Total" : "Total Profit"}
            value={formatCHF(summary.total.profit)}
            icon={TrendingUp}
            variant={summary.total.profit > 0 ? "success" : "danger"}
          />
          <MetricCard
            label={lang === "fr" ? "Dépenses Totales" : "Total Expenses"}
            value={formatCHF(summary.total.expenses)}
            icon={PieChart}
          />
          <MetricCard
            label={lang === "fr" ? "Marge Nette" : "Net Margin"}
            value={`${summary.profitMargin.toFixed(1)}%`}
            icon={Percent}
            variant={summary.profitMargin > 20 ? "success" : summary.profitMargin > 10 ? "warning" : "danger"}
          />
          <MetricCard
            label={lang === "fr" ? "Nouveaux Membres" : "New Members"}
            value={formatNum(summary.total.newMembers)}
            icon={Users}
          />
          <MetricCard
            label={lang === "fr" ? "Churn Moyen" : "Avg Churn"}
            value={`${summary.avg.churn.toFixed(2)}%`}
            icon={Target}
            variant={summary.avg.churn < 3 ? "success" : summary.avg.churn < 5 ? "warning" : "danger"}
          />
        </div>
      )}

      {/* Best/Worst Months */}
      {summary && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#121214] border border-green-500/20 rounded-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-green-400" />
              <span className="text-xs text-white/40 uppercase">{lang === "fr" ? "Meilleur Mois" : "Best Month"}</span>
            </div>
            <p className="text-lg font-heading font-extrabold text-green-400">
              {formatMonthLabel(summary.best.month, lang)}
            </p>
            <p className="text-sm text-white/60">{formatCHF(summary.best.total_revenue)}</p>
          </div>
          <div className="bg-[#121214] border border-red-500/20 rounded-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={14} className="text-red-400" />
              <span className="text-xs text-white/40 uppercase">{lang === "fr" ? "Mois le Plus Faible" : "Weakest Month"}</span>
            </div>
            <p className="text-lg font-heading font-extrabold text-red-400">
              {formatMonthLabel(summary.worst.month, lang)}
            </p>
            <p className="text-sm text-white/60">{formatCHF(summary.worst.total_revenue)}</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="bg-[#1C1C1E] border border-white/10 p-1">
          <TabsTrigger value="revenue" className="text-xs uppercase data-[state=active]:bg-rose-600 data-[state=active]:text-white">
            {lang === "fr" ? "Revenus" : "Revenue"}
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs uppercase data-[state=active]:bg-rose-600 data-[state=active]:text-white">
            {lang === "fr" ? "Membres" : "Members"}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs uppercase data-[state=active]:bg-rose-600 data-[state=active]:text-white">
            {lang === "fr" ? "Dépenses" : "Expenses"}
          </TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs uppercase data-[state=active]:bg-rose-600 data-[state=active]:text-white">
            KPIs
          </TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <div className="bg-[#121214] border border-white/10 rounded-sm p-5">
            <p className="text-xs font-body text-white/50 uppercase tracking-wider mb-4">
              {lang === "fr" ? "Évolution Revenus / Profit / Dépenses" : "Revenue / Profit / Expenses Evolution"}
            </p>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={chartData} onClick={(e) => {}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="revenue" name={lang === "fr" ? "Revenus" : "Revenue"} fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={lang === "fr" ? "Dépenses" : "Expenses"} fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="profit" name={lang === "fr" ? "Profit" : "Profit"} stroke={CHART_COLORS.profit} strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <div className="bg-[#121214] border border-white/10 rounded-sm p-5">
            <p className="text-xs font-body text-white/50 uppercase tracking-wider mb-4">
              {lang === "fr" ? "Évolution des Membres" : "Members Evolution"}
            </p>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="members" name={lang === "fr" ? "Membres Actifs" : "Active Members"} fill={CHART_COLORS.members} fillOpacity={0.3} stroke={CHART_COLORS.members} />
                <Bar dataKey="newMembers" name={lang === "fr" ? "Nouveaux" : "New"} fill={CHART_COLORS.profit} />
                <Bar dataKey="lostMembers" name={lang === "fr" ? "Perdus" : "Lost"} fill={CHART_COLORS.churn} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <div className="bg-[#121214] border border-white/10 rounded-sm p-5">
            <p className="text-xs font-body text-white/50 uppercase tracking-wider mb-4">
              {lang === "fr" ? "Répartition des Dépenses" : "Expenses Breakdown"}
            </p>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="loyer" name={lang === "fr" ? "Loyer" : "Rent"} stackId="a" fill="#3B82F6" />
                <Bar dataKey="salaires" name={lang === "fr" ? "Salaires" : "Salaries"} stackId="a" fill="#8B5CF6" />
                <Bar dataKey="marketing" name="Marketing" stackId="a" fill="#E11D48" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* KPIs Tab */}
        <TabsContent value="metrics">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#121214] border border-white/10 rounded-sm p-5">
              <p className="text-xs font-body text-white/50 uppercase tracking-wider mb-4">
                {lang === "fr" ? "Taux de Churn" : "Churn Rate"}
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip />
                  <Line type="monotone" dataKey="churn" name="Churn" stroke={CHART_COLORS.churn} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#121214] border border-white/10 rounded-sm p-5">
              <p className="text-xs font-body text-white/50 uppercase tracking-wider mb-4">
                CAC & ROAS
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: "#666", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#666", fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="cac" name="CAC" fill={CHART_COLORS.cac} />
                  <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke={CHART_COLORS.profit} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Monthly Data Table */}
      <div className="bg-[#121214] border border-white/10 rounded-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <p className="text-xs font-body text-white/50 uppercase tracking-wider">
            {lang === "fr" ? "Données Mensuelles Détaillées" : "Detailed Monthly Data"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-white/40 uppercase tracking-wider p-3">Mois</th>
                <th className="text-right text-white/40 uppercase tracking-wider p-3">{lang === "fr" ? "Revenus" : "Revenue"}</th>
                <th className="text-right text-white/40 uppercase tracking-wider p-3">{lang === "fr" ? "Dépenses" : "Expenses"}</th>
                <th className="text-right text-white/40 uppercase tracking-wider p-3">{lang === "fr" ? "Profit" : "Profit"}</th>
                <th className="text-right text-white/40 uppercase tracking-wider p-3">{lang === "fr" ? "Membres" : "Members"}</th>
                <th className="text-right text-white/40 uppercase tracking-wider p-3">Churn</th>
                <th className="text-right text-white/40 uppercase tracking-wider p-3">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => (
                <tr key={row.month} className="border-b border-white/5 hover:bg-white/3">
                  <td className="p-3 text-white font-medium">{row.label}</td>
                  <td className="p-3 text-right text-white/80 font-mono">{formatCHF(row.revenue)}</td>
                  <td className="p-3 text-right text-white/60 font-mono">{formatCHF(row.expenses)}</td>
                  <td className={`p-3 text-right font-mono font-bold ${row.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCHF(row.profit)}
                  </td>
                  <td className="p-3 text-right text-white/60 font-mono">{row.members}</td>
                  <td className="p-3 text-right text-white/60 font-mono">{row.churn.toFixed(2)}%</td>
                  <td className="p-3 text-right text-white/60 font-mono">{row.roas.toFixed(1)}x</td>
                </tr>
              ))}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="bg-white/5 font-bold">
                  <td className="p-3 text-white uppercase">Total / Moy.</td>
                  <td className="p-3 text-right text-white font-mono">{formatCHF(summary.total.revenue)}</td>
                  <td className="p-3 text-right text-white/80 font-mono">{formatCHF(summary.total.expenses)}</td>
                  <td className={`p-3 text-right font-mono ${summary.total.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCHF(summary.total.profit)}
                  </td>
                  <td className="p-3 text-right text-white/60 font-mono">-</td>
                  <td className="p-3 text-right text-white/60 font-mono">{summary.avg.churn.toFixed(2)}%</td>
                  <td className="p-3 text-right text-white/60 font-mono">{summary.avg.roas.toFixed(1)}x</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
