import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Sprint C — Hook pour la catégorisation membre.
 *
 * Charge le mapping {member_id → {category, duo_partner_id, duo_partner_name, is_primary_in_duo}}
 * pour le club courant. Cache TanStack Query.
 *
 * @returns {{
 *   categories: Record<string, {category: string, duo_partner_id: string|null, duo_partner_name: string|null, is_primary_in_duo: boolean}>,
 *   stats: Record<string, number> | undefined,
 *   getCategory: (memberId: string) => string,
 *   getDuoPartnerId: (memberId: string) => string|null,
 *   getDuoPartnerName: (memberId: string) => string|null,
 *   isPrimaryInDuo: (memberId: string) => boolean,
 *   isLoading: boolean,
 * }}
 */
export function useMemberCategories() {
  const { data: categories = {}, isLoading } = useQuery({
    queryKey: ["members", "categories"],
    queryFn: () =>
      axios.get(`${API}/members/categories`).then((r) => r.data),
    staleTime: 1000 * 60 * 2, // 2 min
  });

  const { data: stats } = useQuery({
    queryKey: ["members", "categories", "stats"],
    queryFn: () =>
      axios.get(`${API}/members/categories/stats`).then((r) => r.data),
    staleTime: 1000 * 60 * 2,
  });

  const getCategory = (memberId) => categories[memberId]?.category || "Inconnu";
  const getDuoPartnerId = (memberId) => categories[memberId]?.duo_partner_id || null;
  const getDuoPartnerName = (memberId) => categories[memberId]?.duo_partner_name || null;
  const isPrimaryInDuo = (memberId) => !!categories[memberId]?.is_primary_in_duo;

  return {
    categories,
    stats,
    getCategory,
    getDuoPartnerId,
    getDuoPartnerName,
    isPrimaryInDuo,
    isLoading,
  };
}

export const CATEGORY_LABELS = {
  HG: "HG",
  Coach: "Coachs",
  Partenaire: "Partenaires (DUO)",
  IFRC: "IFRC",
  OpenGym: "Open Gym",
  Challenge: "Challenge",
  Pret: "Prêt",
  Inconnu: "Inconnu",
};

export const CATEGORY_OPTIONS = ["HG", "Coach", "Partenaire", "IFRC", "OpenGym", "Challenge", "Pret", "Inconnu"];

// Defaults par page (catégories EXCLUES)
export const ONBOARDING_EXCLUDED_DEFAULT = ["OpenGym", "Pret", "Inconnu"];
export const ATTENDANCE_EXCLUDED_DEFAULT = ["OpenGym", "Pret", "Inconnu"];
