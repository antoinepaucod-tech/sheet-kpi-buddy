import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Hook bulk renewal reminder (P1 — 2026-05-15).
 *
 * Pattern Sprint B.4.4 mais 1 seul appel HTTP serveur (le backend gère
 * cooldown/opt-out/expired/no-email côté serveur, donc pas de boucle par item).
 *
 * Usage :
 *   const renewal = useBulkRenewalReminder();
 *   await renewal.run(["m1", "m2"]);
 *   renewal.summary // { sent, skipped_cooldown, skipped_opt_out, ... }
 */
export function useBulkRenewalReminder() {
  const queryClient = useQueryClient();

  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const reset = useCallback(() => {
    setSummary(null);
    setError(null);
  }, []);

  const run = useCallback(
    async (memberIds) => {
      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return null;
      }
      setRunning(true);
      setSummary(null);
      setError(null);
      try {
        const { data } = await axios.post(
          `${API}/members/bulk-renewal-reminder`,
          { member_ids: memberIds },
        );
        setSummary(data);
        // Refresh la liste pour récupérer les last_renewal_reminder_at + counter à jour
        queryClient.invalidateQueries({ queryKey: ["members"] });
        return data;
      } catch (err) {
        const detail = err?.response?.data?.detail || err?.message || "Erreur inconnue";
        setError(detail);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [queryClient],
  );

  return { run, running, summary, error, reset };
}
