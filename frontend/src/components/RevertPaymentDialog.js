import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { RotateCcw, Mail, AlertTriangle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";

function safeFormat(iso, pattern = "dd MMMM yyyy") {
  if (!iso) return "-";
  try {
    return format(parseISO(iso), pattern, { locale: fr });
  } catch {
    return iso;
  }
}

/**
 * Confirmation dialog to revert a paid payment to "impayé" (pending or late).
 *
 * Props:
 *  - open, onOpenChange
 *  - payment: { id, amount, due_date, paid_date, member_id, ... }
 *  - memberName: string
 *  - memberEmail?: string
 *  - isLoading: boolean
 *  - onConfirm: ({ sendEmail: boolean }) => void
 */
export function RevertPaymentDialog({
  open,
  onOpenChange,
  payment,
  memberName,
  memberEmail,
  isLoading,
  onConfirm,
}) {
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    if (!open) setSendEmail(false);
  }, [open]);

  if (!payment) return null;

  const today = new Date().toISOString().slice(0, 10);
  const willBeLate = (payment.due_date || "") < today;
  const targetStatus = willBeLate ? "En retard" : "En attente";
  const canSendEmail = !!memberEmail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="revert-payment-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw size={18} className="text-[var(--color-warning)]" />
            Repasser ce paiement en impayé ?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Payment details */}
          <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-3 space-y-2">
            <p className="tf-stat-label">Détails du paiement</p>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-tertiary)]">Membre</dt>
                <dd className="text-white font-medium">{memberName || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-tertiary)]">Montant</dt>
                <dd className="text-white font-medium">
                  {(payment.amount || 0).toLocaleString("fr-CH")} CHF
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-tertiary)]">Date d'échéance</dt>
                <dd className="text-white">{safeFormat(payment.due_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-tertiary)]">Paiement actuel</dt>
                <dd className="text-white">{safeFormat(payment.paid_date)}</dd>
              </div>
              <div className="flex justify-between pt-1 border-t border-[var(--color-border)]">
                <dt className="text-[var(--color-text-tertiary)]">Nouveau statut</dt>
                <dd className={willBeLate ? "text-[var(--color-danger)] font-semibold" : "text-[var(--color-accent)] font-semibold"}>
                  {targetStatus}
                </dd>
              </div>
            </dl>
          </div>

          <p className="flex items-start gap-2 text-xs text-[var(--color-text-tertiary)]">
            <Info size={12} className="mt-0.5 shrink-0" />
            Le statut sera défini automatiquement sur "En attente" si l'échéance
            est aujourd'hui ou future, sinon "En retard".
          </p>

          {/* Email checkbox */}
          <label
            className={`flex items-start gap-2.5 p-3 rounded-[var(--radius-md)] border cursor-pointer transition-colors ${
              canSendEmail
                ? "border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
                : "border-[var(--color-border)] opacity-50 cursor-not-allowed"
            }`}
          >
            <Checkbox
              checked={sendEmail}
              onCheckedChange={(v) => setSendEmail(!!v)}
              disabled={!canSendEmail}
              data-testid="revert-payment-send-email-checkbox"
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className="text-sm text-white flex items-center gap-1.5">
                <Mail size={13} />
                Renvoyer un mail de relance au membre
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                {canSendEmail
                  ? "Un mail de relance avec les détails du paiement sera envoyé via Resend."
                  : "Désactivé : ce membre n'a pas d'adresse email enregistrée."}
              </p>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            data-testid="revert-payment-cancel-btn"
          >
            Annuler
          </Button>
          <Button
            onClick={() => onConfirm({ sendEmail: sendEmail && canSendEmail })}
            disabled={isLoading}
            className="bg-[var(--color-warning)] text-black hover:opacity-85"
            data-testid="revert-payment-confirm-btn"
          >
            {isLoading ? "..." : "Confirmer le retour en impayé"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
