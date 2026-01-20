import { useMemo } from "react";

/**
 * Hook for identifying coach vs member memberships
 * Coaches have specific membership types that are tracked separately from club members
 */
export const useCoachMembership = () => {
  // Coach membership types - these are handled separately from club members
  // NOTE: the source data contains multiple spellings ("THE COACH..." vs "TheCoach...").
  const coachMembershipTypes = useMemo(
    () => [
      "Virtual Coach",
      "VIRTUAL COACH",
      "TheCoach pass mensuel",
      "THE COACH PASS MENSUEL",
      "TheCoach pass annuel",
      "THE COACH PASS ANNUEL",
      "TheCoach pass 6 mois",
      "THE COACH PASS 6 MOIS",
      // Paid-in-full variants
      "THE COACH PASS - PAIEMENT ANNUEL X1",
      "THE COACH PASS 6 MOIS - PAIEMENT X1",
    ],
    []
  );

  const normalizeMembership = (value: string) =>
    (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  // Check if a membership is a coach type (robust to spacing/case)
  const isCoachMembership = (membership: string): boolean => {
    const m = normalizeMembership(membership);
    return coachMembershipTypes.some(
      (type) => normalizeMembership(type) === m || m.includes(normalizeMembership(type))
    );
  };

  // Check if a category/membership name is a coach type
  const isCoachCategory = (category: string): boolean => {
    return isCoachMembership(category);
  };

  return {
    coachMembershipTypes,
    isCoachMembership,
    isCoachCategory,
    normalizeMembership,
  };
};

// Export standalone function for use outside React components
export const isCoachMembershipStatic = (membership: string): boolean => {
  const coachTypes = [
    "Virtual Coach",
    "VIRTUAL COACH",
    "TheCoach pass mensuel",
    "THE COACH PASS MENSUEL",
    "TheCoach pass annuel",
    "THE COACH PASS ANNUEL",
    "TheCoach pass 6 mois",
    "THE COACH PASS 6 MOIS",
    "THE COACH PASS - PAIEMENT ANNUEL X1",
    "THE COACH PASS 6 MOIS - PAIEMENT X1",
  ];

  const normalize = (value: string) =>
    (value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const m = normalize(membership);
  return coachTypes.some(
    (type) => normalize(type) === m || m.includes(normalize(type))
  );
};
