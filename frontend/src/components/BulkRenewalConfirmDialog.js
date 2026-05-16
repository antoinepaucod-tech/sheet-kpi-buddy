import { useEffect } from "react";
import { Mail, X, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

/**
 * Bulk Renewal Reminder Confirm Dialog (P1 — 2026-05-15).
 *
 * 3 phases :
 *  - confirm  : warning cooldown + bouton Envoyer
 *  - running  : "Envoi en cours..."
 *  - results  : breakdown sent / skipped_* / failed + bouton Fermer
 *
 * Props :
 *  - open, onClose, onConfirm
 *  - count (membres sélectionnés)
 *  - running, summary (= breakdown serveur), error (string|null)
 */
export function BulkRenewalConfirmDialog({
  open,
  onClose,
  onConfirm,
  count,
  running,
  summary,
  error,
}) {
  // Force closing on Escape when not running
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape" && !running) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, running, onClose]);

  if (!open) return null;

  const inResults = !!summary || !!error;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !running && onClose()}>
      <DialogContent
        className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-w-md"
        data-testid="bulk-renewal-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Mail size={18} className="text-[#F97316]" />
            {inResults ? "Résultat des relances" : "Relancer les membres expirés"}
          </DialogTitle>
        </DialogHeader>

        {!inResults && !running && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Tu t'apprêtes à envoyer un email de relance à{" "}
              <span className="text-white font-semibold" data-testid="bulk-renewal-count">
                {count} membre{count > 1 ? "s" : ""} expiré{count > 1 ? "s" : ""}
              </span>
              .
            </p>
            <div className="bg-[rgba(255,214,10,0.08)] border border-[rgba(255,214,10,0.3)] rounded-md p-3 flex gap-2">
              <AlertTriangle size={16} className="text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                <p className="text-white font-semibold mb-1">Garde-fous serveur :</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>Cooldown 7 jours par membre</li>
                  <li>Désinscrits exclus (RGPD)</li>
                  <li>Email manquant → ignoré</li>
                </ul>
                <p className="mt-1.5 text-[var(--color-text-tertiary)]">
                  Le batch est plafonné à 50 envois. Tu verras le détail après.
                </p>
              </div>
            </div>
          </div>
        )}

        {running && (
          <div className="py-6 text-center">
            <div className="inline-block w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)]" data-testid="bulk-renewal-running">
              Envoi des relances en cours...
            </p>
          </div>
        )}

        {summary && (
          <div className="space-y-3 py-2" data-testid="bulk-renewal-results">
            <SummaryRow label="Envoyés" value={summary.sent} color="text-[var(--color-success)]" testid="renewal-summary-sent" />
            {summary.skipped_cooldown > 0 && (
              <SummaryRow label="Skippés (cooldown 7j)" value={summary.skipped_cooldown} color="text-[var(--color-warning)]" testid="renewal-summary-cooldown" />
            )}
            {summary.skipped_opt_out > 0 && (
              <SummaryRow label="Skippés (désinscrits)" value={summary.skipped_opt_out} color="text-[var(--color-warning)]" testid="renewal-summary-opt-out" />
            )}
            {summary.skipped_not_expired > 0 && (
              <SummaryRow label="Skippés (non expirés)" value={summary.skipped_not_expired} color="text-[var(--color-text-tertiary)]" testid="renewal-summary-not-expired" />
            )}
            {summary.skipped_no_email > 0 && (
              <SummaryRow label="Skippés (sans email)" value={summary.skipped_no_email} color="text-[var(--color-text-tertiary)]" testid="renewal-summary-no-email" />
            )}
            {summary.failed > 0 && (
              <SummaryRow label="Échecs" value={summary.failed} color="text-[var(--color-danger)]" testid="renewal-summary-failed" />
            )}
            {summary.failed > 0 && Array.isArray(summary.details) && (
              <details className="text-xs text-[var(--color-text-tertiary)] mt-3">
                <summary className="cursor-pointer hover:text-white">Détail des échecs</summary>
                <ul className="mt-2 space-y-1 pl-3">
                  {summary.details
                    .filter((d) => d.status === "failed")
                    .map((d, i) => (
                      <li key={i} className="text-[var(--color-danger)]">
                        {d.name || d.member_id} — {d.reason}
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {error && (
          <div className="bg-[rgba(255,69,58,0.08)] border border-[rgba(255,69,58,0.3)] rounded-md p-3 text-sm text-[var(--color-danger)]" data-testid="bulk-renewal-error">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2">
          {!inResults && !running && (
            <>
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-[var(--color-text-secondary)] hover:bg-[rgba(255,255,255,0.06)]"
                data-testid="bulk-renewal-cancel"
              >
                <X size={14} className="mr-1" />
                Annuler
              </Button>
              <Button
                onClick={onConfirm}
                className="bg-[#F97316] hover:bg-[#F97316]/85 text-black font-semibold"
                data-testid="bulk-renewal-confirm"
              >
                <Mail size={14} className="mr-1" />
                Envoyer {count} relance{count > 1 ? "s" : ""}
              </Button>
            </>
          )}
          {(inResults) && !running && (
            <Button
              onClick={onClose}
              className="bg-[var(--color-accent)] hover:opacity-85 text-white"
              data-testid="bulk-renewal-close"
            >
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value, color, testid }) {
  return (
    <div className="flex items-center justify-between" data-testid={testid}>
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
