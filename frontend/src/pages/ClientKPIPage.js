import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  UserCheck,
  Search,
  TrendingUp,
  Calendar,
  Activity,
  Flame,
  Award,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ENGAGEMENT_COLORS = {
  Excellent: "text-[var(--color-success)]",
  Bon: "text-[var(--color-accent)]",
  Moyen: "text-[var(--color-warning)]",
  Faible: "text-[var(--color-danger)]",
};

const ENGAGEMENT_BG = {
  Excellent: "bg-[rgba(48,209,88,0.15)]",
  Bon: "bg-[rgba(10,132,255,0.15)]",
  Moyen: "bg-[rgba(255,214,10,0.15)]",
  Faible: "bg-[rgba(255,69,58,0.15)]",
};

export default function ClientKPIPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [search, setSearch] = useState("");
  const [filterEngagement, setFilterEngagement] = useState("all");
  const [expandedMember, setExpandedMember] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);

  // Fetch members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => axios.get(`${API}/members`).then((r) => r.data),
  });

  // Fetch trainings
  const { data: trainings = [] } = useQuery({
    queryKey: ["trainings", selectedYear],
    queryFn: () => axios.get(`${API}/trainings?year=${selectedYear}`).then((r) => r.data),
  });

  // Fetch training summary for expanded member
  const { data: memberSummary } = useQuery({
    queryKey: ["trainings", "summary", expandedMember, selectedYear],
    queryFn: () =>
      expandedMember
        ? axios.get(`${API}/trainings/summary/${expandedMember}?year=${selectedYear}`).then((r) => r.data)
        : null,
    enabled: !!expandedMember,
  });

  // Update training
  const updateMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/trainings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["trainings"]);
      toast.success("Entraînement mis à jour");
    },
  });

  // Calculate member stats (exclude coaches and expired)
  const memberStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const activeMembers = members.filter(m => {
      if (m.is_coach) return false;
      const exitDate = m.exit_date;
      if (exitDate && exitDate < today) return false;
      return true;
    });
    const stats = activeMembers.map((member) => {
      const memberTrainings = trainings.filter((t) => t.member_id === member.id);
      const totalTrainings = memberTrainings.reduce((sum, t) => sum + (t.trainings_count || 0), 0);
      const weeksTracked = memberTrainings.length;
      const avgPerWeek = weeksTracked > 0 ? (totalTrainings / weeksTracked).toFixed(1) : 0;
      
      let engagement = "Faible";
      if (avgPerWeek >= 4) engagement = "Excellent";
      else if (avgPerWeek >= 3) engagement = "Bon";
      else if (avgPerWeek >= 2) engagement = "Moyen";
      
      return {
        ...member,
        totalTrainings,
        weeksTracked,
        avgPerWeek: parseFloat(avgPerWeek),
        engagement,
        trainings: memberTrainings,
      };
    });
    
    return stats.sort((a, b) => b.totalTrainings - a.totalTrainings);
  }, [members, trainings]);

  // Filter members
  const filteredMembers = useMemo(() => {
    let result = memberStats;
    
    if (filterEngagement !== "all") {
      result = result.filter((m) => m.engagement === filterEngagement);
    }
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name?.toLowerCase().includes(s) ||
          m.email?.toLowerCase().includes(s) ||
          m.membership?.toLowerCase().includes(s)
      );
    }
    
    return result;
  }, [memberStats, filterEngagement, search]);

  // Global stats
  const globalStats = useMemo(() => {
    const withData = memberStats.filter((m) => m.weeksTracked > 0);
    const totalAvg = withData.length > 0
      ? (withData.reduce((sum, m) => sum + m.avgPerWeek, 0) / withData.length).toFixed(1)
      : 0;
    
    return {
      totalMembers: members.length,
      membersWithData: withData.length,
      avgPerWeek: parseFloat(totalAvg),
      excellent: memberStats.filter((m) => m.engagement === "Excellent").length,
      bon: memberStats.filter((m) => m.engagement === "Bon").length,
      moyen: memberStats.filter((m) => m.engagement === "Moyen").length,
      faible: memberStats.filter((m) => m.engagement === "Faible").length,
    };
  }, [memberStats, members]);

  // Weekly aggregate data for chart
  const weeklyAggregate = useMemo(() => {
    const byWeek = {};
    trainings.forEach((t) => {
      const week = t.calendar_week;
      if (!byWeek[week]) byWeek[week] = { week, total: 0, count: 0 };
      byWeek[week].total += t.trainings_count || 0;
      byWeek[week].count += 1;
    });
    
    return Object.values(byWeek)
      .map((w) => ({
        ...w,
        avg: w.count > 0 ? (w.total / w.count).toFixed(1) : 0,
      }))
      .sort((a, b) => a.week - b.week);
  }, [trainings]);

  const handleTrainingUpdate = (memberId, week, value) => {
    updateMutation.mutate({
      member_id: memberId,
      calendar_year: selectedYear,
      calendar_week: week,
      trainings_count: parseInt(value) || 0,
    });
  };

  const getEngagementIcon = (engagement) => {
    switch (engagement) {
      case "Excellent":
        return <Flame className="text-[var(--color-success)]" size={16} />;
      case "Bon":
        return <Activity className="text-[var(--color-accent)]" size={16} />;
      case "Moyen":
        return <TrendingUp className="text-[var(--color-warning)]" size={16} />;
      default:
        return <BarChart3 className="text-[var(--color-danger)]" size={16} />;
    }
  };

  return (
    <div className="space-y-6" data-testid="client-kpi-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header">
            {lang === "fr" ? "KPIs Clients" : "Client KPIs"}
          </h1>
          <p className="tf-page-subtitle">
            {lang === "fr" ? "Engagement et séances hebdomadaires par membre" : "Engagement and weekly sessions per member"}
          </p>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="tf-stat">
          <p className="tf-stat-label">Total Membres</p>
          <p className="tf-number-large">{globalStats.totalMembers}</p>
        </div>
        <div className="tf-stat">
          <p className="tf-stat-label">Moy. / Semaine</p>
          <p className="tf-number-large" style={{color:"var(--color-info)"}}>{globalStats.avgPerWeek}</p>
        </div>
        <div 
          className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border cursor-pointer transition-colors ${filterEngagement === 'Excellent' ? 'border-[var(--color-success)]' : 'border-[var(--color-border)] hover:border-[rgba(48,209,88,0.3)]'}`}
          onClick={() => setFilterEngagement(filterEngagement === 'Excellent' ? 'all' : 'Excellent')}
        >
          <p className="text-[var(--color-success)] text-xs uppercase flex items-center gap-1">
            <Flame size={10} /> Excellent
          </p>
          <p className="tf-number-large" style={{color:"var(--color-success)"}}>{globalStats.excellent}</p>
        </div>
        <div 
          className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border cursor-pointer transition-colors ${filterEngagement === 'Bon' ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)] hover:border-[rgba(10,132,255,0.3)]'}`}
          onClick={() => setFilterEngagement(filterEngagement === 'Bon' ? 'all' : 'Bon')}
        >
          <p className="text-[var(--color-accent)] text-xs uppercase">Bon</p>
          <p className="tf-number-large" style={{color:"var(--color-accent)"}}>{globalStats.bon}</p>
        </div>
        <div 
          className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border cursor-pointer transition-colors ${filterEngagement === 'Moyen' ? 'border-[var(--color-warning)]' : 'border-[var(--color-border)] hover:border-[rgba(255,214,10,0.3)]'}`}
          onClick={() => setFilterEngagement(filterEngagement === 'Moyen' ? 'all' : 'Moyen')}
        >
          <p className="text-[var(--color-warning)] text-xs uppercase">Moyen</p>
          <p className="tf-number-large" style={{color:"var(--color-warning)"}}>{globalStats.moyen}</p>
        </div>
        <div 
          className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border cursor-pointer transition-colors ${filterEngagement === 'Faible' ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)] hover:border-[rgba(255,69,58,0.3)]'}`}
          onClick={() => setFilterEngagement(filterEngagement === 'Faible' ? 'all' : 'Faible')}
        >
          <p className="text-[var(--color-danger)] text-xs uppercase">Faible</p>
          <p className="tf-number-large" style={{color:"var(--color-danger)"}}>{globalStats.faible}</p>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-6 border border-[var(--color-border)]">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-[var(--color-info)]" />
          Moyenne d'entraînements par semaine ({selectedYear})
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyAggregate}>
              <defs>
                <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0A84FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="week" stroke="#666" tick={{ fill: '#666', fontSize: 10 }} />
              <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1C1C1E', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Area
                type="monotone"
                dataKey="avg"
                stroke="#0A84FF"
                fillOpacity={1}
                fill="url(#colorAvg)"
                name="Moyenne"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "fr" ? "Rechercher un membre..." : "Search member..."}
            className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
            data-testid="client-search"
          />
        </div>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[120px] bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white" data-testid="year-filter">
            <Calendar size={14} className="mr-2 text-[var(--color-text-secondary)]" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
            {[2023, 2024, 2025].map((y) => (
              <SelectItem key={y} value={y.toString()} className="text-white">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterEngagement !== "all" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterEngagement("all")}
            className="border-[var(--color-border)] text-[var(--color-text-secondary)]"
          >
            Réinitialiser filtre
          </Button>
        )}
      </div>

      {/* Members Table */}
      <div className="tf-card overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--color-border)] hover:bg-transparent">
              <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Type</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Abonnement</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Total séances</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Moy. / semaine</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Engagement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-[var(--color-text-secondary)] py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-[var(--color-text-secondary)] py-8">
                  Aucun membre trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <>
                  <TableRow
                    key={member.id}
                    className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
                    onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                    data-testid={`client-row-${member.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {expandedMember === member.id ? (
                          <ChevronUp size={14} className="text-[var(--color-text-tertiary)]" />
                        ) : (
                          <ChevronDown size={14} className="text-[var(--color-text-tertiary)]" />
                        )}
                        <div>
                          <p className="text-white font-medium">{member.name}</p>
                          <p className="text-[var(--color-text-secondary)] text-xs">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-[var(--color-border-strong)] text-[var(--color-text-secondary)]">
                        {member.member_type?.replace("Membres ", "")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[var(--color-text-secondary)]">{member.membership}</TableCell>
                    <TableCell>
                      <span className="text-white font-medium">{member.totalTrainings}</span>
                      <span className="text-[var(--color-text-secondary)] text-xs ml-1">séances</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(member.avgPerWeek * 20, 100)}
                          className="w-20 h-2 bg-[rgba(255,255,255,0.1)]"
                        />
                        <span className={`font-medium ${ENGAGEMENT_COLORS[member.engagement]}`}>
                          {member.avgPerWeek}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${ENGAGEMENT_BG[member.engagement]} ${ENGAGEMENT_COLORS[member.engagement]} border-0`}>
                        {getEngagementIcon(member.engagement)}
                        <span className="ml-1">{member.engagement}</span>
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandedMember === member.id && memberSummary && (
                    <TableRow className="bg-[var(--color-bg-secondary)]">
                      <TableCell colSpan={6}>
                        <div className="py-6 px-4 space-y-6">
                          {/* Summary stats */}
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                              <p className="text-[var(--color-text-secondary)] text-xs uppercase">Total séances</p>
                              <p className="tf-number-large">{memberSummary.total_trainings}</p>
                            </div>
                            <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                              <p className="text-[var(--color-text-secondary)] text-xs uppercase">Semaines suivies</p>
                              <p className="tf-number-large">{memberSummary.weeks_tracked}</p>
                            </div>
                            <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                              <p className="text-[var(--color-text-secondary)] text-xs uppercase">Moyenne / sem.</p>
                              <p className={`tf-number-large ${ENGAGEMENT_COLORS[memberSummary.engagement_level]}`}>
                                {memberSummary.avg_per_week}
                              </p>
                            </div>
                            <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                              <p className="text-[var(--color-text-secondary)] text-xs uppercase">Engagement</p>
                              <Badge className={`${ENGAGEMENT_BG[memberSummary.engagement_level]} ${ENGAGEMENT_COLORS[memberSummary.engagement_level]} border-0 mt-1`}>
                                {memberSummary.engagement_level}
                              </Badge>
                            </div>
                          </div>

                          {/* Weekly chart */}
                          <div>
                            <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-3">Évolution hebdomadaire</p>
                            <div className="h-32">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={memberSummary.details?.slice(-12) || []}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                  <XAxis dataKey="calendar_week" stroke="#666" tick={{ fill: '#666', fontSize: 10 }} />
                                  <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 10 }} />
                                  <Tooltip
                                    contentStyle={{ backgroundColor: '#1C1C1E', border: '1px solid #333', borderRadius: '8px' }}
                                    labelStyle={{ color: '#fff' }}
                                    formatter={(value) => [value, 'Séances']}
                                    labelFormatter={(label) => `Semaine ${label}`}
                                  />
                                  <Bar dataKey="trainings_count" fill="#0A84FF" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Quick entry for recent weeks */}
                          <div>
                            <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-3">Saisie rapide (dernières semaines)</p>
                            <div className="flex flex-wrap gap-2">
                              {Array.from({ length: 8 }, (_, i) => {
                                const week = new Date().getWeek?.() || Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000);
                                const targetWeek = week - 7 + i;
                                const existing = memberSummary.details?.find((d) => d.calendar_week === targetWeek);
                                return (
                                  <div key={targetWeek} className="text-center">
                                    <p className="text-[var(--color-text-secondary)] text-xs mb-1">S{targetWeek}</p>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="7"
                                      defaultValue={existing?.trainings_count || 0}
                                      onBlur={(e) => handleTrainingUpdate(member.id, targetWeek, e.target.value)}
                                      className="w-14 h-8 text-center bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
                                      data-testid={`training-w${targetWeek}-${member.id}`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Flame size={14} className="text-[var(--color-success)]" />
          <span className="text-[var(--color-text-secondary)]">Excellent (4+ / sem.)</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[var(--color-accent)]" />
          <span className="text-[var(--color-text-secondary)]">Bon (3+ / sem.)</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-[var(--color-warning)]" />
          <span className="text-[var(--color-text-secondary)]">Moyen (2+ / sem.)</span>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-[var(--color-danger)]" />
          <span className="text-[var(--color-text-secondary)]">Faible (&lt;2 / sem.)</span>
        </div>
      </div>
    </div>
  );
}
