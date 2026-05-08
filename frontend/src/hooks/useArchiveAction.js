import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ENTITY_LABELS = {
  member: { fr: { single: "membre", plural: "membres" } },
  coach: { fr: { single: "coach", plural: "coachs" } },
};

const ENTITY_PATHS = {
  member: "members",
  coach: "coaches",
};

/**
 * Hook réutilisable pour archiver / restaurer un membre ou un coach.
 *
 * @param {'member' | 'coach'} entityType
 * @param {object} options - { onSuccess?: () => void, queryKeysToInvalidate?: string[] }
 */
export function useArchiveAction(entityType, options = {}) {
  const queryClient = useQueryClient();
  const path = ENTITY_PATHS[entityType];
  const label = ENTITY_LABELS[entityType].fr;

  const invalidate = () => {
    const defaultKeys = [path, `${path}-archived`, `${path}-all`];
    const keys = options.queryKeysToInvalidate || defaultKeys;
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  const archiveMutation = useMutation({
    mutationFn: (id) => axios.post(`${API}/${path}/${id}/archive`),
    onSuccess: () => {
      invalidate();
      toast.success(`${label.single.charAt(0).toUpperCase()}${label.single.slice(1)} archivé`);
      options.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Erreur lors de l'archivage");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id) => axios.post(`${API}/${path}/${id}/restore`),
    onSuccess: () => {
      invalidate();
      toast.success(`${label.single.charAt(0).toUpperCase()}${label.single.slice(1)} restauré`);
      options.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Erreur lors de la restauration");
    },
  });

  return {
    archive: archiveMutation.mutate,
    restore: restoreMutation.mutate,
    isArchiving: archiveMutation.isPending,
    isRestoring: restoreMutation.isPending,
    label,
  };
}
