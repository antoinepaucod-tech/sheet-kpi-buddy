import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { RotateCcw, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";

const STATUS_LABELS = {
  payé: "Payé",
  impayé: "Impayé",
  en_attente: "En attente",
};

function safeFormat(iso, pattern = "dd MMMM yyyy") {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), pattern, { locale: fr });
  } catch {
    return iso;
  }
}

/**
 * Confirmation dialog when reverting coach rent_status from "payé" to "impayé" or "en_attente".
 *
 * Props:
 *  - open, onOpenChange
 *  - coach: full coach object
 *  - newStatus: "impayé" | "en_attente"
 *  - isLoading
 *  - onConfirm: () => void
 *  - onCancel: () => void  (must restore previous select value)
 */
export function RevertCoachRentDialog({
  open,
  onOpenChange,
  coach,
  newStatus,
  isLoading,
  onConfirm,
  onCancel,
}) {
  if (!coach || !newStatus) return null;

  const newLabel = STATUS_LABELS[newStatus] || newStatus;

  const handleOpenChange = (o) => {
    if (!o && !isLoading) onCancel?.();
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="revert-coach-rent-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw size={18} className="text-[var(--color-warning)]" />
            Repasser le loyer en {newLabel.toLowerCase()} ?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-3 space-y-2">
            <p className="tf-stat-label">Détails du loyer coach</p>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-tertiary)]">Coach</dt>
                <dd className="text-white font-medium">{coach.name || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-tertiary)]">Montant du loyer</dt>
                <dd className="text-white font-medium">
                  {(coach.rent_amount || 0).toLocaleString("fr-CH")} CHF
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-tertiary)]">Statut actuel</dt>
                <dd className="text-[var(--color-success)] font-medium">Payé</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-tertiary)]">Nouveau statut</dt>
                <dd className="text-[var(--color-warning)] font-semibold">{newLabel}</dd>
              </div>
              <div className="flex justify-between pt-1 border-t border-[var(--color-border)]">
                <dt className="text-[var(--color-text-tertiary)]">Dernier paiement</dt>
                <dd className="text-white">{safeFormat(coach.rent_last_paid_at)}</dd>
              </div>
            </dl>
          </div>

          <p className="flex items-start gap-2 text-xs text-[var(--color-text-tertiary)]">
            <Info size={12} className="mt-0.5 shrink-0" />
            Cette action peut affecter les statistiques mensuelles de revenus
            coachs. La date du dernier paiement sera conservée pour l'historique.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
            disabled={isLoading}
            data-testid="revert-coach-rent-cancel-btn"
          >
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-[var(--color-warning)] text-black hover:opacity-85"
            data-testid="revert-coach-rent-confirm-btn"
          >
            {isLoading ? "..." : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
