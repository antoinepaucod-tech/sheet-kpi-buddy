// All Profit OS business calculations live here so the simulator,
// the monthly entries and the consolidated views share one source of truth.
//
// Swiss fiscal layer:
// - Revenues are entered TTC (incl. VAT); the P&L is computed in HT (TTC / (1 + vat)).
//   Costs are entered HT (VAT is recoverable for a VAT-registered company).
// - Staff is entered as gross salaries; employer social charges are added on top.
// - Profit tax applies per club on EBIT, only when EBIT > 0.
// P&L structure: Revenus HT − OPEX (acquisition incluse) = EBITDA − Amortissements = EBIT − Impôt = Résultat net

const n = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))

export const DEFAULT_SETTINGS = {
  avg_membership_months: 30,
  default_arpu: 0,
  equipment_value: 0,
  equipment_amort_months: 60,
  vat_rate: 8.1, // percent
  employer_charges_rate: 17, // percent
  profit_tax_rate: 14, // percent
  currency: 'CHF',
}

// entry-level override wins (used by the simulator), else club settings, else default
const rate = (entry, settings, key, fallback) =>
  entry?.[key] != null && entry[key] !== ''
    ? n(entry[key])
    : settings?.[key] != null
      ? n(settings[key])
      : fallback

// Smoothed monthly amortization charge (never a cash item)
export function equipmentAmortMonthly(settings, override) {
  if (override != null && override !== '') return n(override)
  const months = n(settings?.equipment_amort_months) || 60
  return n(settings?.equipment_value) / months
}

// entry: a profit_monthly_entries row (or simulator inputs with the same shape)
// settings: the club's profit_club_settings row
export function computeMonth(entry, settings = DEFAULT_SETTINGS) {
  const arpuTTC = entry.arpu != null && entry.arpu !== '' ? n(entry.arpu) : n(settings?.default_arpu)
  const duration =
    entry.avg_membership_months != null && entry.avg_membership_months !== ''
      ? n(entry.avg_membership_months)
      : n(settings?.avg_membership_months) || 30

  const vatRate = rate(entry, settings, 'vat_rate', 8.1) / 100
  const chargesRate = rate(entry, settings, 'employer_charges_rate', 17) / 100
  const taxRate = rate(entry, settings, 'profit_tax_rate', 14) / 100
  const vatDiv = 1 + vatRate

  const arpu = arpuTTC / vatDiv // HT

  // — Acquisition (costs are HT)
  const acquisitionTotal = n(entry.ad_spend) + n(entry.agency_fees) + n(entry.video_fees)
  const leads = n(entry.leads_generated)
  const newMembers = n(entry.new_members)
  const cpl = leads > 0 ? n(entry.ad_spend) / leads : null
  const cac = newMembers > 0 ? acquisitionTotal / newMembers : null
  const ltv = arpu * duration // HT, comparable to HT CAC
  const ltvCac = cac > 0 ? ltv / cac : null
  const paybackMonths = cac != null && arpu > 0 ? cac / arpu : null

  // — OPEX (gross salaries + employer social charges; amortization kept separate)
  const staffGross = n(entry.staff_cost)
  const socialCharges = staffGross * chargesRate
  const staffTotal = staffGross + socialCharges
  const equipmentAmort = equipmentAmortMonthly(settings, entry.equipment_amort_override)
  const opexTotal =
    staffTotal + n(entry.rent) + n(entry.cleaning) + n(entry.insurance) + n(entry.energy) + n(entry.misc_opex)

  // — Revenue (entered TTC, P&L in HT)
  const revenueMembersTTC = n(entry.active_members) * arpuTTC
  const revenueAnnexTTC = n(entry.revenue_pt) + n(entry.revenue_shop) + n(entry.revenue_dropin)
  const revenueTotalTTC = revenueMembersTTC + revenueAnnexTTC
  const revenueMembers = revenueMembersTTC / vatDiv
  const revenueAnnex = revenueAnnexTTC / vatDiv
  const revenueTotal = revenueTotalTTC / vatDiv

  // — P&L
  const ebitda = revenueTotal - opexTotal - acquisitionTotal
  const ebit = ebitda - equipmentAmort
  const tax = ebit > 0 ? ebit * taxRate : 0
  const netProfit = ebit - tax
  const netMargin = revenueTotal > 0 ? netProfit / revenueTotal : null

  // Members whose HT membership revenue covers all monthly costs net of HT annex revenue
  // (at break-even EBIT = 0, so tax is zero by construction)
  const breakEvenMembers =
    arpu > 0
      ? Math.max(0, Math.ceil((opexTotal + equipmentAmort + acquisitionTotal - revenueAnnex) / arpu))
      : null

  return {
    arpu,
    arpuTTC,
    duration,
    vatRate,
    chargesRate,
    taxRate,
    acquisitionTotal,
    cpl,
    cac,
    ltv,
    ltvCac,
    paybackMonths,
    staffGross,
    socialCharges,
    staffTotal,
    equipmentAmort,
    opexTotal,
    revenueMembersTTC,
    revenueAnnexTTC,
    revenueTotalTTC,
    revenueMembers,
    revenueAnnex,
    revenueTotal,
    ebitda,
    ebit,
    tax,
    netProfit,
    netMargin,
    breakEvenMembers,
  }
}

// Consolidate several computed months (one per club, same month) into a group view.
// Monetary values are summed; ratios are recomputed from the sums.
// Tax is applied per club (each club is its own legal entity / canton) then summed.
export function consolidate(computedList, entries = []) {
  const sum = (key) => computedList.reduce((acc, c) => acc + n(c[key]), 0)
  const sumEntry = (key) => entries.reduce((acc, e) => acc + n(e[key]), 0)

  const acquisitionTotal = sum('acquisitionTotal')
  const opexTotal = sum('opexTotal')
  const staffGross = sum('staffGross')
  const socialCharges = sum('socialCharges')
  const equipmentAmort = sum('equipmentAmort')
  const revenueAnnex = sum('revenueAnnex')
  const revenueMembers = sum('revenueMembers')
  const revenueTotal = sum('revenueTotal')
  const revenueTotalTTC = sum('revenueTotalTTC')
  const ebitda = sum('ebitda')
  const ebit = sum('ebit')
  const tax = sum('tax')
  const netProfit = sum('netProfit')

  const leads = sumEntry('leads_generated')
  const newMembers = sumEntry('new_members')
  const adSpend = sumEntry('ad_spend')
  const activeMembers = sumEntry('active_members')
  const blendedArpu = activeMembers > 0 ? revenueMembers / activeMembers : 0 // HT
  const cac = newMembers > 0 ? acquisitionTotal / newMembers : null
  const weightedDuration =
    activeMembers > 0
      ? computedList.reduce((acc, c, i) => acc + n(c.duration) * n(entries[i]?.active_members), 0) /
        activeMembers
      : 30
  const ltv = blendedArpu * weightedDuration

  return {
    acquisitionTotal,
    opexTotal,
    staffGross,
    socialCharges,
    equipmentAmort,
    revenueAnnex,
    revenueMembers,
    revenueTotal,
    revenueTotalTTC,
    ebitda,
    ebit,
    tax,
    netProfit,
    netMargin: revenueTotal > 0 ? netProfit / revenueTotal : null,
    cpl: leads > 0 ? adSpend / leads : null,
    cac,
    ltv,
    ltvCac: cac > 0 ? ltv / cac : null,
    paybackMonths: cac != null && blendedArpu > 0 ? cac / blendedArpu : null,
    breakEvenMembers:
      blendedArpu > 0
        ? Math.max(
            0,
            Math.ceil((opexTotal + equipmentAmort + acquisitionTotal - revenueAnnex) / blendedArpu)
          )
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
