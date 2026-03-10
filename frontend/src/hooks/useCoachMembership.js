export function useCoachMembership(transactions) {
  const memberRevenue = transactions
    .filter((tx) => tx.type === "revenue" && tx.sub_type === "members")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const coachRevenue = transactions
    .filter((tx) => tx.type === "revenue" && tx.sub_type === "coaching")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalRevenue = memberRevenue + coachRevenue;
  const memberPct = totalRevenue > 0 ? (memberRevenue / totalRevenue) * 100 : 0;
  const coachPct = totalRevenue > 0 ? (coachRevenue / totalRevenue) * 100 : 0;

  return { memberRevenue, coachRevenue, totalRevenue, memberPct, coachPct };
}
