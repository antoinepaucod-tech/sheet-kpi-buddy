import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ENTITY_LABELS = {
  member: { single: "membre", plural: "membres" },
  coach: { single: "coach", plural: "coachs" },
};

const ENTITY_PATHS = {
  member: "members",
  coach: "coaches",
};

/**
 * Hook reutilisable pour archiver / restaurer un membre ou un coach.
 *
 * @param {'member' | 'coach'} entityType
 * @param {object} options - { onSuccess?: () => void, queryKeysToInvalidate?: string[] }
 */
export function useArchiveAction(entityType, options = {}) {
  const queryClient = useQueryClient();
  const path = ENTITY_PATHS[entityType];
  const label = ENTITY_LABELS[entityType];

  const invalidate = () => {
    // Invalidate ALL related caches (active list, archived list, expiring, etc.)
    if (entityType === "member") {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members-archived"] });
      queryClient.invalidateQueries({ queryKey: ["memberships-unique"] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
      queryClient.invalidateQueries({ queryKey: ["coaches-archived"] });
    }
    (options.queryKeysToInvalidate || []).forEach((k) =>
      queryClient.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] })
    );
  };

  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      axios.post(`${API}/${path}/${id}/archive`, reason ? { reason } : {}),
    onSuccess: () => {
      invalidate();
      toast.success(
        `${label.single.charAt(0).toUpperCase()}${label.single.slice(1)} archivé`
      );
      options.onSuccess?.("archive");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Erreur lors de l'archivage");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id) => axios.post(`${API}/${path}/${id}/restore`),
    onSuccess: () => {
      invalidate();
      toast.success(
        `${label.single.charAt(0).toUpperCase()}${label.single.slice(1)} restauré`
      );
      options.onSuccess?.("restore");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Erreur lors de la restauration");
    },
  });

  return {
    archive: (id, reason) => archiveMutation.mutate({ id, reason }),
    restore: (id) => restoreMutation.mutate(id),
    isArchiving: archiveMutation.isPending,
    isRestoring: restoreMutation.isPending,
    label,
  };
}
