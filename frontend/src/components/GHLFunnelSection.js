import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle, UserPlus, Calendar, Eye, Trophy, UserX, Phone, Save } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { formatCHF } from "../utils/format";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FUNNEL_STAGES = [
  { key: "new_leads", label: "New Leads", labelFr: "Nouveaux Leads", icon: UserPlus, color: "#0A84FF" },
  { key: "confirmed_appointment", label: "Confirmed Apt.", labelFr: "RDV Confirmes", icon: Calendar, color: "#30D158" },
  { key: "cancelled", label: "Cancelled", labelFr: "Annules", icon: XCircle, color: "#FF9F0A" },
  { key: "no_showed", label: "No Show", labelFr: "Absents", icon: AlertTriangle, color: "#FF453A" },
  { key: "showed_sold", label: "Showed Sold", labelFr: "Ventes", icon: Trophy, color: "#30D158" },
  { key: "showed_lost", label: "Showed Lost", labelFr: "Perdus", icon: UserX, color: "#FF453A" },
];

const SUBSCRIPTION_TYPES = [
  { value: "6 Week Challenge", label: "6 Week Challenge", defaultAmount: 599 },
  { value: "Mensuel", label: "Mensuel", defaultAmount: 120 },
  { value: "3 Mois", label: "3 Mois", defaultAmount: 350 },
  { value: "6 Mois", label: "6 Mois", defaultAmount: 650 },
  { value: "Annuel", label: "Annuel", defaultAmount: 1200 },
  { value: "Annuel PT", label: "Annuel PT", defaultAmount: 2400 },
];

export function GHLFunnelSection({ currentMonth, lang, onKpiRefresh, onMonthChange }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [saleForm, setSaleForm] = useState({ subscription_type: "6 Week Challenge", cash_collected: 599 });
  const [confirmingSale, setConfirmingSale] = useState(false);
  const [confirmedSales, setConfirmedSales] = useState([]);

  // Date filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Calls made state
  const [callsMade, setCallsMade] = useState(0);
  const [callsSaving, setCallsSaving] = useState(false);
  const [callsSaved, setCallsSaved] = useState(false);

  const fetchLastSync = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ghl/last-sync`);
      if (res.data.status === "success") {
        setLastSync(res.data);
        if (res.data.start_date) setStartDate(res.data.start_date);
        if (res.data.end_date) setEndDate(res.data.end_date);
      }
    } catch {
      // no sync yet
    }
  }, []);

  const fetchSales = useCallback(async () => {
    if (!currentMonth) return;
    try {
      const res = await axios.get(`${API}/ghl/sales/${currentMonth}`);
      setConfirmedSales(res.data);
    } catch {
      // ignore
    }
  }, [currentMonth]);

  // Fetch calls_made from KPI
  const fetchCallsMade = useCallback(async () => {
    if (!currentMonth) return;
    try {
      const res = await axios.get(`${API}/monthly-kpis/${currentMonth}`);
      setCallsMade(res.data?.calls_made || 0);
    } catch {
      // ignore
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchLastSync();
    fetchSales();
    fetchCallsMade();
  }, [fetchLastSync, fetchSales, fetchCallsMade]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const url = `${API}/ghl/sync${params.toString() ? `?${params}` : ""}`;
      const res = await axios.post(url);
      setLastSync(res.data);
      // Switch dashboard to the synced month
      if (res.data.kpi_month && onMonthChange) {
        onMonthChange(res.data.kpi_month);
      }
      onKpiRefresh?.();
      fetchSales();
      fetchCallsMade();
      // Auto-open sale dialog for first unconfirmed "Showed Sold"
      const soldOpps = res.data?.funnel_opportunities?.showed_sold || [];
      if (soldOpps.length > 0) {
        // Will check which are unconfirmed after sales are fetched
        const salesRes = await axios.get(`${API}/ghl/sales/${res.data.kpi_month || currentMonth}`);
        const confirmedIds = new Set(salesRes.data.map(s => s.opportunity_id));
        const firstUnconfirmed = soldOpps.find(o => !confirmedIds.has(o.id));
        if (firstUnconfirmed) {
          handleOpenSaleDialog(firstUnconfirmed);
        }
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.message;
      setSyncError(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveCalls = async () => {
    setCallsSaving(true);
    setCallsSaved(false);
    try {
      await axios.patch(`${API}/ghl/calls-made`, {
        month: currentMonth,
        calls_made: callsMade,
      });
      setCallsSaved(true);
      onKpiRefresh?.();
      setTimeout(() => setCallsSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setCallsSaving(false);
    }
  };

  const handleOpenSaleDialog = (opp) => {
    setSelectedOpp(opp);
    setSaleForm({ subscription_type: "6 Week Challenge", cash_collected: 599 });
    setSaleDialogOpen(true);
  };

  const handleConfirmSale = async () => {
    if (!selectedOpp) return;
    setConfirmingSale(true);
    try {
      await axios.post(`${API}/ghl/confirm-sale`, {
        opportunity_id: selectedOpp.id,
        opportunity_name: selectedOpp.name,
        contact_email: selectedOpp.email || "",
        contact_phone: selectedOpp.phone || "",
        subscription_type: saleForm.subscription_type,
        cash_collected: saleForm.cash_collected,
        month: currentMonth,
      });
      setSaleDialogOpen(false);
      const salesRes = await axios.get(`${API}/ghl/sales/${currentMonth}`);
      setConfirmedSales(salesRes.data);
      onKpiRefresh?.();

      // Auto-open next unconfirmed sale
      const soldOpps = funnelOpps.showed_sold || [];
      const confirmedIds = new Set(salesRes.data.map(s => s.opportunity_id));
      const nextUnconfirmed = soldOpps.find(o => !confirmedIds.has(o.id));
      if (nextUnconfirmed) {
        setTimeout(() => handleOpenSaleDialog(nextUnconfirmed), 300);
      }
    } catch {
      // handle error
    } finally {
      setConfirmingSale(false);
    }
  };

  const funnel = lastSync?.funnel || {
    new_leads: 0, confirmed_appointment: 0, cancelled: 0,
    no_showed: 0, showed_sold: 0, showed_lost: 0,
  };
  const funnelOpps = lastSync?.funnel_opportunities || {};
  const totalOpportunities = lastSync?.total_opportunities || 0;
  const cashFromGHL = lastSync?.cash_from_ghl || 0;
  const totalLeads = totalOpportunities || 1;
  const maxVal = Math.max(...Object.values(funnel), 1);

  const isSaleConfirmed = (oppId) => confirmedSales.some(s => s.opportunity_id === oppId);

  const inputStyle = {
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-display)',
    fontFeatureSettings: '"tnum" 1',
  };

  return (
    <div className="space-y-4" data-testid="ghl-funnel-section">
      {/* Date Filters + Sync Button */}
      <div className="tf-card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <h3 className="tf-label" style={{ fontSize: 'var(--text-sm)' }}>
              {lang === "fr" ? "Entonnoir GoHighLevel" : "GoHighLevel Funnel"}
            </h3>
            {lastSync && (
              <span className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                <CheckCircle2 size={10} style={{ color: 'var(--color-success)' }} />
                {new Date(lastSync.synced_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                })}
              </span>
            )}
          </div>
          <Button
            onClick={handleSync}
            disabled={syncing}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5"
            data-testid="ghl-sync-btn"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing
              ? (lang === "fr" ? "Synchronisation..." : "Syncing...")
              : (lang === "fr" ? "Synchroniser GHL" : "Sync GHL")}
          </Button>
        </div>

        {/* Date Range Filters */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
              {lang === "fr" ? "Date debut" : "Start Date"}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 rounded-md"
              style={inputStyle}
              data-testid="ghl-start-date"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
              {lang === "fr" ? "Date fin" : "End Date"}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 rounded-md"
              style={inputStyle}
              data-testid="ghl-end-date"
            />
          </div>
          <Button
            onClick={() => { setStartDate(""); setEndDate(""); }}
            variant="ghost"
            size="sm"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', padding: '8px 10px' }}
            data-testid="ghl-clear-dates"
          >
            {lang === "fr" ? "Effacer" : "Clear"}
          </Button>
        </div>
      </div>

      {/* Sync Error */}
      {syncError && (
        <div
          className="flex items-start gap-2 p-3 rounded-lg"
          style={{
            background: 'rgba(255, 69, 58, 0.08)',
            border: '1px solid rgba(255, 69, 58, 0.2)',
          }}
          data-testid="ghl-sync-error"
        >
          <XCircle size={14} style={{ color: 'var(--color-danger)', marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)' }}>
              {lang === "fr" ? "Erreur de synchronisation" : "Sync Error"}
            </p>
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 2 }}>
              {syncError.includes("401")
                ? (lang === "fr"
                  ? "Cle API GHL invalide ou expiree. Verifiez votre cle dans les parametres."
                  : "Invalid or expired GHL API key. Check your key in settings.")
                : syncError}
            </p>
          </div>
        </div>
      )}

      {/* Calls Made Input */}
      <div className="tf-card">
        <div className="flex items-center gap-3">
          <Phone size={14} style={{ color: 'var(--color-accent)', opacity: 0.7 }} />
          <label className="tf-label" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>
            {lang === "fr" ? "Appels passes" : "Calls Made"}
          </label>
          <input
            type="number"
            value={callsMade}
            onChange={(e) => { setCallsMade(parseInt(e.target.value) || 0); setCallsSaved(false); }}
            className="w-24 p-1.5 rounded-md text-center"
            style={inputStyle}
            min={0}
            data-testid="ghl-calls-input"
          />
          <Button
            onClick={handleSaveCalls}
            disabled={callsSaving}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            style={{
              borderColor: callsSaved ? 'var(--color-success)' : 'var(--color-border)',
              color: callsSaved ? 'var(--color-success)' : 'var(--color-text-secondary)',
              fontSize: 'var(--text-xs)',
              padding: '4px 10px',
            }}
            data-testid="ghl-save-calls"
          >
            {callsSaving ? <Loader2 size={10} className="animate-spin" /> : callsSaved ? <CheckCircle2 size={10} /> : <Save size={10} />}
            {callsSaved ? (lang === "fr" ? "Sauvegarde" : "Saved") : (lang === "fr" ? "Sauvegarder" : "Save")}
          </Button>
          {totalOpportunities > 0 && callsMade > 0 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFeatureSettings: '"tnum" 1' }}>
              ({Math.round((callsMade / totalOpportunities) * 100)}%)
            </span>
          )}
        </div>
      </div>

      {/* Visual Funnel */}
      <div className="tf-card" data-testid="ghl-funnel-visual">
        {/* Total leads header */}
        {lastSync && totalOpportunities > 0 && (
          <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {lang === "fr" ? "Total Opportunites Pipeline" : "Total Pipeline Opportunities"}
              {(startDate || endDate) && (
                <span style={{ marginLeft: 8, color: 'var(--color-accent)', textTransform: 'none' }}>
                  {startDate && endDate ? `${startDate} → ${endDate}` : startDate ? `${lang === "fr" ? "Depuis" : "From"} ${startDate}` : `${lang === "fr" ? "Jusqu'au" : "Until"} ${endDate}`}
                </span>
              )}
            </span>
            <span style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-display)',
              fontFeatureSettings: '"tnum" 1',
            }}>
              {totalOpportunities}
            </span>
          </div>
        )}
        <div className="space-y-2">
          {FUNNEL_STAGES.map((stage) => {
            const count = funnel[stage.key] || 0;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            const barWidth = maxVal > 0 ? Math.max((count / maxVal) * 100, 4) : 4;
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="group" data-testid={`funnel-stage-${stage.key}`}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-36 flex-shrink-0">
                    <Icon size={13} style={{ color: stage.color, opacity: 0.8 }} />
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-display)',
                    }}>
                      {lang === "fr" ? stage.labelFr : stage.label}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div
                      style={{
                        height: '24px',
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${stage.color}33, ${stage.color}66)`,
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${stage.color}44`,
                        transition: 'width 0.6s ease',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '8px',
                        minWidth: '40px',
                      }}
                    >
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 'var(--font-bold)',
                        color: stage.color,
                        fontFamily: 'var(--font-display)',
                        fontFeatureSettings: '"tnum" 1',
                        whiteSpace: 'nowrap',
                      }}>
                        {count}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      color: 'var(--color-text-tertiary)',
                      fontFamily: 'var(--font-display)',
                      fontFeatureSettings: '"tnum" 1',
                    }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversion rates + cash row */}
        {lastSync && (
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            {[
              {
                label: lang === "fr" ? "Taux RDV" : "Apt. Rate",
                value: totalOpportunities > 0 ? `${Math.round((funnel.confirmed_appointment / totalOpportunities) * 100)}%` : "0%",
              },
              {
                label: lang === "fr" ? "Taux Presence" : "Show Rate",
                value: (funnel.confirmed_appointment + funnel.no_showed + funnel.showed_sold + funnel.showed_lost) > 0
                  ? `${Math.round(((funnel.showed_sold + funnel.showed_lost) / (funnel.confirmed_appointment + funnel.no_showed + funnel.showed_sold + funnel.showed_lost)) * 100)}%`
                  : "0%",
              },
              {
                label: lang === "fr" ? "Taux Closing" : "Close Rate",
                value: (funnel.showed_sold + funnel.showed_lost) > 0
                  ? `${Math.round((funnel.showed_sold / (funnel.showed_sold + funnel.showed_lost)) * 100)}%`
                  : "0%",
              },
              {
                label: lang === "fr" ? "Cash GHL" : "GHL Cash",
                value: formatCHF(cashFromGHL),
                color: 'var(--color-success)',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </p>
                <p style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-bold)',
                  color: color || 'var(--color-accent)',
                  fontFamily: 'var(--font-display)',
                  fontFeatureSettings: '"tnum" 1',
                }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Showed Sold Opportunities - Confirm Sales */}
      {funnelOpps.showed_sold && funnelOpps.showed_sold.length > 0 && (
        <div className="tf-card" data-testid="ghl-showed-sold-list">
          <p className="tf-label" style={{ marginBottom: 'var(--space-3)' }}>
            {lang === "fr" ? "Ventes a Confirmer" : "Sales to Confirm"}
            <span style={{ color: 'var(--color-success)', marginLeft: 8 }}>{funnelOpps.showed_sold.length}</span>
          </p>
          <div className="space-y-2">
            {funnelOpps.showed_sold.map((opp) => {
              const confirmed = isSaleConfirmed(opp.id);
              return (
                <div
                  key={opp.id}
                  className="flex items-center justify-between p-2.5 rounded-lg"
                  style={{
                    background: confirmed ? 'rgba(48, 209, 88, 0.06)' : 'var(--color-bg-secondary)',
                    border: `1px solid ${confirmed ? 'rgba(48, 209, 88, 0.2)' : 'var(--color-border)'}`,
                  }}
                  data-testid={`opp-${opp.id}`}
                >
                  <div className="flex items-center gap-2">
                    {confirmed ? (
                      <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
                    ) : (
                      <Trophy size={14} style={{ color: 'var(--color-warning)' }} />
                    )}
                    <div>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                        {opp.name}
                      </p>
                      {opp.monetary_value > 0 && (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                          GHL: {formatCHF(opp.monetary_value)}
                        </p>
                      )}
                    </div>
                  </div>
                  {!confirmed ? (
                    <Button
                      onClick={() => handleOpenSaleDialog(opp)}
                      size="sm"
                      style={{
                        fontSize: 'var(--text-xs)',
                        background: 'var(--color-accent)',
                        color: '#fff',
                        padding: '4px 12px',
                      }}
                      data-testid={`confirm-sale-${opp.id}`}
                    >
                      {lang === "fr" ? "Confirmer" : "Confirm"}
                    </Button>
                  ) : (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
                      {lang === "fr" ? "Confirme" : "Confirmed"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No sync yet message */}
      {!lastSync && !syncing && !syncError && (
        <div className="tf-card flex flex-col items-center justify-center py-8" data-testid="ghl-no-sync">
          <RefreshCw size={24} style={{ color: 'var(--color-text-tertiary)', marginBottom: 12, opacity: 0.5 }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
            {lang === "fr"
              ? "Cliquez sur 'Synchroniser GHL' pour importer vos donnees de pipeline"
              : "Click 'Sync GHL' to import your pipeline data"}
          </p>
        </div>
      )}

      {/* Sale Confirmation Dialog */}
      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent className="bg-[var(--color-bg-primary)] border-[var(--color-border)] h-fit my-auto" style={{ maxWidth: '420px' }}>
          <DialogHeader>
            <DialogTitle className="font-display" style={{ color: 'var(--color-text-primary)' }}>
              {lang === "fr" ? "Confirmer la vente" : "Confirm Sale"}
            </DialogTitle>
          </DialogHeader>
          {selectedOpp && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                  {selectedOpp.name}
                </p>
                {(selectedOpp.email || selectedOpp.phone) && (
                  <div className="mt-1.5 space-y-0.5">
                    {selectedOpp.email && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{selectedOpp.email}</p>
                    )}
                    {selectedOpp.phone && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{selectedOpp.phone}</p>
                    )}
                  </div>
                )}
                {selectedOpp.monetary_value > 0 && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', marginTop: 4 }}>
                    GHL: {formatCHF(selectedOpp.monetary_value)}
                  </p>
                )}
              </div>

              <div>
                <label className="tf-label" style={{ marginBottom: 6, display: 'block' }}>
                  {lang === "fr" ? "Type d'abonnement" : "Subscription Type"}
                </label>
                <select
                  value={saleForm.subscription_type}
                  onChange={(e) => {
                    const sub = SUBSCRIPTION_TYPES.find(s => s.value === e.target.value);
                    setSaleForm({
                      subscription_type: e.target.value,
                      cash_collected: sub?.defaultAmount || saleForm.cash_collected,
                    });
                  }}
                  className="w-full p-2.5 rounded-lg"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-sm)',
                  }}
                  data-testid="sale-subscription-select"
                >
                  {SUBSCRIPTION_TYPES.map(s => (
                    <option key={s.value} value={s.value}>{s.label} ({formatCHF(s.defaultAmount)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="tf-label" style={{ marginBottom: 6, display: 'block' }}>
                  {lang === "fr" ? "Cash Collecte (CHF)" : "Cash Collected (CHF)"}
                </label>
                <input
                  type="number"
                  value={saleForm.cash_collected}
                  onChange={(e) => setSaleForm({ ...saleForm, cash_collected: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2.5 rounded-lg"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-sm)',
                    fontFeatureSettings: '"tnum" 1',
                  }}
                  data-testid="sale-cash-input"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSaleDialogOpen(false)}
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              {lang === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              onClick={handleConfirmSale}
              disabled={confirmingSale}
              style={{ background: 'var(--color-accent)', color: '#fff' }}
              data-testid="confirm-sale-submit"
            >
              {confirmingSale ? <Loader2 size={14} className="animate-spin" /> : null}
              {lang === "fr" ? "Confirmer la vente" : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
