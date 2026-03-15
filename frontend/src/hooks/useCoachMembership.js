export function useCoachMembership(transactions, categories = []) {
  // Build category-to-kpi mapping
  const revMemberCats = new Set();
  const revCoachCats = new Set();
  for (const cat of categories) {
    if (cat.kpi_column === "revenue_members") revMemberCats.add(cat.name);
    if (cat.kpi_column === "revenue_coaching") revCoachCats.add(cat.name);
  }

  const memberRevenue = transactions
    .filter((tx) => tx.type === "revenue" && (revMemberCats.has(tx.category) || tx.sub_type === "members"))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const coachRevenue = transactions
    .filter((tx) => tx.type === "revenue" && (revCoachCats.has(tx.category) || tx.sub_type === "coaching"))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalRevenue = memberRevenue + coachRevenue;
  const memberPct = totalRevenue > 0 ? (memberRevenue / totalRevenue) * 100 : 0;
  const coachPct = totalRevenue > 0 ? (coachRevenue / totalRevenue) * 100 : 0;

  return { memberRevenue, coachRevenue, totalRevenue, memberPct, coachPct };
}
