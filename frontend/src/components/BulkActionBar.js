import { Archive, Undo2, X } from "lucide-react";
import { Button } from "./ui/button";

/**
 * Sprint B.4.4 — Bandeau d'action flottant (sticky bottom).
 * Visible uniquement si count > 0. Largeur 100% sous la fenêtre.
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
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
      data-testid="bulk-action-bar"
    >
      <div className="max-w-screen-2xl mx-auto px-6 py-3 pr-44 flex items-center justify-between gap-4">
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
