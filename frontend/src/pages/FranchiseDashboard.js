import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import {
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  RefreshCw,
  BarChart3,
  Megaphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import { formatCHF } from "../utils/format";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FranchiseDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [metaStatus, setMetaStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, trendRes, metaRes] = await Promise.all([
        axios.get(`${API}/franchise/dashboard?month=${selectedMonth}`),
        axios.get(`${API}/franchise/trends?months=12`),
        axios.get(`${API}/meta/status`),
      ]);
      setData(dashRes.data);
      setTrends(trendRes.data);
      setMetaStatus(metaRes.data);
    } catch (err) {
      console.error("Franchise load error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMetaSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/meta/sync-ad-spend`);
      alert(
        `Meta Ads synchronisé : ${res.data.synced} mois mis à jour`
      );
      fetchData();
    } catch (err) {
      alert("Erreur de synchronisation Meta");
    } finally {
      setSyncing(false);
    }
  };

  if (user?.role !== "super_admin") {
    return (
      <div className="tf-card" style={{ textAlign: "center", padding: "3rem" }}>
        <Building2 size={48} style={{ color: "var(--color-text-tertiary)", margin: "0 auto 1rem" }} />
        <h2 style={{ color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
          Accès réservé
        </h2>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Le Dashboard Franchise est réservé au Super Admin.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "400px" }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: "var(--color-accent)" }} />
      </div>
    );
  }

  const t = data?.totals || {};
  const clubs = data?.clubs || [];
  const trendData = trends?.trends || [];

  // Find max revenue for bar scaling
  const maxRevenue = Math.max(...clubs.map((c) => c.total_revenue), 1);

  return (
    <div className="space-y-6" data-testid="franchise-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: "var(--font-bold)",
              color: "var(--color-text-primary)",
            }}
          >
            Dashboard Franchise
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
            Vue agrégée de {data?.club_count || 0} clubs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="tf-input"
            style={{ width: "180px" }}
            data-testid="franchise-month-selector"
          />
          {/* Meta sync button */}
          <button
            onClick={handleMetaSync}
            disabled={syncing}
            className="tf-btn-outline flex items-center gap-2"
            style={{ fontSize: "var(--text-sm)" }}
            data-testid="meta-sync-btn"
          >
            {syncing ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : (
              <Megaphone size={14} />
            )}
            Sync Meta Ads
          </button>
        </div>
      </div>

      {/* Meta Status Banner */}
      <div
        className="tf-card flex items-center justify-between"
        style={{
          padding: "0.75rem 1.25rem",
          background: metaStatus?.connected
            ? "rgba(34,197,94,0.08)"
            : "rgba(239,68,68,0.08)",
          border: `1px solid ${metaStatus?.connected ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}
        data-testid="meta-status-banner"
      >
        <div className="flex items-center gap-3">
          {metaStatus?.connected ? (
            <Wifi size={16} style={{ color: "#22c55e" }} />
          ) : (
            <WifiOff size={16} style={{ color: "#ef4444" }} />
          )}
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
            Meta Ads API : {metaStatus?.connected ? "Connecté" : "Non connecté"}
          </span>
        </div>
        {metaStatus?.connected && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
            Ad Spend ce mois : <strong style={{ color: "var(--color-accent)" }}>{formatCHF(metaStatus.current_month_spend)}</strong>
          </span>
        )}
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KpiCard
          label="CA Total"
          value={formatCHF(t.total_revenue)}
          icon={<DollarSign size={18} />}
          color="#22c55e"
          testId="franchise-total-revenue"
        />
        <KpiCard
          label="Dépenses"
          value={formatCHF(t.total_expenses)}
          icon={<TrendingDown size={18} />}
          color="#ef4444"
          testId="franchise-total-expenses"
        />
        <KpiCard
          label="Ad Spend"
          value={formatCHF(t.ad_spend)}
          icon={<Megaphone size={18} />}
          color="#f59e0b"
          testId="franchise-ad-spend"
        />
        <KpiCard
          label="Membres"
          value={t.total_members}
          icon={<Users size={18} />}
          color="#3b82f6"
          testId="franchise-total-members"
        />
        <KpiCard
          label="ACRM"
          value={formatCHF(t.acrm)}
          icon={<TrendingUp size={18} />}
          color="#8b5cf6"
          testId="franchise-acrm"
        />
        <KpiCard
          label="Résultat Net"
          value={formatCHF(t.net_profit)}
          icon={<Target size={18} />}
          color={t.net_profit >= 0 ? "#22c55e" : "#ef4444"}
          testId="franchise-net-profit"
        />
      </div>

      {/* Club Comparison */}
      <div className="tf-card" data-testid="franchise-club-comparison">
        <h2
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-semibold)",
            color: "var(--color-text-primary)",
            marginBottom: "1rem",
          }}
        >
          Comparatif par Club
        </h2>
        <div className="space-y-4">
          {clubs.map((club) => (
            <ClubRow
              key={club.club_id}
              club={club}
              maxRevenue={maxRevenue}
            />
          ))}
        </div>
      </div>

      {/* Revenue Trends */}
      {trendData.length > 0 && (
        <div className="tf-card" data-testid="franchise-trends">
          <h2
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-text-primary)",
              marginBottom: "1rem",
            }}
          >
            Evolution Mensuelle (CA)
          </h2>
          <div className="space-y-3">
            {trendData.map((t) => {
              const maxRev = Math.max(
                ...trendData.map((x) => x.revenue),
                1
              );
              return (
                <div key={t.month} className="flex items-center gap-3">
                  <span
                    style={{
                      width: "70px",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    {t.month}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "24px",
                      background: "var(--color-bg-tertiary)",
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: `${(t.revenue / maxRev) * 100}%`,
                        height: "100%",
                        background: "var(--color-accent)",
                        borderRadius: "var(--radius-sm)",
                        transition: "width 0.5s ease",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "11px",
                        fontWeight: "var(--font-semibold)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {formatCHF(t.revenue)}
                    </span>
                  </div>
                  <span
                    style={{
                      width: "80px",
                      fontSize: "var(--text-xs)",
                      color: "#f59e0b",
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    Ad: {formatCHF(t.ad_spend)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ad Budget per Club */}
      <div className="tf-card" data-testid="franchise-ad-budgets">
        <h2
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-semibold)",
            color: "var(--color-text-primary)",
            marginBottom: "1rem",
          }}
        >
          Budget Publicitaire par Club
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>Club</th>
                <th className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>Ad Spend</th>
                <th className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>Impressions</th>
                <th className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>Clicks</th>
                <th className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>CPC</th>
                <th className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((club) => {
                const roas = club.ad_spend > 0
                  ? (club.total_revenue / club.ad_spend).toFixed(2)
                  : "-";
                return (
                  <tr
                    key={club.club_id}
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                  >
                    <td className="py-2 px-3" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-medium)" }}>
                      {club.club_name}
                    </td>
                    <td className="text-right py-2 px-3" style={{ color: "#f59e0b", fontWeight: "var(--font-semibold)" }}>
                      {formatCHF(club.ad_spend)}
                    </td>
                    <td className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>
                      -
                    </td>
                    <td className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>
                      -
                    </td>
                    <td className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>
                      -
                    </td>
                    <td className="text-right py-2 px-3" style={{ color: roas !== "-" ? "#22c55e" : "var(--color-text-tertiary)", fontWeight: "var(--font-semibold)" }}>
                      {roas !== "-" ? `${roas}x` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, color, testId }) {
  return (
    <div className="tf-card" style={{ padding: "1rem" }} data-testid={testId}>
      <div className="flex items-center gap-2 mb-2">
        <div style={{ color }}>{icon}</div>
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: "var(--text-xl)",
          fontWeight: "var(--font-bold)",
          color: "var(--color-text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ClubRow({ club, maxRevenue }) {
  const pct = maxRevenue > 0 ? (club.total_revenue / maxRevenue) * 100 : 0;
  const isActive = club.active_members > 0;

  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "var(--radius-md)",
        background: "var(--color-bg-tertiary)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Building2 size={14} style={{ color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)" }} />
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-text-primary)",
            }}
          >
            {club.club_name}
          </span>
          {!isActive && (
            <span
              style={{
                fontSize: "10px",
                color: "var(--color-text-tertiary)",
                background: "var(--color-bg-secondary)",
                padding: "1px 6px",
                borderRadius: "var(--radius-sm)",
              }}
            >
              Aucune donnée
            </span>
          )}
        </div>
        <div className="flex items-center gap-4" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
          <span><Users size={12} className="inline mr-1" />{club.active_members} membres</span>
          <span style={{ color: "#f59e0b" }}><Megaphone size={12} className="inline mr-1" />{formatCHF(club.ad_spend)}</span>
          <span style={{ fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)" }}>
            {formatCHF(club.total_revenue)}
          </span>
        </div>
      </div>
      {/* Revenue bar */}
      <div
        style={{
          height: "6px",
          background: "var(--color-bg-secondary)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: isActive
              ? "var(--color-accent)"
              : "var(--color-text-tertiary)",
            borderRadius: "3px",
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}
