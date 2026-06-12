// Offline validation of all business calculations against the Versoix demo data
// (exact same values as seeded in profit_monthly_entries), including the Swiss
// fiscal layer: VAT 8.1% (revenues TTC -> P&L HT), employer charges 17%, profit tax 14%.
import { computeMonth, consolidate } from '../src/lib/calc.js'

let failures = 0
const check = (label, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}
const close = (a, b, eps = 0.01) => Math.abs(a - b) < eps

const versoixSettings = {
  avg_membership_months: 30,
  default_arpu: 179,
  equipment_value: 180000,
  equipment_amort_months: 60,
  vat_rate: 8.1,
  employer_charges_rate: 17,
  profit_tax_rate: 14,
}

const april = {
  club_id: 'versoix',
  month: '2026-04-01',
  ad_spend: 3500, agency_fees: 1200, video_fees: 800, leads_generated: 120, new_members: 24,
  staff_cost: 18000, rent: 6500, cleaning: 900, insurance: 450, energy: 1100, misc_opex: 600,
  active_members: 210, arpu: 179, revenue_pt: 4200, revenue_shop: 850, revenue_dropin: 600,
}

const may = {
  club_id: 'versoix',
  month: '2026-05-01',
  ad_spend: 4200, agency_fees: 1200, video_fees: 0, leads_generated: 145, new_members: 31,
  staff_cost: 18200, rent: 6500, cleaning: 900, insurance: 450, energy: 950, misc_opex: 400,
  active_members: 228, arpu: 179, revenue_pt: 4800, revenue_shop: 920, revenue_dropin: 740,
}

// — April, hand-computed expectations
const c = computeMonth(april, versoixSettings)
const arpuHT = 179 / 1.081 // 165.5874...
check('ARPU HT = 179/1.081 = 165.59', close(c.arpu, arpuHT), c.arpu.toFixed(4))
check('CPL = 3500/120 = 29.17 (coûts HT)', close(c.cpl, 29.1667), c.cpl.toFixed(4))
check('CAC = 5500/24 = 229.17 (coûts HT)', close(c.cac, 229.1667), c.cac.toFixed(4))
check('LTV = ARPU HT × 30 = 4967.62', close(c.ltv, arpuHT * 30), c.ltv.toFixed(2))
check('LTV:CAC = 21.68', close(c.ltvCac, (arpuHT * 30) / (5500 / 24), 0.001), c.ltvCac.toFixed(4))
check('Payback = CAC/ARPU HT = 1.38 mois', close(c.paybackMonths, (5500 / 24) / arpuHT, 0.001), c.paybackMonths.toFixed(4))

// TVA : revenus TTC -> HT
check('Revenus TTC = 210×179 + 5650 = 43240', c.revenueTotalTTC === 43240, String(c.revenueTotalTTC))
check('Revenus HT = 43240/1.081 = 40000.00', close(c.revenueTotal, 40000), c.revenueTotal.toFixed(2))
check('Revenus annexes HT = 5650/1.081 = 5226.64', close(c.revenueAnnex, 5650 / 1.081), c.revenueAnnex.toFixed(2))

// Charges sociales
check('Salaires bruts = 18000', c.staffGross === 18000)
check('Charges sociales = 18000×17% = 3060', close(c.socialCharges, 3060), String(c.socialCharges))
check('Coût staff total = 21060', close(c.staffTotal, 21060))
check('OPEX (hors amort) = 21060+6500+900+450+1100+600 = 30610', close(c.opexTotal, 30610), String(c.opexTotal))
check('Amortissement lissé = 180000/60 = 3000', c.equipmentAmort === 3000)
check('Acquisition = 5500', c.acquisitionTotal === 5500)

// Structure P&L : Revenus HT − OPEX = EBITDA − Amort = EBIT − Impôt = Net
check('EBITDA = 40000−30610−5500 = 3890', close(c.ebitda, 3890), c.ebitda.toFixed(2))
check('EBIT = 3890−3000 = 890', close(c.ebit, 890), c.ebit.toFixed(2))
check('Impôt = 890×14% = 124.60 (EBIT > 0)', close(c.tax, 124.6), c.tax.toFixed(2))
check('Résultat net = 890−124.60 = 765.40', close(c.netProfit, 765.4), c.netProfit.toFixed(2))
check('Marge nette = 765.40/40000 = 1.91%', close(c.netMargin, 0.019135, 0.0001), (c.netMargin * 100).toFixed(2) + '%')
check(
  'Break-even = ceil((30610+3000+5500−5226.64)/165.59) = 205',
  c.breakEvenMembers === 205,
  String(c.breakEvenMembers)
)

// — May, spot checks
const m = computeMonth(may, versoixSettings)
check('Mai: revenus HT = 47272/1.081 = 43729.88', close(m.revenueTotal, 47272 / 1.081), m.revenueTotal.toFixed(2))
check('Mai: EBITDA = 43729.88−30494−5400 = 7835.88', close(m.ebitda, 47272 / 1.081 - 30494 - 5400), m.ebitda.toFixed(2))
check('Mai: EBIT = 4835.88', close(m.ebit, 47272 / 1.081 - 30494 - 5400 - 3000), m.ebit.toFixed(2))
check('Mai: impôt = EBIT×14% = 677.02', close(m.tax, m.ebit * 0.14), m.tax.toFixed(2))
check('Mai: net = EBIT−impôt = 4158.86', close(m.netProfit, m.ebit - m.tax), m.netProfit.toFixed(2))
check('Mai: CAC = 5400/31 = 174.19', close(m.cac, 174.1935, 0.001), m.cac.toFixed(4))

// — Tax only when EBIT > 0
const lossMonth = computeMonth({ ...april, active_members: 100 }, versoixSettings)
check('Perte: EBIT < 0', lossMonth.ebit < 0, lossMonth.ebit.toFixed(2))
check('Perte: impôt = 0', lossMonth.tax === 0)
check('Perte: net = EBIT (pas d’impôt)', close(lossMonth.netProfit, lossMonth.ebit))

// — Consolidation: two clubs same month -> group must be the exact sum
const lausanneSettings = { ...versoixSettings, profit_tax_rate: 13.8, equipment_value: 60000 }
const other = { ...april, club_id: 'lausanne', arpu: null, active_members: 100 }
const list = [computeMonth(april, versoixSettings), computeMonth(other, lausanneSettings)]
const group = consolidate(list, [april, other])
check('Consolidé: revenus HT = somme exacte', close(group.revenueTotal, list[0].revenueTotal + list[1].revenueTotal))
check('Consolidé: OPEX = somme exacte', close(group.opexTotal, list[0].opexTotal + list[1].opexTotal))
check('Consolidé: EBITDA = somme exacte', close(group.ebitda, list[0].ebitda + list[1].ebitda))
check('Consolidé: impôt = somme des impôts par club (14% + 13.8%)', close(group.tax, list[0].tax + list[1].tax))
check('Consolidé: net = somme exacte', close(group.netProfit, list[0].netProfit + list[1].netProfit))
check('Consolidé: acquisition = somme exacte', close(group.acquisitionTotal, list[0].acquisitionTotal + list[1].acquisitionTotal))
check(
  'Consolidé: CAC recalculé depuis les sommes (11000/48)',
  close(group.cac, (list[0].acquisitionTotal + list[1].acquisitionTotal) / 48),
  group.cac.toFixed(2)
)

console.log(failures === 0 ? '\n🎉 Tous les calculs sont corrects' : `\n💥 ${failures} échec(s)`)
process.exit(failures === 0 ? 0 : 1)
