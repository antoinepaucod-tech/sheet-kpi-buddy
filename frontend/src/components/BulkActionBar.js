import { Archive, Undo2, X } from "lucide-react";
import { Button } from "./ui/button";

/**
 * Sprint B.4.4 — Bandeau d'action sticky (top).
 * Doit être placé dans le JSX juste après la barre de filtres et
 * AVANT le tableau pour que `sticky top-0` colle correctement
 * lorsque l'utilisateur scrolle dans la liste.
 * Visible uniquement si count > 0.
 */
export function BulkActionBar({
  count,
  entityLabel = "élément",
  entityLabelPlural = "éléments",
  action = "archive", // "archive" | "restore"
  onAction,
  onClear,
  disabled = false,
}) {
  if (count <= 0) return null;

  const isRestore = action === "restore";
  const Icon = isRestore ? Undo2 : Archive;
  const actionLabel = isRestore ? "Restaurer la sélection" : "Archiver la sélection";
  const actionClasses = isRestore
    ? "bg-[var(--color-success)] hover:opacity-85 text-black"
    : "bg-[var(--color-warning)] hover:opacity-85 text-black";

  const label = count > 1 ? entityLabelPlural : entityLabel;

  return (
    <div
      className="sticky top-0 z-30 rounded-md border border-[var(--color-border)] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.35)] animate-slide-down"
      style={{ background: "rgba(28, 28, 30, 0.95)" }}
      data-testid="bulk-action-bar"
    >
      <div className="px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white font-medium" data-testid="bulk-count">
            <span className="text-[var(--color-accent)] font-bold text-base">{count}</span>{" "}
            {label} sélectionné{count > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-[var(--color-text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.06)] gap-1"
            data-testid="bulk-clear-btn"
          >
            <X size={14} />
            Désélectionner
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            onClick={onAction}
            className={`gap-1 ${actionClasses}`}
            data-testid="bulk-action-btn"
          >
            <Icon size={14} />
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
