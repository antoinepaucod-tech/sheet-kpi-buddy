// Offline validation of all business calculations against the Versoix demo data
// (exact same values as seeded in profit_monthly_entries).
import { computeMonth, consolidate } from '../src/lib/calc.js'

let failures = 0
const check = (label, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}
const close = (a, b, eps = 0.01) => Math.abs(a - b) < eps

const versoixSettings = {
  avg_membership_months: 30,
  default_arpu: 159,
  equipment_value: 180000,
  equipment_amort_months: 60,
}

const april = {
  club_id: 'versoix',
  month: '2026-04-01',
  ad_spend: 3500, agency_fees: 1200, video_fees: 800, leads_generated: 120, new_members: 24,
  staff_cost: 18000, rent: 6500, cleaning: 900, insurance: 450, energy: 1100, misc_opex: 600,
  active_members: 210, arpu: 159, revenue_pt: 4200, revenue_shop: 850, revenue_dropin: 600,
}

const may = {
  club_id: 'versoix',
  month: '2026-05-01',
  ad_spend: 4200, agency_fees: 1200, video_fees: 0, leads_generated: 145, new_members: 31,
  staff_cost: 18200, rent: 6500, cleaning: 900, insurance: 450, energy: 950, misc_opex: 400,
  active_members: 228, arpu: 159, revenue_pt: 4800, revenue_shop: 920, revenue_dropin: 740,
}

// April — hand-computed expectations
const c = computeMonth(april, versoixSettings)
check('CPL = 3500/120 = 29.17', close(c.cpl, 29.1667), c.cpl.toFixed(4))
check('CAC = (3500+1200+800)/24 = 229.17', close(c.cac, 229.1667), c.cac.toFixed(4))
check('LTV = 159 × 30 = 4770', c.ltv === 4770, String(c.ltv))
check('LTV:CAC = 4770/229.17 = 20.81', close(c.ltvCac, 20.8145, 0.001), c.ltvCac.toFixed(4))
check('Payback = 229.17/159 = 1.44 mois', close(c.paybackMonths, 1.4413, 0.001), c.paybackMonths.toFixed(4))
check('Amortissement lissé = 180000/60 = 3000', c.equipmentAmort === 3000, String(c.equipmentAmort))
check('OPEX = 18000+6500+900+450+1100+600+3000 = 30550', c.opexTotal === 30550, String(c.opexTotal))
check('Revenus = 210×159 + 4200+850+600 = 39040', c.revenueTotal === 39040, String(c.revenueTotal))
check('Acquisition = 5500', c.acquisitionTotal === 5500, String(c.acquisitionTotal))
check('Résultat net = 39040-30550-5500 = 2990', c.netProfit === 2990, String(c.netProfit))
check('Marge nette = 2990/39040 = 7.66%', close(c.netMargin, 0.07659, 0.0001), (c.netMargin * 100).toFixed(2) + '%')
check('Break-even = ceil((30550+5500-5650)/159) = 192', c.breakEvenMembers === 192, String(c.breakEvenMembers))

// May — spot checks
const m = computeMonth(may, versoixSettings)
check('Mai: CAC = 5400/31 = 174.19', close(m.cac, 174.1935, 0.001), m.cac.toFixed(4))
check('Mai: revenus = 228×159+6460 = 42712', m.revenueTotal === 42712, String(m.revenueTotal))
check('Mai: OPEX = 30400', m.opexTotal === 30400, String(m.opexTotal))
check('Mai: net = 42712-30400-5400 = 6912', m.netProfit === 6912, String(m.netProfit))

// Consolidation: two clubs same month -> group must be the exact sum
const otherSettings = { avg_membership_months: 24, default_arpu: 120, equipment_value: 60000, equipment_amort_months: 60 }
const other = { ...april, club_id: 'other', arpu: null, active_members: 100 }
const list = [computeMonth(april, versoixSettings), computeMonth(other, otherSettings)]
const group = consolidate(list, [april, other])
check('Consolidé: revenus = somme exacte', close(group.revenueTotal, list[0].revenueTotal + list[1].revenueTotal))
check('Consolidé: OPEX = somme exacte', close(group.opexTotal, list[0].opexTotal + list[1].opexTotal))
check('Consolidé: net = somme exacte', close(group.netProfit, list[0].netProfit + list[1].netProfit))
check('Consolidé: acquisition = somme exacte', close(group.acquisitionTotal, list[0].acquisitionTotal + list[1].acquisitionTotal))
check(
  'Consolidé: CAC recalculé depuis les sommes (11000/48)',
  close(group.cac, (list[0].acquisitionTotal + list[1].acquisitionTotal) / 48),
  group.cac.toFixed(2)
)

console.log(failures === 0 ? '\n🎉 Tous les calculs sont corrects' : `\n💥 ${failures} échec(s)`)
process.exit(failures === 0 ? 0 : 1)
