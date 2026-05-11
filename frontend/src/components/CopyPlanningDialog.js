import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function previousMonth(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function buildMonthOptions(centerYear, centerMonth) {
  // 12 mois passés + courant + 6 mois futurs
  const opts = [];
  for (let offset = -12; offset <= 6; offset++) {
    let y = centerYear;
    let m = centerMonth + offset;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    opts.push({ year: y, month: m, value: `${y}-${String(m).padStart(2, "0")}`, label: `${MONTHS_FR[m - 1]} ${y}` });
  }
  return opts;
}

/**
 * Sprint D.2 — Modale "Recopier planning".
 * Sélecteurs source + destination, checkbox overwrite, aperçu live, exécution.
 */
export function CopyPlanningDialog({ open, currentYear, currentMonth, onClose }) {
  const queryClient = useQueryClient();
  const prev = useMemo(() => previousMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  const monthOptions = useMemo(
    () => buildMonthOptions(currentYear, currentMonth),
    [currentYear, currentMonth],
  );

  const [sourceMonth, setSourceMonth] = useState("");
  const [destMonth, setDestMonth] = useState("");
  const [overwrite, setOverwrite] = useState(true);

  useEffect(() => {
    if (open) {
      setSourceMonth(`${prev.year}-${String(prev.month).padStart(2, "0")}`);
      setDestMonth(`${currentYear}-${String(currentMonth).padStart(2, "0")}`);
      setOverwrite(true);
    }
  }, [open, prev, currentYear, currentMonth]);

  // Preview live
  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ["copy-month-preview", sourceMonth, destMonth],
    queryFn: () =>
      axios
        .post(`${API}/courses/copy-month/preview`, { source_month: sourceMonth, dest_month: destMonth })
        .then((r) => r.data),
    enabled: open && !!sourceMonth && !!destMonth && sourceMonth !== destMonth,
    retry: false,
  });

  const sameMonth = sourceMonth === destMonth;

  const copyMutation = useMutation({
    mutationFn: () =>
      axios.post(`${API}/courses/copy-month`, {
        source_month: sourceMonth,
        dest_month: destMonth,
        overwrite,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      const { created, overwritten, kept, skipped } = res.data;
      const parts = [`${created} créés`, `${overwritten} écrasés`, `${kept} conservés`];
      if (skipped) parts.push(`${skipped} ignorés`);
      toast.success(parts.join(", "));
      onClose?.();
    },
    onError: (err) =>
      toast.error(err.response?.data?.detail || "Erreur lors de la recopie"),
  });

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <AlertDialogContent
        className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-lg"
        data-testid="copy-planning-dialog"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Copy size={18} />
            Recopier le planning
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[var(--color-text-secondary)]">
            Copie les cours d'un mois vers un autre en gardant le jour, l'horaire,
            le coach et la capacité. Les présences hebdomadaires repartent à zéro.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] block mb-1">
                Mois source
              </label>
              <Select value={sourceMonth} onValueChange={setSourceMonth}>
                <SelectTrigger
                  className="bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-white"
                  data-testid="copy-source-month"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-64">
                  {monthOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-white">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] block mb-1">
                Mois destination
              </label>
              <Select value={destMonth} onValueChange={setDestMonth}>
                <SelectTrigger
                  className="bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-white"
                  data-testid="copy-dest-month"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-64">
                  {monthOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-white">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-white">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="accent-[var(--color-warning)]"
              data-testid="copy-overwrite-checkbox"
            />
            Écraser les cours existants dans le mois destination
          </label>

          {/* Preview */}
          <div className="tf-card p-3 bg-[var(--color-bg-tertiary)]" data-testid="copy-preview">
            {sameMonth ? (
              <p className="text-sm text-[var(--color-danger)]">
                Le mois source et destination doivent être différents.
              </p>
            ) : previewLoading ? (
              <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Calcul en cours...
              </p>
            ) : preview ? (
              <div className="space-y-1 text-sm">
                <p className="text-[var(--color-text-secondary)]">
                  De <span className="text-white font-bold">{preview.source}</span> ({preview.source_count} cours)
                  → vers <span className="text-white font-bold">{preview.dest}</span> ({preview.dest_count} cours actuels)
                </p>
                <ul className="text-xs space-y-0.5 mt-2">
                  <li className="text-[var(--color-success)]">
                    <span className="font-mono font-bold" data-testid="preview-create">
                      {preview.will_create}
                    </span>{" "}cours seront créés
                  </li>
                  <li className={overwrite ? "text-[var(--color-warning)]" : "text-[var(--color-text-tertiary)] line-through"}>
                    <span className="font-mono font-bold" data-testid="preview-overwrite">
                      {overwrite ? preview.will_overwrite : 0}
                    </span>{" "}cours seront {overwrite ? "écrasés" : "ignorés (overwrite OFF)"}
                  </li>
                  <li className="text-[var(--color-text-secondary)]">
                    <span className="font-mono font-bold" data-testid="preview-keep">
                      {preview.will_keep + (overwrite ? 0 : preview.will_overwrite)}
                    </span>{" "}cours conservés (pas dans la source)
                  </li>
                </ul>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">Sélectionne deux mois pour voir l'aperçu</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-transparent border-[var(--color-border)] text-white hover:bg-[var(--color-bg-tertiary)]">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="copy-confirm"
            disabled={sameMonth || copyMutation.isPending || !preview || preview.source_count === 0}
            onClick={() => copyMutation.mutate()}
            className="bg-[var(--color-accent)] hover:opacity-85 text-white"
          >
            {copyMutation.isPending ? "..." : <><Copy size={14} className="mr-1" /> Recopier</>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CopyPlanningDialog;
