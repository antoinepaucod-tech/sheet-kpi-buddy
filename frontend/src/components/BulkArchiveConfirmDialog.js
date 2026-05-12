import { useState, useEffect } from "react";
import { Archive, Undo2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Textarea } from "./ui/textarea";
import { Progress } from "./ui/progress";

const ENTITY_LABELS = {
  member: { single: "membre", plural: "membres" },
  coach: { single: "coach", plural: "coachs" },
};

/**
 * Sprint B.4.4 — Modale de confirmation bulk archive/restore.
 * Affiche : compteur, raison optionnelle (archive), progress bar pendant exec,
 * récap final avec détail erreurs.
 *
 * Props :
 *   open, onClose
 *   entityType: 'member' | 'coach'
 *   action: 'archive' | 'restore'
 *   count
 *   running, progress { done, total }
 *   results { successes, errors:[{id,name,error}], total } | null
 *   onConfirm(reason: string|null) => Promise
 */
export function BulkArchiveConfirmDialog({
  open,
  onClose,
  entityType = "member",
  action = "archive",
  count = 0,
  running = false,
  progress = { done: 0, total: 0 },
  results = null,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setShowErrorDetails(false);
    }
  }, [open]);

  const label = ENTITY_LABELS[entityType] || ENTITY_LABELS.member;
  const isRestore = action === "restore";
  const Icon = isRestore ? Undo2 : Archive;
  const verb = isRestore ? "Restaurer" : "Archiver";
  const verbPast = isRestore ? "restaurés" : "archivés";

  // Phase 3 : résultats
  if (results) {
    const successCount = results.successes?.length || 0;
    const errorCount = results.errors?.length || 0;
    const isFullSuccess = errorCount === 0;
    const isPartial = successCount > 0 && errorCount > 0;
    const HeaderIcon = isFullSuccess ? CheckCircle2 : isPartial ? AlertTriangle : XCircle;
    const headerColor = isFullSuccess
      ? "text-[var(--color-success)]"
      : isPartial
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-danger)]";

    return (
      <AlertDialog open={open} onOpenChange={(o) => !o && onClose?.()}>
        <AlertDialogContent
          className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-lg"
          data-testid="bulk-results-dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className={`flex items-center gap-2 ${headerColor}`}>
              <HeaderIcon size={20} />
              Récapitulatif
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--color-text-secondary)]">
              {successCount > 0 && (
                <span className="text-[var(--color-success)]">
                  {successCount} {label[successCount > 1 ? "plural" : "single"]}{" "}
                  {successCount > 1 ? `${verbPast} ✅` : `${isRestore ? "restauré" : "archivé"} ✅`}
                </span>
              )}
              {successCount > 0 && errorCount > 0 && <span>, </span>}
              {errorCount > 0 && (
                <span className="text-[var(--color-danger)]">
                  {errorCount} erreur{errorCount > 1 ? "s" : ""}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {errorCount > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowErrorDetails((v) => !v)}
                className="text-xs text-[var(--color-accent)] hover:underline"
                data-testid="bulk-toggle-error-details"
              >
                {showErrorDetails ? "Masquer" : "Voir"} le détail des erreurs
              </button>
              {showErrorDetails && (
                <ul
                  className="space-y-1 max-h-48 overflow-y-auto text-xs bg-[var(--color-bg-tertiary)] rounded p-2 border border-[var(--color-border)]"
                  data-testid="bulk-error-list"
                >
                  {results.errors.map((e) => (
                    <li key={e.id} className="flex flex-col gap-0.5 py-1 border-b border-[var(--color-border)] last:border-0">
                      <span className="text-white font-medium">{e.name}</span>
                      <span className="text-[var(--color-danger)] font-mono text-[10px]">{e.error}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogAction
              onClick={onClose}
              className="bg-[var(--color-accent)] hover:opacity-85"
              data-testid="bulk-results-close"
            >
              Fermer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Phase 2 : exécution en cours
  if (running) {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <AlertDialog open={open}>
        <AlertDialogContent
          className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-md"
          data-testid="bulk-progress-dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon size={18} className="animate-pulse" />
              {verb} en cours...
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--color-text-secondary)]">
              <span data-testid="bulk-progress-label">
                {progress.done} / {progress.total} traités...
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Progress
            value={pct}
            className="h-2 bg-[var(--color-bg-tertiary)]"
            data-testid="bulk-progress-bar"
          />
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Phase 1 : confirmation
  const description = isRestore
    ? `Ces ${count} ${count > 1 ? label.plural : label.single} réapparaîtront dans les listes principales avec toutes leurs données conservées.`
    : `Ces ${count} ${count > 1 ? label.plural : label.single} seront masqués des listes principales. Vous pourrez les restaurer à tout moment depuis l'onglet Archives. Cette action est réversible.`;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <AlertDialogContent
        className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-lg"
        data-testid="bulk-confirm-dialog"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon size={18} />
            {verb} les {count} {count > 1 ? label.plural : label.single} sélectionné
            {count > 1 ? "s" : ""} ?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[var(--color-text-secondary)]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isRestore && (
          <div className="py-2">
            <label className="text-xs text-[var(--color-text-secondary)] block mb-1">
              Raison (optionnel, commune au lot)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Sortie de saison, départ collectif, etc."
              rows={2}
              className="bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-white"
              data-testid="bulk-reason"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-transparent border-[var(--color-border)] text-white hover:bg-[var(--color-bg-tertiary)]">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm?.(reason || null)}
            className={
              isRestore
                ? "bg-[var(--color-success)] hover:opacity-85 text-black"
                : "bg-[var(--color-warning)] hover:opacity-85 text-black"
            }
            data-testid="bulk-confirm-action"
          >
            <Icon size={14} className="mr-1" />
            Confirmer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
