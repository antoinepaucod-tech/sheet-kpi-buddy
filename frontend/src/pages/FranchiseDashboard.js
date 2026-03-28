import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
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
  HelpCircle,
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
  const [syncStatus, setSyncStatus] = useState(null);
  const [supaSyncing, setSupaSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, trendRes, metaRes, syncRes] = await Promise.all([
        axios.get(`${API}/franchise/dashboard?month=${selectedMonth}`),
        axios.get(`${API}/franchise/trends?months=12`),
        axios.get(`${API}/meta/status`),
        axios.get(`${API}/sync/status`),
      ]);
      setData(dashRes.data);
      setTrends(trendRes.data);
      setMetaStatus(metaRes.data);
      setSyncStatus(syncRes.data);
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

  const handleSupabaseSync = async () => {
    setSupaSyncing(true);
    try {
      await axios.post(`${API}/sync/supabase/all`);
      const res = await axios.get(`${API}/sync/status`);
      setSyncStatus(res.data);
    } catch (err) {
      console.error("Supabase sync error:", err);
    } finally {
      setSupaSyncing(false);
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
          <div className="flex items-center gap-3">
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              Ad Spend ce mois : <strong style={{ color: "var(--color-accent)" }}>{formatCHF(metaStatus.current_month_spend)}</strong>
            </span>
            <Link to="/meta-help" style={{ color: "var(--color-text-tertiary)", display: "flex" }} title="Configuration Meta Ads">
              <HelpCircle size={16} />
            </Link>
          </div>
        )}
      </div>

      {/* Supabase Sync Status */}
      <div
        className="tf-card flex items-center justify-between"
        style={{
          padding: "0.75rem 1.25rem",
          background: syncStatus?.status === "ok"
            ? "rgba(34,197,94,0.08)"
            : syncStatus?.status === "error"
            ? "rgba(239,68,68,0.08)"
            : "rgba(148,163,184,0.08)",
          border: `1px solid ${
            syncStatus?.status === "ok"
              ? "rgba(34,197,94,0.3)"
              : syncStatus?.status === "error"
              ? "rgba(239,68,68,0.3)"
              : "rgba(148,163,184,0.3)"
          }`,
        }}
        data-testid="supabase-sync-banner"
      >
        <div className="flex items-center gap-3">
          {syncStatus?.status === "ok" ? (
            <Wifi size={16} style={{ color: "#22c55e" }} />
          ) : syncStatus?.status === "error" ? (
            <WifiOff size={16} style={{ color: "#ef4444" }} />
          ) : (
            <WifiOff size={16} style={{ color: "#94a3b8" }} />
          )}
          <div>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
              Supabase Sync : {syncStatus?.status === "ok" ? "OK" : syncStatus?.status === "error" ? "Erreur" : "Jamais"}
            </span>
            {syncStatus?.last_sync && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginLeft: "0.75rem" }}>
                Dernière sync : {new Date(syncStatus.last_sync).toLocaleString("fr-CH")}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleSupabaseSync}
          disabled={supaSyncing}
          className="tf-btn-outline flex items-center gap-2"
          style={{ fontSize: "var(--text-sm)" }}
          data-testid="supabase-sync-btn"
        >
          <RefreshCw className={supaSyncing ? "animate-spin" : ""} size={14} />
          {supaSyncing ? "Sync..." : "Sync maintenant"}
        </button>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard
          label="CA Total"
          value={formatCHF(t.total_revenue)}
          icon={<DollarSign size={16} />}
          color="#22c55e"
          testId="franchise-total-revenue"
        />
        <KpiCard
          label="Dépenses"
          value={formatCHF(t.total_expenses)}
          icon={<TrendingDown size={16} />}
          color="#ef4444"
          testId="franchise-total-expenses"
        />
        <KpiCard
          label="Ad Spend"
          value={formatCHF(t.ad_spend)}
          icon={<Megaphone size={16} />}
          color="#f59e0b"
          testId="franchise-ad-spend"
        />
        <KpiCard
          label="Membres"
          value={t.total_members}
          icon={<Users size={16} />}
          color="#3b82f6"
          testId="franchise-total-members"
        />
        <KpiCard
          label="Coachs"
          value={t.coach_members || 0}
          icon={<BarChart3 size={16} />}
          color="#06b6d4"
          testId="franchise-coach-members"
        />
        <KpiCard
          label="ACRM"
          value={formatCHF(t.acrm)}
          icon={<TrendingUp size={16} />}
          color="#8b5cf6"
          testId="franchise-acrm"
        />
        <KpiCard
          label="ROAS"
          value={t.roas ? `${t.roas}x` : "-"}
          icon={<Target size={16} />}
          color="#22c55e"
          testId="franchise-roas"
        />
        <KpiCard
          label="Résultat Net"
          value={formatCHF(t.net_profit)}
          icon={<DollarSign size={16} />}
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
                const roas = club.roas > 0 ? club.roas : (club.ad_spend > 0 ? (club.total_revenue / club.ad_spend).toFixed(2) : 0);
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
                      {club.meta_impressions > 0 ? club.meta_impressions.toLocaleString("fr-CH") : "-"}
                    </td>
                    <td className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>
                      {club.meta_clicks > 0 ? club.meta_clicks.toLocaleString("fr-CH") : "-"}
                    </td>
                    <td className="text-right py-2 px-3" style={{ color: "var(--color-text-secondary)" }}>
                      {club.meta_cpc > 0 ? formatCHF(club.meta_cpc) : "-"}
                    </td>
                    <td className="text-right py-2 px-3" style={{ color: roas > 0 ? "#22c55e" : "var(--color-text-tertiary)", fontWeight: "var(--font-semibold)" }}>
                      {roas > 0 ? `${roas}x` : "-"}
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
    <div className="tf-card" style={{ padding: "0.75rem 1rem", overflow: "hidden" }} data-testid={testId}>
      <div className="flex items-center gap-2 mb-1">
        <div style={{ color, flexShrink: 0 }}>{icon}</div>
        <span
          style={{
            fontSize: "11px",
            color: "var(--color-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: "var(--text-lg)",
          fontWeight: "var(--font-bold)",
          color: "var(--color-text-primary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
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
        <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
          <span><Users size={12} className="inline mr-1" />{club.active_members} mbr</span>
          {club.coach_members > 0 && (
            <span style={{ color: "#06b6d4" }}><BarChart3 size={12} className="inline mr-1" />{club.coach_members} coachs</span>
          )}
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
