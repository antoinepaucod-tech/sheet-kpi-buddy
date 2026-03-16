export function useCoachMembership(transactions, categories = []) {
  // Build category-to-type mapping using kpi_column
  const memberCats = new Set();
  const coachCats = new Set();
  for (const cat of categories) {
    if (cat.type !== "revenue") continue;
    const kpi = cat.kpi_column || "";
    // Coach/PT revenue
    if (kpi === "pt_revenue" || cat.name.includes("THE COACH") || cat.name.includes("PT ANTOINE")) {
      coachCats.add(cat.name);
    } else if (kpi === "general_eft_revenue" || kpi === "retail_revenue") {
      memberCats.add(cat.name);
    }
  }

  const memberRevenue = transactions
    .filter((tx) => tx.type === "revenue" && memberCats.has(tx.category))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const coachRevenue = transactions
    .filter((tx) => tx.type === "revenue" && coachCats.has(tx.category))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalRevenue = memberRevenue + coachRevenue;
  const memberPct = totalRevenue > 0 ? (memberRevenue / totalRevenue) * 100 : 0;
  const coachPct = totalRevenue > 0 ? (coachRevenue / totalRevenue) * 100 : 0;

  return { memberRevenue, coachRevenue, totalRevenue, memberPct, coachPct };
}
