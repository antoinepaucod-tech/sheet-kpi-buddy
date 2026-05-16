import { useEffect } from "react";
import { Archive, Undo2, X, Mail } from "lucide-react";
import { Button } from "./ui/button";

/**
 * Sprint B.4.4 — Bandeau d'action sticky (top).
 * Doit être placé dans le JSX juste après la barre de filtres et
 * AVANT le tableau pour que `sticky top-0` colle correctement
 * lorsque l'utilisateur scrolle dans la liste.
 * Visible uniquement si count > 0.
 *
 * Raccourci clavier : Échap → désélectionne tout (sauf si une modale
 * Radix Dialog/AlertDialog est ouverte — dans ce cas Échap ferme la modale).
 *
 * P1 (2026-05-15) — Bouton secondaire "Relancer X membres" via prop `renewal`:
 *   { onAction, disabled, disabledTooltip }
 * Visible si l'objet est passé. Le parent contrôle quand l'afficher.
 */
export function BulkActionBar({
  count,
  entityLabel = "élément",
  entityLabelPlural = "éléments",
  action = "archive", // "archive" | "restore"
  onAction,
  onClear,
  disabled = false,
  renewal = null, // { onAction, disabled?, disabledTooltip? } | null
}) {
  // Listener global Échap → onClear (sauf si modale ouverte).
  // Attaché en phase CAPTURE pour fire AVANT que Radix Dialog ferme la modale,
  // afin de pouvoir détecter qu'une modale est ouverte au moment du keydown.
  useEffect(() => {
    if (count <= 0) return;
    const handler = (e) => {
      if (e.key !== "Escape") return;
      const openDialog = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      );
      if (openDialog) return; // laisse Radix gérer la fermeture de modale
      onClear();
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [count, onClear]);

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
          {renewal && (
            <Button
              size="sm"
              disabled={!!renewal.disabled}
              onClick={renewal.onAction}
              title={renewal.disabled ? renewal.disabledTooltip || "" : ""}
              className="gap-1 bg-[#F97316] hover:bg-[#F97316]/85 text-black font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="bulk-renewal-btn"
            >
              <Mail size={14} />
              Relancer {count} expiré{count > 1 ? "s" : ""}
            </Button>
          )}
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
