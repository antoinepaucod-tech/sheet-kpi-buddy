import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  ListChecks,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Save,
  Users,
  Activity,
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
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getWeekDateRange(year, week) {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay() || 7;
  const startDate = new Date(jan1);
  startDate.setDate(jan1.getDate() + (week - 1) * 7 - dayOfWeek + 1);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const fmt = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
  return `${fmt(startDate)}-${fmt(endDate)}`;
}

const CELL_COLORS = [
  "text-[var(--color-text-tertiary)]",       // 0
  "text-[var(--color-danger)]",        // 1
  "text-[var(--color-warning)]",      // 2
  "text-[var(--color-warning)]",     // 3
  "text-[var(--color-success)]",    // 4
  "text-[var(--color-success)]",    // 5+
];

function getCellColor(val) {
  if (!val || val <= 0) return CELL_COLORS[0];
  if (val >= 5) return CELL_COLORS[5];
  return CELL_COLORS[val];
}

function getCellBg(val) {
  if (!val || val <= 0) return "bg-white/[0.02]";
  if (val === 1) return "bg-[rgba(255,69,58,0.08)]";
  if (val === 2) return "bg-[rgba(255,214,10,0.08)]";
  if (val === 3) return "bg-[rgba(255,214,10,0.08)]";
  return "bg-[rgba(48,209,88,0.08)]";
}

export default function AttendancePage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const now = new Date();
  const currentWeek = getISOWeek(now);
  const currentYear = now.getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startWeek, setStartWeek] = useState(1);
  const weeksToShow = 8;
  const [search, setSearch] = useState("");

  const pendingUpdates = useRef({});
  const [localUpdates, setLocalUpdates] = useState({});

  const weeks = useMemo(
    () => Array.from({ length: weeksToShow }, (_, i) => startWeek + i).filter((w) => w >= 1 && w <= 52),
    [startWeek]
  );

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => axios.get(`${API}/members`).then((r) => r.data),
  });

  const { data: trainings = [] } = useQuery({
    queryKey: ["trainings", selectedYear],
    queryFn: () => axios.get(`${API}/trainings?year=${selectedYear}`).then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/trainings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["trainings"]);
      setLocalUpdates({});
    },
  });

  const trainingMap = useMemo(() => {
    const map = {};
    trainings.forEach((t) => {
      const key = `${t.member_id}_${t.calendar_week}`;
      map[key] = t.trainings_count || 0;
    });
    // Merge local updates for instant total recalculation
    Object.entries(localUpdates).forEach(([key, val]) => {
      map[key] = val;
    });
    return map;
  }, [trainings, localUpdates]);

  const filteredMembers = useMemo(() => {
    if (!search) return members.filter(m => !m.is_coach);
    const s = search.toLowerCase();
    return members.filter(
      (m) => !m.is_coach && (m.name?.toLowerCase().includes(s) || m.email?.toLowerCase().includes(s))
    );
  }, [members, search]);

  const weekTotals = useMemo(() => {
    const totals = {};
    weeks.forEach((w) => {
      totals[w] = filteredMembers.reduce((sum, m) => sum + (trainingMap[`${m.id}_${w}`] || 0), 0);
    });
    return totals;
  }, [weeks, filteredMembers, trainingMap]);

  const memberTotals = useMemo(() => {
    const totals = {};
    filteredMembers.forEach((m) => {
      totals[m.id] = weeks.reduce((sum, w) => sum + (trainingMap[`${m.id}_${w}`] || 0), 0);
    });
    return totals;
  }, [filteredMembers, weeks, trainingMap]);

  const handleCellBlur = useCallback(
    (memberId, week, value) => {
      const val = parseInt(value) || 0;
      const key = `${memberId}_${week}`;
      const current = trainingMap[key] || 0;
      if (val === current) return;

      // Update local state immediately for instant total recalculation
      setLocalUpdates(prev => ({ ...prev, [key]: val }));

      updateMutation.mutate({
        member_id: memberId,
        calendar_year: selectedYear,
        calendar_week: week,
        trainings_count: val,
      });
    },
    [selectedYear, trainingMap, updateMutation]
  );

  const handleSaveAll = () => {
    const entries = Object.entries(pendingUpdates.current);
    if (entries.length === 0) {
      toast.info("Aucune modification à sauvegarder");
      return;
    }
    entries.forEach(([key, val]) => {
      const [memberId, week] = key.split("_");
      updateMutation.mutate({
        member_id: memberId,
        calendar_year: selectedYear,
        calendar_week: parseInt(week),
        trainings_count: val,
      });
    });
    pendingUpdates.current = {};
    toast.success(`${entries.length} séances mises à jour`);
  };

  const shiftWeeks = (direction) => {
    const newStart = startWeek + direction * weeksToShow;
    if (direction < 0) {
      setStartWeek(Math.max(1, newStart));
    } else if (newStart <= 52) {
      setStartWeek(newStart);
    }
  };

  return (
    <div className="space-y-6" data-testid="attendance-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header">
            {lang === "fr" ? "Saisie Globale des Séances" : "Global Attendance"}
          </h1>
          <p className="tf-page-subtitle">
            {lang === "fr"
              ? "Saisissez le nombre de séances par membre et par semaine"
              : "Enter session count per member per week"}
          </p>
        </div>
        <Button
          onClick={handleSaveAll}
          className="bg-[var(--color-accent)] hover:opacity-85"
          data-testid="save-all-btn"
        >
          <Save size={14} className="mr-1.5" />
          Tout sauvegarder
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="tf-stat">
          <p className="text-[var(--color-text-secondary)] text-xs uppercase flex items-center gap-1">
            <Users size={10} /> Membres
          </p>
          <p className="tf-number-large">{members.length}</p>
        </div>
        <div className="tf-stat">
          <p className="text-[var(--color-text-secondary)] text-xs uppercase flex items-center gap-1">
            <Activity size={10} /> Séances (période)
          </p>
          <p className="tf-number-large" style={{color:"var(--color-info)"}}>
            {Object.values(weekTotals).reduce((a, b) => a + b, 0)}
          </p>
        </div>
        <div className="tf-stat">
          <p className="tf-stat-label">Semaines affichées</p>
          <p className="tf-number-large">S{weeks[0]} → S{weeks[weeks.length - 1]}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un membre..."
            className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
            data-testid="attendance-search"
          />
        </div>
        <Select value={selectedYear.toString()} onValueChange={(v) => { setSelectedYear(parseInt(v)); setStartWeek(1); }}>
          <SelectTrigger className="w-[120px] bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white" data-testid="attendance-year">
            <Calendar size={14} className="mr-2 text-[var(--color-text-secondary)]" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
            {[2023, 2024, 2025, 2026].map((y) => (
              <SelectItem key={y} value={y.toString()} className="text-white">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => shiftWeeks(-1)} disabled={startWeek <= 1} className="text-[var(--color-text-secondary)]" data-testid="prev-weeks">
            <ChevronLeft size={16} />
          </Button>
          <span className="text-[var(--color-text-secondary)] text-sm min-w-[80px] text-center">
            S{weeks[0]} - S{weeks[weeks.length - 1]}
          </span>
          <Button variant="ghost" size="sm" onClick={() => shiftWeeks(1)} disabled={startWeek + weeksToShow > 52} className="text-[var(--color-text-secondary)]" data-testid="next-weeks">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Attendance Grid */}
      <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left text-[var(--color-text-secondary)] text-xs uppercase py-3 px-4 sticky left-0 bg-[var(--color-bg-secondary)] z-10 min-w-[200px]">
                Membre
              </th>
              {weeks.map((w) => (
                <th key={w} className="text-center text-[var(--color-text-secondary)] text-xs uppercase py-3 px-1 min-w-[60px]">
                  <div>S{w}</div>
                  <div className="text-[var(--color-text-tertiary)] text-[10px] font-normal">{getWeekDateRange(selectedYear, w)}</div>
                </th>
              ))}
              <th className="text-center text-[var(--color-text-secondary)] text-xs uppercase py-3 px-3 min-w-[60px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {membersLoading ? (
              <tr>
                <td colSpan={weeks.length + 2} className="text-center text-[var(--color-text-secondary)] py-8">
                  Chargement...
                </td>
              </tr>
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={weeks.length + 2} className="text-center text-[var(--color-text-secondary)] py-8">
                  Aucun membre trouvé
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={member.id} className="border-b border-[var(--color-border)] hover:bg-white/[0.02]" data-testid={`attendance-row-${member.id}`}>
                  <td className="py-2 px-4 sticky left-0 bg-[var(--color-bg-secondary)] z-10">
                    <div>
                      <p className="text-white text-sm font-medium">{member.name}</p>
                      <p className="text-[var(--color-text-tertiary)] text-xs">{member.membership}</p>
                    </div>
                  </td>
                  {weeks.map((w) => {
                    const val = trainingMap[`${member.id}_${w}`] || 0;
                    return (
                      <td key={w} className="py-2 px-1 text-center">
                        <input
                          key={`${member.id}_${w}_${val}`}
                          type="number"
                          min="0"
                          max="7"
                          defaultValue={val}
                          onBlur={(e) => handleCellBlur(member.id, w, e.target.value)}
                          onChange={(e) => {
                            pendingUpdates.current[`${member.id}_${w}`] = parseInt(e.target.value) || 0;
                          }}
                          className={`w-12 h-8 text-center rounded border-0 text-sm font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none ${getCellBg(val)} ${getCellColor(val)}`}
                          data-testid={`cell-${member.id}-w${w}`}
                        />
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-center">
                    <Badge className={`border-0 ${memberTotals[member.id] > 0 ? "bg-[rgba(10,132,255,0.15)] text-[var(--color-info)]" : "bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)]"}`}>
                      {memberTotals[member.id] || 0}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filteredMembers.length > 0 && (
            <tfoot>
              <tr className="border-t border-[var(--color-border)]">
                <td className="py-3 px-4 sticky left-0 bg-[var(--color-bg-secondary)] z-10">
                  <p className="text-[var(--color-text-secondary)] text-sm font-medium">Total / semaine</p>
                </td>
                {weeks.map((w) => (
                  <td key={w} className="py-3 px-1 text-center">
                    <span className={`text-sm font-bold ${weekTotals[w] > 0 ? "text-[var(--color-info)]" : "text-[var(--color-text-tertiary)]"}`}>
                      {weekTotals[w] || 0}
                    </span>
                  </td>
                ))}
                <td className="py-3 px-3 text-center">
                  <span className="text-sm font-bold text-[var(--color-info)]">
                    {Object.values(weekTotals).reduce((a, b) => a + b, 0)}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[rgba(255,69,58,0.15)]" /> 1 séance</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[rgba(255,214,10,0.15)]" /> 2 séances</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[rgba(255,214,10,0.15)]" /> 3 séances</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[rgba(48,209,88,0.15)]" /> 4+ séances</span>
      </div>
    </div>
  );
}
