import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
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
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * PauseMemberDialog
 *   mode = "set" → modale création/modification pause (avec date pickers)
 *   mode = "remove" → modale confirmation suppression pause
 */
export function PauseMemberDialog({ open, mode = "set", member, onClose }) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open && mode === "set" && member) {
      setStartDate(member.pause_start_date || today);
      setEndDate(member.pause_end_date || "");
      setReason(member.pause_reason || "");
    }
  }, [open, mode, member, today]);

  const setMutation = useMutation({
    mutationFn: () =>
      axios.put(`${API}/members/${member.id}/pause`, {
        start_date: startDate,
        end_date: endDate || null,
        reason: reason || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-detail", member.id] });
      queryClient.invalidateQueries({ queryKey: ["members-at-risk"] });
      toast.success("Pause enregistrée");
      onClose?.();
    },
    onError: (err) =>
      toast.error(err.response?.data?.detail || "Erreur lors de la mise en pause"),
  });

  const removeMutation = useMutation({
    mutationFn: () => axios.delete(`${API}/members/${member.id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-detail", member.id] });
      queryClient.invalidateQueries({ queryKey: ["members-at-risk"] });
      toast.success("Pause annulée");
      onClose?.();
    },
    onError: (err) =>
      toast.error(err.response?.data?.detail || "Erreur lors de l'annulation"),
  });

  if (mode === "remove") {
    return (
      <AlertDialog open={open} onOpenChange={(o) => !o && onClose?.()}>
        <AlertDialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la pause ?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--color-text-secondary)]">
              {member?.name} ne sera plus en pause. Le membre redeviendra visible
              dans toutes les listes et entrera à nouveau dans le calcul des membres
              à risques.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[var(--color-border)] text-white hover:bg-[var(--color-bg-tertiary)]">
              Garder en pause
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="pause-remove-confirm"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="bg-[var(--color-danger)] hover:bg-[var(--color-danger)] text-white"
            >
              {removeMutation.isPending ? "..." : "Annuler la pause"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const minEnd = startDate || today;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <AlertDialogContent
        className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-md"
        data-testid="pause-set-dialog"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {member?.pause_start_date ? "Modifier la pause" : "Mettre en pause"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[var(--color-text-secondary)]">
            {member?.name} sera marqué en pause sur la période sélectionnée. Pendant
            cette période, le membre est exclu des listes par défaut et de la page
            "Membres à risques". Les paiements continuent à être générés normalement.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-[var(--color-text-secondary)] block mb-1">
              Date de début <span className="text-[var(--color-danger)]">*</span>
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-white"
              data-testid="pause-start-date"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-secondary)] block mb-1">
              Date de fin (optionnel — laisser vide pour pause indéfinie)
            </label>
            <Input
              type="date"
              value={endDate}
              min={minEnd}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-white"
              data-testid="pause-end-date"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-secondary)] block mb-1">
              Raison (optionnel)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vacances, blessure, déplacement..."
              rows={2}
              className="bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-white"
              data-testid="pause-reason"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-transparent border-[var(--color-border)] text-white hover:bg-[var(--color-bg-tertiary)]">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="pause-set-confirm"
            disabled={!startDate || setMutation.isPending}
            onClick={() => setMutation.mutate()}
            className="bg-[var(--color-warning)] hover:bg-[var(--color-warning)] text-black"
          >
            {setMutation.isPending ? "..." : "Enregistrer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
