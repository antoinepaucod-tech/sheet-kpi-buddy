import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle, UserPlus, Phone, Calendar, Eye, Trophy, UserX } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { formatCHF, formatNum } from "../utils/format";

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

export function GHLFunnelSection({ currentMonth, lang, onKpiRefresh }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [saleForm, setSaleForm] = useState({ subscription_type: "6 Week Challenge", cash_collected: 599 });
  const [confirmingSale, setConfirmingSale] = useState(false);
  const [confirmedSales, setConfirmedSales] = useState([]);

  const fetchLastSync = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ghl/last-sync`);
      if (res.data.status === "success") {
        setLastSync(res.data);
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

  useEffect(() => {
    fetchLastSync();
    fetchSales();
  }, [fetchLastSync, fetchSales]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await axios.post(`${API}/ghl/sync`);
      setLastSync(res.data);
      onKpiRefresh?.();
      fetchSales();
    } catch (e) {
      const msg = e.response?.data?.detail || e.message;
      setSyncError(msg);
    } finally {
      setSyncing(false);
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
        subscription_type: saleForm.subscription_type,
        cash_collected: saleForm.cash_collected,
        month: currentMonth,
      });
      setSaleDialogOpen(false);
      fetchSales();
      onKpiRefresh?.();
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

  const totalLeads = funnel.new_leads || 1;
  const maxVal = Math.max(...Object.values(funnel), 1);

  // Check if an opportunity sale is already confirmed
  const isSaleConfirmed = (oppId) => confirmedSales.some(s => s.opportunity_id === oppId);

  return (
    <div className="space-y-4" data-testid="ghl-funnel-section">
      {/* Sync Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
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

      {/* Visual Funnel */}
      <div className="tf-card" data-testid="ghl-funnel-visual">
        <div className="space-y-2">
          {FUNNEL_STAGES.map((stage, idx) => {
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
                    {idx > 0 && (
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--color-text-tertiary)',
                        fontFamily: 'var(--font-display)',
                        fontFeatureSettings: '"tnum" 1',
                      }}>
                        {pct}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversion rates row */}
        {lastSync && (
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            {[
              {
                label: lang === "fr" ? "Taux RDV" : "Apt. Rate",
                value: totalLeads > 0 ? `${Math.round((funnel.confirmed_appointment / totalLeads) * 100)}%` : "0%",
              },
              {
                label: lang === "fr" ? "Taux Presence" : "Show Rate",
                value: funnel.confirmed_appointment > 0
                  ? `${Math.round(((funnel.showed_sold + funnel.showed_lost) / funnel.confirmed_appointment) * 100)}%`
                  : "0%",
              },
              {
                label: lang === "fr" ? "Taux Closing" : "Close Rate",
                value: (funnel.showed_sold + funnel.showed_lost) > 0
                  ? `${Math.round((funnel.showed_sold / (funnel.showed_sold + funnel.showed_lost)) * 100)}%`
                  : "0%",
              },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {label}
                </p>
                <p style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-bold)',
                  color: 'var(--color-accent)',
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
