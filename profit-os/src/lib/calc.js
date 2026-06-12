// All Profit OS business calculations live here so the simulator,
// the monthly entries and the consolidated views share one source of truth.

const n = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))

export const DEFAULT_SETTINGS = {
  avg_membership_months: 30,
  default_arpu: 0,
  equipment_value: 0,
  equipment_amort_months: 60,
  currency: 'CHF',
}

// Smoothed monthly amortization charge (never a cash item)
export function equipmentAmortMonthly(settings, override) {
  if (override != null && override !== '') return n(override)
  const months = n(settings?.equipment_amort_months) || 60
  return n(settings?.equipment_value) / months
}

// entry: a profit_monthly_entries row (or simulator inputs with the same shape)
// settings: the club's profit_club_settings row
export function computeMonth(entry, settings = DEFAULT_SETTINGS) {
  const arpu = entry.arpu != null && entry.arpu !== '' ? n(entry.arpu) : n(settings?.default_arpu)
  const duration =
    entry.avg_membership_months != null && entry.avg_membership_months !== ''
      ? n(entry.avg_membership_months)
      : n(settings?.avg_membership_months) || 30

  const acquisitionTotal = n(entry.ad_spend) + n(entry.agency_fees) + n(entry.video_fees)
  const leads = n(entry.leads_generated)
  const newMembers = n(entry.new_members)

  const cpl = leads > 0 ? n(entry.ad_spend) / leads : null
  const cac = newMembers > 0 ? acquisitionTotal / newMembers : null
  const ltv = arpu * duration
  const ltvCac = cac > 0 ? ltv / cac : null
  const paybackMonths = cac != null && arpu > 0 ? cac / arpu : null

  const equipmentAmort = equipmentAmortMonthly(settings, entry.equipment_amort_override)
  const opexTotal =
    n(entry.staff_cost) +
    n(entry.rent) +
    n(entry.cleaning) +
    n(entry.insurance) +
    n(entry.energy) +
    n(entry.misc_opex) +
    equipmentAmort

  const revenueMembers = n(entry.active_members) * arpu
  const revenueAnnex = n(entry.revenue_pt) + n(entry.revenue_shop) + n(entry.revenue_dropin)
  const revenueTotal = revenueMembers + revenueAnnex

  const netProfit = revenueTotal - opexTotal - acquisitionTotal
  const netMargin = revenueTotal > 0 ? netProfit / revenueTotal : null

  // Members needed for membership revenue to cover all monthly costs net of annex revenue
  const breakEvenMembers =
    arpu > 0 ? Math.max(0, Math.ceil((opexTotal + acquisitionTotal - revenueAnnex) / arpu)) : null

  return {
    arpu,
    duration,
    acquisitionTotal,
    cpl,
    cac,
    ltv,
    ltvCac,
    paybackMonths,
    equipmentAmort,
    opexTotal,
    revenueMembers,
    revenueAnnex,
    revenueTotal,
    netProfit,
    netMargin,
    breakEvenMembers,
  }
}

// Consolidate several computed months (one per club, same month) into a group view.
// Monetary values are summed; ratios are recomputed from the sums.
export function consolidate(computedList, entries = []) {
  const sum = (key) => computedList.reduce((acc, c) => acc + n(c[key]), 0)
  const sumEntry = (key) => entries.reduce((acc, e) => acc + n(e[key]), 0)

  const acquisitionTotal = sum('acquisitionTotal')
  const opexTotal = sum('opexTotal')
  const revenueAnnex = sum('revenueAnnex')
  const revenueTotal = sum('revenueTotal')
  const netProfit = revenueTotal - opexTotal - acquisitionTotal

  const leads = sumEntry('leads_generated')
  const newMembers = sumEntry('new_members')
  const adSpend = sumEntry('ad_spend')
  const activeMembers = sumEntry('active_members')
  const revenueMembers = sum('revenueMembers')
  const blendedArpu = activeMembers > 0 ? revenueMembers / activeMembers : 0
  const cac = newMembers > 0 ? acquisitionTotal / newMembers : null
  // group LTV = weighted by each club's LTV is ambiguous; use blended ARPU x weighted duration
  const weightedDuration =
    activeMembers > 0
      ? computedList.reduce((acc, c, i) => acc + n(c.duration) * n(entries[i]?.active_members), 0) /
        activeMembers
      : 30
  const ltv = blendedArpu * weightedDuration

  return {
    acquisitionTotal,
    opexTotal,
    revenueAnnex,
    revenueMembers,
    revenueTotal,
    netProfit,
    netMargin: revenueTotal > 0 ? netProfit / revenueTotal : null,
    cpl: leads > 0 ? adSpend / leads : null,
    cac,
    ltv,
    ltvCac: cac > 0 ? ltv / cac : null,
    paybackMonths: cac != null && blendedArpu > 0 ? cac / blendedArpu : null,
    breakEvenMembers:
      blendedArpu > 0
        ? Math.max(0, Math.ceil((opexTotal + acquisitionTotal - revenueAnnex) / blendedArpu))
        : null,
    activeMembers,
    newMembers,
    leads,
  }
}

export const EMPTY_ENTRY = {
  ad_spend: 0,
  agency_fees: 0,
  video_fees: 0,
  leads_generated: 0,
  new_members: 0,
  staff_cost: 0,
  rent: 0,
  cleaning: 0,
  insurance: 0,
  energy: 0,
  misc_opex: 0,
  equipment_amort_override: null,
  active_members: 0,
  arpu: null,
  revenue_pt: 0,
  revenue_shop: 0,
  revenue_dropin: 0,
}
