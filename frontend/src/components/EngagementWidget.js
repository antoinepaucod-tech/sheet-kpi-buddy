import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Activity, CalendarClock, PauseCircle, AlertTriangle, Smile } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  engaged: {
    label: "Engagé",
    color: "text-[var(--color-success)]",
    bg: "bg-[rgba(48,209,88,0.08)]",
    border: "border-l-[var(--color-success)]",
    Icon: Smile,
  },
  moderate: {
    label: "Modéré",
    color: "text-[var(--color-warning)]",
    bg: "bg-[rgba(255,214,10,0.08)]",
    border: "border-l-[var(--color-warning)]",
    Icon: Activity,
  },
  at_risk: {
    label: "À risque",
    color: "text-[var(--color-danger)]",
    bg: "bg-[rgba(255,69,58,0.08)]",
    border: "border-l-[var(--color-danger)]",
    Icon: AlertTriangle,
  },
  on_pause: {
    label: "En pause",
    color: "text-[var(--color-warning)]",
    bg: "bg-[rgba(255,214,10,0.08)]",
    border: "border-l-[var(--color-warning)]",
    Icon: PauseCircle,
  },
  not_tracked: {
    label: "Non tracé",
    color: "text-[var(--color-text-secondary)]",
    bg: "bg-[rgba(255,255,255,0.05)]",
    border: "border-l-[var(--color-border)]",
    Icon: Activity,
  },
};

function formatDateFr(iso) {
  if (!iso) return null;
  try {
    return format(parseISO(iso), "EEEE d MMMM yyyy", { locale: fr });
  } catch {
    return iso;
  }
}

/**
 * EngagementWidget — Sprint D Bonus.
 * Loads GET /api/members/{id} to get engagement_recent and renders a compact card.
 * Returns null if the member is archived (server returns engagement_recent=null).
 */
export function EngagementWidget({ memberId }) {
  const { data: member, isLoading } = useQuery({
    queryKey: ["member-detail", memberId],
    queryFn: () => axios.get(`${API}/members/${memberId}`).then((r) => r.data),
    enabled: !!memberId,
  });

  if (!memberId) return null;
  if (isLoading) {
    return (
      <div className="tf-card p-3 text-xs text-[var(--color-text-tertiary)]" data-testid="engagement-widget-loading">
        Chargement engagement...
      </div>
    );
  }

  const eng = member?.engagement_recent;
  // Pas de widget si membre archivé (server renvoie null)
  if (!eng) return null;

  const cfg = STATUS_CONFIG[eng.status] || STATUS_CONFIG.not_tracked;
  const { Icon } = cfg;
  const lastDate = formatDateFr(eng.last_session_date);

  return (
    <div
      className={`tf-card p-4 border-l-4 ${cfg.border} ${cfg.bg}`}
      data-testid="engagement-widget"
      data-engagement-status={eng.status}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider font-text mb-1 flex items-center gap-1.5">
            <Icon size={12} className={cfg.color} />
            Engagement récent (4 dernières semaines)
          </p>
          <div className="flex items-baseline gap-3">
            {eng.status === "not_tracked" ? (
              <p className={`text-lg font-bold ${cfg.color} font-display`}>
                Non tracé
              </p>
            ) : (
              <>
                <p
                  className={`text-3xl font-bold ${cfg.color} font-display`}
                  data-testid="engagement-sessions-count"
                >
                  {eng.sessions_last_4_weeks}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] font-text">
                  séance{eng.sessions_last_4_weeks !== 1 ? "s" : ""} sur 4 sem.
                </p>
                <span
                  className={`ml-2 text-[11px] font-mono font-bold px-2 py-0.5 rounded ${cfg.color} ${cfg.bg} border border-current`}
                  data-testid="engagement-status-badge"
                >
                  {cfg.label}
                </span>
              </>
            )}
          </div>
          {eng.status === "not_tracked" && (
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1 font-text">
              Catégorie « {eng.category} » — les séances ne sont pas saisies pour ce type de membre.
            </p>
          )}
        </div>

        {eng.status !== "not_tracked" && (
          <div className="text-right">
            <p className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider font-text mb-1 flex items-center gap-1 justify-end">
              <CalendarClock size={12} />
              Dernière séance
            </p>
            <p className="text-white text-sm font-text" data-testid="engagement-last-session">
              {lastDate || "Aucune"}
            </p>
            {eng.last_session_iso_week && (
              <p className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                {eng.last_session_iso_week}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
