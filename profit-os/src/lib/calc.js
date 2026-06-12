// All Profit OS business calculations live here so the simulator, the monthly
// entries, the forecast and the consolidated views share one source of truth.
//
// Swiss fiscal layer:
// - Revenues are entered TTC (incl. VAT); the P&L is computed in HT (TTC / (1 + vat)).
//   Costs are entered HT (VAT is recoverable for a VAT-registered company).
// - Staff is entered as gross salaries; employer social charges are added on top.
// - Profit tax applies per club, only when the pre-tax result is positive.
//
// Investor layer:
// - Debt interest sits in the P&L between EBIT and tax; principal repayment is
//   cash-flow only, never in the P&L.
// - CAPEX feeds the P&L through smoothed amortization (amount / amort_months);
//   the cash goes out in full at the purchase month (cash flow only).
// - Cash flow = net profit + amortization (non-cash) − principal repayment − CAPEX paid.
//
// P&L structure:
// Revenus HT − OPEX (acquisition incluse) = EBITDA − Amortissements = EBIT
// − Intérêts = Résultat avant impôt − Impôt = Résultat net

const n = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))

export const DEFAULT_SETTINGS = {
  avg_membership_months: 30,
  default_arpu: 0,
  equipment_value: 0,
  equipment_amort_months: 60,
  vat_rate: 8.1, // percent
  employer_charges_rate: 17, // percent
  profit_tax_rate: 14, // percent
  surface_m2: 0,
  max_capacity: 0,
  ebitda_multiple: 5,
  currency: 'CHF',
}

// entry-level override wins (used by the simulator), else club settings, else default
const rate = (entry, settings, key, fallback) =>
  entry?.[key] != null && entry[key] !== ''
    ? n(entry[key])
    : settings?.[key] != null
      ? n(settings[key])
      : fallback

// ——— Date helpers ('YYYY-MM' month strings) ———

export function monthIndexFrom(startDate, monthStr) {
  // whole months between the start date's month and monthStr (0 = same month)
  const [sy, sm] = String(startDate).slice(0, 7).split('-').map(Number)
  const [y, m] = String(monthStr).slice(0, 7).split('-').map(Number)
  return (y - sy) * 12 + (m - sm)
}

export function addMonths(monthStr, count) {
  const [y, m] = monthStr.split('-').map(Number)
  const total = y * 12 + (m - 1) + count
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

// ——— CAPEX ———

export function capexAmortForMonth(capexList, monthStr) {
  return (capexList ?? []).reduce((acc, c) => {
    const i = monthIndexFrom(c.date, monthStr)
    return i >= 0 && i < n(c.amort_months) ? acc + n(c.amount) / n(c.amort_months) : acc
  }, 0)
}

export function capexPaidInMonth(capexList, monthStr) {
  return (capexList ?? []).reduce(
    (acc, c) => (monthIndexFrom(c.date, monthStr) === 0 ? acc + n(c.amount) : acc),
    0
  )
}

export function capexTotal(capexList) {
  return (capexList ?? []).reduce((acc, c) => acc + n(c.amount), 0)
}

// ——— Financing (French annuity: constant payment, interest on remaining balance) ———

export function loanPayment(loan) {
  const P = n(loan.principal)
  const months = n(loan.term_months)
  const r = n(loan.annual_rate) / 100 / 12
  if (months <= 0) return 0
  if (r === 0) return P / months
  return (P * r) / (1 - Math.pow(1 + r, -months))
}

// Interest + principal split for the payment occurring in monthStr (zeros outside the term)
export function loanForMonth(loan, monthStr) {
  const k = monthIndexFrom(loan.start_date, monthStr) // 0-based payment index
  const months = n(loan.term_months)
  if (k < 0 || k >= months) return { interest: 0, principal: 0, balance: 0 }
  const P = n(loan.principal)
  const r = n(loan.annual_rate) / 100 / 12
  const pmt = loanPayment(loan)
  // balance before payment k+1, after k payments
  const balance =
    r === 0 ? P - pmt * k : P * Math.pow(1 + r, k) - (pmt * (Math.pow(1 + r, k) - 1)) / r
  const interest = balance * r
  return { interest, principal: pmt - interest, balance }
}

export function financingForMonth(financingList, monthStr) {
  return (financingList ?? []).reduce(
    (acc, loan) => {
      const { interest, principal } = loanForMonth(loan, monthStr)
      return { interest: acc.interest + interest, principal: acc.principal + principal }
    },
    { interest: 0, principal: 0 }
  )
}

// ——— Equipment (legacy settings-level amortization, kept as a simple fallback) ———

export function equipmentAmortMonthly(settings, override) {
  if (override != null && override !== '') return n(override)
  const months = n(settings?.equipment_amort_months) || 60
  return n(settings?.equipment_value) / months
}

// ——— Monthly P&L ———
// entry: a profit_monthly_entries row (or simulator inputs with the same shape)
// settings: the club's profit_club_settings row
// extras: { capexAmort, interest } derived from profit_capex / profit_financing for that month
export function computeMonth(entry, settings = DEFAULT_SETTINGS, extras = {}) {
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

  // — Churn & growth
  const activeMembers = n(entry.active_members)
  const cancellations = n(entry.cancellations)
  const churnRate = activeMembers > 0 ? cancellations / activeMembers : null
  const netGrowth = newMembers - cancellations
  const impliedDuration = churnRate > 0 ? 1 / churnRate : null // months, = 1/churn

  // — OPEX (gross salaries + employer social charges; amortization kept separate)
  const staffGross = n(entry.staff_cost)
  const socialCharges = staffGross * chargesRate
  const staffTotal = staffGross + socialCharges
  // simulator override replaces ALL amortization; otherwise settings fallback + CAPEX schedule
  const equipmentAmort =
    entry.equipment_amort_override != null && entry.equipment_amort_override !== ''
      ? n(entry.equipment_amort_override)
      : equipmentAmortMonthly(settings) + n(extras.capexAmort)
  const opexTotal =
    staffTotal + n(entry.rent) + n(entry.cleaning) + n(entry.insurance) + n(entry.energy) + n(entry.misc_opex)

  // — Revenue (entered TTC, P&L in HT)
  const revenueMembersTTC = activeMembers * arpuTTC
  const revenueAnnexTTC = n(entry.revenue_pt) + n(entry.revenue_shop) + n(entry.revenue_dropin)
  const revenueTotalTTC = revenueMembersTTC + revenueAnnexTTC
  const revenueMembers = revenueMembersTTC / vatDiv
  const revenueAnnex = revenueAnnexTTC / vatDiv
  const revenueTotal = revenueTotalTTC / vatDiv

  // — P&L
  const ebitda = revenueTotal - opexTotal - acquisitionTotal
  const ebit = ebitda - equipmentAmort
  // debt interest: simulator can override; otherwise from the financing schedule
  const interest = entry.interest != null && entry.interest !== '' ? n(entry.interest) : n(extras.interest)
  const ebt = ebit - interest
  const tax = ebt > 0 ? ebt * taxRate : 0
  const netProfit = ebt - tax
  const netMargin = revenueTotal > 0 ? netProfit / revenueTotal : null

  // Members whose HT membership revenue covers all monthly costs net of HT annex revenue
  // (at break-even EBT = 0, so tax is zero by construction)
  const breakEvenMembers =
    arpu > 0
      ? Math.max(
          0,
          Math.ceil((opexTotal + equipmentAmort + interest + acquisitionTotal - revenueAnnex) / arpu)
        )
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
    cancellations,
    churnRate,
    netGrowth,
    impliedDuration,
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
    interest,
    ebt,
    tax,
    netProfit,
    netMargin,
    breakEvenMembers,
  }
}

// Full month computation including financing/CAPEX schedules and cash flow.
// Cash flow = net profit + amortization (non-cash) − principal repayment − CAPEX paid this month.
export function computeEntryFull(entry, settings, capexList = [], financingList = []) {
  const monthStr = String(entry.month).slice(0, 7)
  const clubCapex = capexList.filter((c) => c.club_id === entry.club_id)
  const clubFin = financingList.filter((f) => f.club_id === entry.club_id)
  const capexAmort = capexAmortForMonth(clubCapex, monthStr)
  const { interest, principal } = financingForMonth(clubFin, monthStr)
  const c = computeMonth(entry, settings, { capexAmort, interest })
  const capexPaid = capexPaidInMonth(clubCapex, monthStr)
  const cashFlow = c.netProfit + c.equipmentAmort - principal - capexPaid
  return { ...c, principalRepayment: principal, capexPaid, cashFlow }
}

// ROI per club = annualized EBITDA (trailing real months, max 12) / total CAPEX invested
export function roiForClub(computedMonths, clubCapexList) {
  const totalInvest = capexTotal(clubCapexList)
  if (!totalInvest || !computedMonths?.length)
    return { roi: null, totalInvest, annualEbitda: null, monthsUsed: null }
  const trailing = computedMonths.slice(-12)
  const annualEbitda = (trailing.reduce((a, c) => a + n(c.ebitda), 0) * 12) / trailing.length
  return { roi: annualEbitda / totalInvest, totalInvest, annualEbitda, monthsUsed: trailing.length }
}

// ——— Forecast (3-5 year projection per club) ———
// params: {
//   startMonth 'YYYY-MM' (last real month), months (36-60),
//   startMembers, newPerMonth, churnPct (monthly %), arpu (TTC), annexTTC,
//   opexBase (monthly HT, incl. social charges), opexInflationPct (annual %),
//   acquisitionMonthly,
// }
export function forecastSeries(params, settings, clubCapexList = [], clubFinancingList = []) {
  const out = []
  let members = n(params.startMembers)
  const churn = n(params.churnPct) / 100
  const inflation = n(params.opexInflationPct) / 100
  for (let i = 1; i <= n(params.months); i++) {
    members = Math.max(0, members + n(params.newPerMonth) - members * churn)
    const monthStr = addMonths(params.startMonth, i)
    const opexInflated = n(params.opexBase) * Math.pow(1 + inflation, i / 12)
    // synthetic entry: the whole projected OPEX goes to misc_opex (staff at 0 so
    // social charges are not double counted — opexBase already includes them)
    const entry = {
      active_members: members,
      arpu: n(params.arpu),
      revenue_pt: n(params.annexTTC),
      ad_spend: n(params.acquisitionMonthly),
      misc_opex: opexInflated,
      cancellations: members * churn,
      new_members: n(params.newPerMonth),
    }
    const capexAmort = capexAmortForMonth(clubCapexList, monthStr)
    const { interest, principal } = financingForMonth(clubFinancingList, monthStr)
    const c = computeMonth(entry, settings, { capexAmort, interest })
    const capexPaid = capexPaidInMonth(clubCapexList, monthStr)
    out.push({
      month: monthStr,
      members: Math.round(members),
      revenueTotal: c.revenueTotal,
      opexTotal: c.opexTotal,
      ebitda: c.ebitda,
      ebit: c.ebit,
      interest: c.interest,
      tax: c.tax,
      netProfit: c.netProfit,
      cashFlow: c.netProfit + c.equipmentAmort - principal - capexPaid,
    })
  }
  return out
}

// Sum several forecast series (one per club) into a consolidated series
export function consolidateForecast(seriesList) {
  if (!seriesList.length) return []
  const longest = seriesList.reduce((a, s) => Math.max(a, s.length), 0)
  const keys = ['members', 'revenueTotal', 'opexTotal', 'ebitda', 'ebit', 'interest', 'tax', 'netProfit', 'cashFlow']
  return Array.from({ length: longest }, (_, i) => {
    const row = { month: seriesList.find((s) => s[i])?.[i]?.month }
    for (const k of keys) row[k] = seriesList.reduce((a, s) => a + n(s[i]?.[k]), 0)
    return row
  })
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
  const interest = sum('interest')
  const ebt = sum('ebt')
  const tax = sum('tax')
  const netProfit = sum('netProfit')
  const principalRepayment = sum('principalRepayment')
  const capexPaid = sum('capexPaid')
  const cashFlow = sum('cashFlow')

  const leads = sumEntry('leads_generated')
  const newMembers = sumEntry('new_members')
  const cancellations = sumEntry('cancellations')
  const adSpend = sumEntry('ad_spend')
  const activeMembers = sumEntry('active_members')
  const blendedArpu = activeMembers > 0 ? revenueMembers / activeMembers : 0 // HT
  const cac = newMembers > 0 ? acquisitionTotal / newMembers : null
  const churnRate = activeMembers > 0 ? cancellations / activeMembers : null
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
    interest,
    ebt,
    tax,
    netProfit,
    principalRepayment,
    capexPaid,
    cashFlow,
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
            Math.ceil(
              (opexTotal + equipmentAmort + interest + acquisitionTotal - revenueAnnex) / blendedArpu
            )
          )
        : null,
    activeMembers,
    newMembers,
    cancellations,
    churnRate,
    netGrowth: newMembers - cancellations,
    leads,
  }
}

// ——— Investor metrics & valuation ———

// A capex row describing machines/equipment conflicts with the legacy
// settings-level equipment amortization: both would feed the P&L (double count).
export const EQUIPMENT_CAPEX_RE = /machine|équipement|equipement|equipment|matériel|materiel/i

export function hasAmortDoubleCount(settings, clubCapexList) {
  return (
    n(settings?.equipment_value) > 0 &&
    (clubCapexList ?? []).some((c) => EQUIPMENT_CAPEX_RE.test(c.label ?? ''))
  )
}

// number of real months backing an annualized figure (capped at 12)
export function annualizationMonths(computedMonths) {
  return Math.min(computedMonths?.length ?? 0, 12)
}

export function annualizedEbitda(computedMonths) {
  if (!computedMonths?.length) return null
  const trailing = computedMonths.slice(-12)
  return (trailing.reduce((a, c) => a + n(c.ebitda), 0) * 12) / trailing.length
}

export function annualizedRevenue(computedMonths) {
  if (!computedMonths?.length) return null
  const trailing = computedMonths.slice(-12)
  return (trailing.reduce((a, c) => a + n(c.revenueTotal), 0) * 12) / trailing.length
}

// Snapshot for one club: latestComputed/latestEntry = the club's most recent real month,
// computedMonths = all its real months (for annualized EBITDA). Valuation = annualized EBITDA × multiple.
export function investorMetrics(latestComputed, latestEntry, settings, computedMonths) {
  const active = n(latestEntry?.active_members)
  const surface = n(settings?.surface_m2)
  const capacity = n(settings?.max_capacity)
  const multiple = settings?.ebitda_multiple != null ? n(settings.ebitda_multiple) : 5
  const annualEbitda = annualizedEbitda(computedMonths)
  const annualRevenue = annualizedRevenue(computedMonths)
  const annualMonths = annualizationMonths(computedMonths) || null
  return {
    ebitdaMargin:
      latestComputed && latestComputed.revenueTotal > 0
        ? latestComputed.ebitda / latestComputed.revenueTotal
        : null,
    revenuePerMember: latestComputed && active > 0 ? latestComputed.revenueTotal / active : null,
    // industry standard: ANNUAL revenue per m² (CHF/m²/an), same basis as annualized EBITDA
    revenuePerM2: annualRevenue != null && surface > 0 ? annualRevenue / surface : null,
    revenuePerM2Monthly: latestComputed && surface > 0 ? latestComputed.revenueTotal / surface : null,
    occupancy: capacity > 0 && latestEntry ? active / capacity : null,
    mrr: latestComputed ? latestComputed.revenueMembers : null, // HT, recurring membership revenue
    ltvCac: latestComputed?.ltvCac ?? null,
    churnRate: latestComputed?.churnRate ?? null,
    annualEbitda,
    annualRevenue,
    annualMonths,
    multiple,
    valuation: annualEbitda != null ? annualEbitda * multiple : null,
  }
}

// Group view: monetary values summed, ratios recomputed from sums (clubs with data only);
// group valuation = sum of per-club valuations (each club keeps its own multiple).
export function consolidateInvestorMetrics(perClub) {
  // perClub: [{ metrics, latestComputed, latestEntry, settings }]
  const withData = perClub.filter((p) => p.latestComputed)
  const sum = (f) => withData.reduce((a, p) => a + n(f(p)), 0)
  const revenue = sum((p) => p.latestComputed.revenueTotal)
  const ebitda = sum((p) => p.latestComputed.ebitda)
  const active = sum((p) => p.latestEntry.active_members)
  const cancellations = sum((p) => p.latestEntry.cancellations)
  const newMembers = sum((p) => p.latestEntry.new_members)
  const surface = sum((p) => p.settings?.surface_m2)
  const capacity = sum((p) => p.settings?.max_capacity)
  const mrr = sum((p) => p.latestComputed.revenueMembers)
  const acquisition = sum((p) => p.latestComputed.acquisitionTotal)
  const cac = newMembers > 0 ? acquisition / newMembers : null
  const blendedArpu = active > 0 ? mrr / active : 0
  const weightedDuration =
    active > 0
      ? sum((p) => p.latestComputed.duration * n(p.latestEntry.active_members)) / active
      : 30
  const ltv = blendedArpu * weightedDuration
  const annualEbitda = perClub.reduce((a, p) => a + n(p.metrics.annualEbitda), 0)
  const annualRevenue = perClub.reduce((a, p) => a + n(p.metrics.annualRevenue), 0)
  const valuation = perClub.reduce((a, p) => a + n(p.metrics.valuation), 0)
  // most conservative annualization basis across clubs with data
  const annualMonths = withData.length
    ? Math.min(...withData.map((p) => p.metrics.annualMonths ?? 12))
    : null
  return {
    ebitdaMargin: revenue > 0 ? ebitda / revenue : null,
    revenuePerMember: active > 0 ? revenue / active : null,
    revenuePerM2: surface > 0 && withData.length ? annualRevenue / surface : null, // CHF/m²/an
    revenuePerM2Monthly: surface > 0 ? revenue / surface : null,
    occupancy: capacity > 0 ? active / capacity : null,
    mrr,
    ltvCac: cac > 0 ? ltv / cac : null,
    churnRate: active > 0 ? cancellations / active : null,
    annualEbitda: withData.length ? annualEbitda : null,
    annualRevenue: withData.length ? annualRevenue : null,
    annualMonths,
    valuation: withData.length ? valuation : null,
    multiple: null, // per-club multiples, no single group figure
    activeMembers: active,
    capacity,
  }
}

export const EMPTY_ENTRY = {
  ad_spend: 0,
  agency_fees: 0,
  video_fees: 0,
  leads_generated: 0,
  new_members: 0,
  cancellations: 0,
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
