import { useState, useEffect } from "react";
import { Archive, RotateCcw, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

/**
 * Confirmation dialog for archive / restore actions.
 * - mode = "archive" -> shows optional "raison" textarea
 * - mode = "restore" -> simple confirm
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (bool) => void
 *  - mode: "archive" | "restore"
 *  - entityLabel: string (e.g. "membre", "coach")
 *  - entityName: string (display name shown in the dialog body)
 *  - onConfirm: (reason?: string) => void
 *  - isLoading: boolean
 */
export function ArchiveConfirmDialog({
  open,
  onOpenChange,
  mode,
  entityLabel,
  entityName,
  onConfirm,
  isLoading,
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const isArchive = mode === "archive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="archive-confirm-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isArchive ? (
              <Archive size={18} className="text-[var(--color-warning)]" />
            ) : (
              <RotateCcw size={18} className="text-[var(--color-success)]" />
            )}
            {isArchive ? `Archiver ce ${entityLabel} ?` : `Restaurer ce ${entityLabel} ?`}
          </DialogTitle>
          <DialogDescription className="text-[var(--color-text-secondary)] pt-2">
            {isArchive ? (
              <>
                <span className="font-medium text-white">{entityName}</span> sera
                masqué des listes et exclu des générations automatiques. Cette
                action est <span className="text-white font-medium">réversible</span>{" "}
                via la page Archives.
              </>
            ) : (
              <>
                <span className="font-medium text-white">{entityName}</span> sera
                de nouveau visible et inclus dans les flux normaux.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {isArchive && (
          <div className="space-y-2 py-2">
            <label
              htmlFor="archive-reason"
              className="tf-stat-label"
            >
              Raison (optionnelle)
            </label>
            <Textarea
              id="archive-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : Doublon, départ, erreur de saisie…"
              className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
              rows={3}
              data-testid="archive-reason-input"
            />
            <p className="flex items-start gap-1.5 text-xs text-[var(--color-text-tertiary)]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              Conservée dans l'historique pour traçabilité.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            data-testid="archive-cancel-btn"
          >
            Annuler
          </Button>
          <Button
            onClick={() => onConfirm(reason.trim() || undefined)}
            disabled={isLoading}
            className={
              isArchive
                ? "bg-[var(--color-warning)] hover:opacity-85 text-black"
                : "bg-[var(--color-success)] hover:opacity-85 text-black"
            }
            data-testid="archive-confirm-btn"
          >
            {isLoading ? "..." : isArchive ? "Archiver" : "Restaurer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
