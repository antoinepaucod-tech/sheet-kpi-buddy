import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const MAX_BULK_SIZE = 50;

const ENTITY_PATHS = {
  member: "members",
  coach: "coaches",
};

const ENTITY_LABELS = {
  member: { single: "membre", plural: "membres" },
  coach: { single: "coach", plural: "coachs" },
};

/**
 * Sprint B.4.4 — Hook bulk archive/restore.
 *
 * Garde le contrôle séquentiel pour fournir une barre de progression précise
 * et une remontée d'erreurs par item. Au terme, invalide les caches concernés.
 *
 * @param {'member' | 'coach'} entityType
 */
export function useBulkArchiveAction(entityType) {
  const queryClient = useQueryClient();
  const path = ENTITY_PATHS[entityType];
  const label = ENTITY_LABELS[entityType];

  const [selected, setSelected] = useState(() => new Set());
  const [lastSelectedId, setLastSelectedId] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null); // { successes:[], errors:[{id,name,error}] }

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastSelectedId(id);
  }, []);

  const setMany = useCallback((ids) => {
    setSelected(new Set(ids.slice(0, MAX_BULK_SIZE)));
    setLastSelectedId(ids.length > 0 ? ids[Math.min(ids.length, MAX_BULK_SIZE) - 1] : null);
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    setLastSelectedId(null);
    setResults(null);
  }, []);

  /**
   * Sélection de plage type Shift+clic.
   * @param {string[]} orderedIds — ids dans l'ordre visuel actuel (filtré/trié).
   * @param {string} targetId — id de la ligne cliquée avec Shift.
   * @returns {{added:number, truncated:boolean}}
   */
  const selectRange = useCallback(
    (orderedIds, targetId) => {
      const targetIdx = orderedIds.indexOf(targetId);
      if (targetIdx < 0) return { added: 0, truncated: false };
      const anchorIdx = lastSelectedId ? orderedIds.indexOf(lastSelectedId) : -1;

      const next = new Set(selected);
      let added = 0;
      let truncated = false;

      if (anchorIdx < 0) {
        // Pas d'ancrage → toggle simple
        if (next.has(targetId)) {
          next.delete(targetId);
        } else if (next.size < MAX_BULK_SIZE) {
          next.add(targetId);
          added = 1;
        } else {
          truncated = true;
        }
      } else {
        const [lo, hi] = anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
        for (let i = lo; i <= hi; i++) {
          const id = orderedIds[i];
          if (next.has(id)) continue;
          if (next.size >= MAX_BULK_SIZE) {
            truncated = true;
            break;
          }
          next.add(id);
          added++;
        }
      }
      setSelected(next);
      setLastSelectedId(targetId);
      return { added, truncated };
    },
    [selected, lastSelectedId],
  );

  const invalidate = useCallback(() => {
    if (entityType === "member") {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members-archived"] });
      queryClient.invalidateQueries({ queryKey: ["memberships-unique"] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
      queryClient.invalidateQueries({ queryKey: ["coaches-archived"] });
    }
  }, [entityType, queryClient]);

  /**
   * Exécute l'action sur tous les IDs sélectionnés en séquentiel.
   * `action` = "archive" | "restore". `reason` optionnel (utilisé pour archive).
   * `entitiesById` = map { id → entity } pour récupérer le nom en cas d'erreur.
   */
  const run = useCallback(
    async ({ action, reason, entitiesById }) => {
      const ids = Array.from(selected);
      if (ids.length === 0) return null;

      setRunning(true);
      setProgress({ done: 0, total: ids.length });
      const successes = [];
      const errors = [];

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const entity = entitiesById?.[id] || {};
        try {
          if (action === "archive") {
            await axios.post(`${API}/${path}/${id}/archive`, reason ? { reason } : {});
          } else {
            await axios.post(`${API}/${path}/${id}/restore`);
          }
          successes.push(id);
        } catch (err) {
          errors.push({
            id,
            name: entity.name || id,
            error: err.response?.data?.detail || err.message || "Erreur inconnue",
          });
        }
        setProgress({ done: i + 1, total: ids.length });
      }

      invalidate();
      setRunning(false);
      const summary = { successes, errors, total: ids.length };
      setResults(summary);
      // Reset sélection des items traités avec succès
      setSelected((prev) => {
        const next = new Set(prev);
        successes.forEach((s) => next.delete(s));
        return next;
      });
      return summary;
    },
    [selected, path, invalidate],
  );

  return {
    selected,
    toggle,
    setMany,
    clear,
    selectRange,
    running,
    progress,
    results,
    setResults,
    run,
    label,
    MAX_BULK_SIZE,
  };
}
