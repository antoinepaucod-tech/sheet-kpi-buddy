import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Search, ExternalLink, Loader2 } from "lucide-react";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_BADGE = {
  HG: "bg-[rgba(48,209,88,0.12)] text-[var(--color-success)] border-0",
  Coach: "bg-[rgba(10,132,255,0.12)] text-[var(--color-accent)] border-0",
  Partenaire: "bg-[rgba(191,90,242,0.15)] text-[#BF5AF2] border-0",
  IFRC: "bg-[rgba(255,159,10,0.15)] text-[#FF9F0A] border-0",
  Challenge: "bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)] border-0",
};

const PERIOD_OPTIONS = [
  { value: "1", label: "1 semaine" },
  { value: "2", label: "2 semaines" },
  { value: "3", label: "3 semaines" },
  { value: "4", label: "4 semaines" },
];

function formatLastSession(isoWeek) {
  if (!isoWeek) return "Aucune saisie";
  return isoWeek; // ex: "2026-W15"
}

function formatWeeksWithout(n) {
  if (n === 999) return "Aucune saisie";
  if (n <= 0) return "Cette semaine";
  if (n === 1) return "1 semaine";
  return `${n} semaines`;
}

export default function AtRiskMembersPage() {
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState("2");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["members-at-risk", weeks],
    queryFn: () =>
      axios.get(`${API}/members/at-risk?weeks=${weeks}`).then((r) => r.data),
  });

  const period = data?.period;
  const total = data?.total ?? 0;
  const allMembers = data?.members ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return allMembers;
    const q = search.trim().toLowerCase();
    return allMembers.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.membership || "").toLowerCase().includes(q),
    );
  }, [allMembers, search]);

  return (
    <div className="space-y-6" data-testid="at-risk-page">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white font-display flex items-center gap-2">
            <AlertTriangle className="text-[var(--color-danger)]" size={22} />
            Membres à risques
          </h1>
          <p className="text-sm text-[var(--color-text-tertiary)] font-text mt-1">
            Membres actifs sans aucune séance enregistrée sur la période sélectionnée.
            <span className="text-[var(--color-text-secondary)] ml-1">
              Exclus : OpenGym, Inconnu, Prêt, membres en pause.
            </span>
          </p>
        </div>
        <Select value={weeks} onValueChange={setWeeks}>
          <SelectTrigger
            className="w-[180px] bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
            data-testid="at-risk-period-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem
                key={o.value}
                value={o.value}
                className="text-white focus:bg-[rgba(255,255,255,0.1)]"
              >
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Counter card */}
      <div className="tf-card p-4 flex items-center justify-between gap-4 border-l-4 border-l-[var(--color-danger)]">
        <div>
          <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-text">
            Membres à risques sur la période
          </p>
          <p
            className="text-3xl font-bold text-[var(--color-danger)] font-display mt-1"
            data-testid="at-risk-counter"
          >
            {total}
          </p>
          {period && (
            <p className="text-xs text-[var(--color-text-secondary)] font-mono mt-1">
              Période : {period.iso_weeks.join(", ")}
            </p>
          )}
        </div>
        <div className="flex-1 max-w-md relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
          <Input
            placeholder="Rechercher un membre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
            data-testid="at-risk-search"
          />
        </div>
      </div>

      {/* Table */}
      <div className="tf-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-[var(--color-accent)]" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <AlertTriangle className="text-[var(--color-text-tertiary)] mb-2" size={28} />
            <p className="text-[var(--color-text-secondary)] font-text text-sm">
              {total === 0
                ? "Aucun membre à risque sur la période sélectionnée 🎉"
                : "Aucun résultat pour cette recherche"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                {["Membre", "Catégorie", "Dernière séance", "Semaines sans séance", "Abonnement", ""].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[var(--color-text-secondary)] uppercase tracking-wider text-xs font-text"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow
                  key={m.id}
                  className="border-[var(--color-border)] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                  data-testid={`at-risk-row-${m.id}`}
                >
                  <TableCell className="text-white font-medium text-sm">{m.name}</TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] font-mono px-2 py-0.5 ${
                        CATEGORY_BADGE[m.category] ||
                        "bg-[rgba(255,255,255,0.08)] text-[var(--color-text-secondary)] border-0"
                      }`}
                    >
                      {m.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--color-text-secondary)]">
                    {formatLastSession(m.last_session_iso_week)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-mono text-sm font-bold ${
                        m.weeks_without_session >= 4
                          ? "text-[var(--color-danger)]"
                          : m.weeks_without_session >= 2
                            ? "text-[var(--color-warning)]"
                            : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {formatWeeksWithout(m.weeks_without_session)}
                    </span>
                  </TableCell>
                  <TableCell className="text-[var(--color-text-secondary)] text-xs max-w-[180px] truncate" title={m.membership}>
                    {m.membership || "-"}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => navigate(`/members?search=${encodeURIComponent(m.name)}`)}
                      className="text-[var(--color-accent)] hover:underline text-xs flex items-center gap-1"
                      data-testid={`at-risk-view-${m.id}`}
                    >
                      Voir <ExternalLink size={10} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
