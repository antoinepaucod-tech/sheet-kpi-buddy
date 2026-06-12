// Offline validation of all business calculations against the Versoix demo data
// (exact same values as seeded), covering:
// - Swiss fiscal layer: VAT 8.1% (revenues TTC -> P&L HT), employer charges 17%, profit tax 14%
// - Investor layer: churn, CAPEX amortization, debt (interest in P&L / principal in cash flow), cash flow, ROI, forecast
import {
  computeMonth, computeEntryFull, consolidate,
  loanPayment, loanForMonth, capexAmortForMonth, capexPaidInMonth,
  roiForClub, forecastSeries, consolidateForecast,
} from '../src/lib/calc.js'

let failures = 0
const check = (label, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}
const close = (a, b, eps = 0.01) => Math.abs(a - b) < eps

// equipment moved from settings into profit_capex (investor layer)
const versoixSettings = {
  avg_membership_months: 30,
  default_arpu: 179,
  equipment_value: 0,
  equipment_amort_months: 60,
  vat_rate: 8.1,
  employer_charges_rate: 17,
  profit_tax_rate: 14,
}

const versoixCapex = [
  { club_id: 'versoix', label: 'Acquisition & fit-out club', amount: 250000, date: '2026-01-01', amort_months: 120 },
  { club_id: 'versoix', label: 'Machines & équipement', amount: 180000, date: '2026-01-01', amort_months: 60 },
]

const versoixLoan = {
  club_id: 'versoix', label: 'Prêt bancaire acquisition',
  principal: 300000, annual_rate: 4.5, term_months: 84, start_date: '2026-01-01',
}

const april = {
  club_id: 'versoix',
  month: '2026-04-01',
  ad_spend: 3500, agency_fees: 1200, video_fees: 800, leads_generated: 120, new_members: 24, cancellations: 7,
  staff_cost: 18000, rent: 6500, cleaning: 900, insurance: 450, energy: 1100, misc_opex: 600,
  active_members: 210, arpu: 179, revenue_pt: 4200, revenue_shop: 850, revenue_dropin: 600,
}

const may = {
  club_id: 'versoix',
  month: '2026-05-01',
  ad_spend: 4200, agency_fees: 1200, video_fees: 0, leads_generated: 145, new_members: 31, cancellations: 13,
  staff_cost: 18200, rent: 6500, cleaning: 900, insurance: 450, energy: 950, misc_opex: 400,
  active_members: 228, arpu: 179, revenue_pt: 4800, revenue_shop: 920, revenue_dropin: 740,
}

// ——— CAPEX schedule ———
console.log('\n— CAPEX —')
check('Amort avril = 250000/120 + 180000/60 = 5083.33', close(capexAmortForMonth(versoixCapex, '2026-04'), 5083.3333), capexAmortForMonth(versoixCapex, '2026-04').toFixed(2))
check('Amort déc 2030 (machines mois 60/60 encore actives) = 5083.33', close(capexAmortForMonth(versoixCapex, '2030-12'), 5083.3333))
check('Amort jan 2031 (machines finies) = 2083.33', close(capexAmortForMonth(versoixCapex, '2031-01'), 2083.3333))
check('Amort jan 2036 (tout amorti) = 0', capexAmortForMonth(versoixCapex, '2036-01') === 0)
check('CAPEX cash jan 2026 = 430000', capexPaidInMonth(versoixCapex, '2026-01') === 430000)
check('CAPEX cash avril 2026 = 0', capexPaidInMonth(versoixCapex, '2026-04') === 0)

// ——— Loan schedule (French annuity) ———
console.log('\n— Dette —')
const pmt = loanPayment(versoixLoan)
check('Mensualité 300k @4.5%/84m ≈ 4170.03', close(pmt, 4170.03, 0.5), pmt.toFixed(2))
const aprLoan = loanForMonth(versoixLoan, '2026-04') // 4th payment
check('Intérêts avril (4e échéance) ≈ 1090.61', close(aprLoan.interest, 1090.61, 0.5), aprLoan.interest.toFixed(2))
check('Capital avril = mensualité − intérêts', close(aprLoan.interest + aprLoan.principal, pmt))
const mayLoan = loanForMonth(versoixLoan, '2026-05')
check('Intérêts mai < intérêts avril (capital décroît)', mayLoan.interest < aprLoan.interest)
let totalPrincipal = 0
for (let i = 0; i < 84; i++) {
  const mm = `${2026 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
  totalPrincipal += loanForMonth(versoixLoan, mm).principal
}
check('Somme du capital remboursé sur 84 mois = 300000', close(totalPrincipal, 300000, 1), totalPrincipal.toFixed(2))
check('Hors période (2033-01) : zéro', loanForMonth(versoixLoan, '2033-01').interest === 0)

// ——— April full P&L ———
console.log('\n— P&L avril (fiscal + investisseur) —')
const c = computeEntryFull(april, versoixSettings, versoixCapex, [versoixLoan])
const arpuHT = 179 / 1.081
check('Revenus HT = 43240/1.081 = 40000.00', close(c.revenueTotal, 40000), c.revenueTotal.toFixed(2))
check('Charges sociales = 3060', close(c.socialCharges, 3060))
check('OPEX (hors amort) = 30610', close(c.opexTotal, 30610))
check('EBITDA = 40000−30610−5500 = 3890', close(c.ebitda, 3890), c.ebitda.toFixed(2))
check('Amortissements (CAPEX) = 5083.33', close(c.equipmentAmort, 5083.3333), c.equipmentAmort.toFixed(2))
check('EBIT = 3890−5083.33 = −1193.33', close(c.ebit, -1193.3333), c.ebit.toFixed(2))
check('Intérêts dans le P&L (entre EBIT et impôt) ≈ 1090.61', close(c.interest, aprLoan.interest), c.interest.toFixed(2))
check('Résultat avant impôt = EBIT − intérêts ≈ −2283.95', close(c.ebt, c.ebit - c.interest), c.ebt.toFixed(2))
check('Impôt = 0 (résultat avant impôt négatif)', c.tax === 0)
check('Résultat net = EBT = −2283.95', close(c.netProfit, -2283.95, 0.5), c.netProfit.toFixed(2))
check('CPL = 29.17 / CAC = 229.17 inchangés', close(c.cpl, 29.1667) && close(c.cac, 229.1667))
check('LTV HT = 4967.62 inchangé', close(c.ltv, arpuHT * 30))
check('Break-even (avec intérêts) = 224 membres', c.breakEvenMembers === 224, String(c.breakEvenMembers))

// ——— Churn ———
console.log('\n— Churn & croissance —')
check('Churn avril = 7/210 = 3.33%', close(c.churnRate, 7 / 210), (c.churnRate * 100).toFixed(2) + '%')
check('Croissance nette avril = 24−7 = +17', c.netGrowth === 17)
check('Durée déduite = 1/churn = 30.0 mois (= paramétrée)', close(c.impliedDuration, 30), c.impliedDuration.toFixed(2))
const cMay = computeEntryFull(may, versoixSettings, versoixCapex, [versoixLoan])
check('Churn mai = 13/228 = 5.70%', close(cMay.churnRate, 13 / 228), (cMay.churnRate * 100).toFixed(2) + '%')
check('Durée déduite mai = 17.54 mois', close(cMay.impliedDuration, 228 / 13), cMay.impliedDuration.toFixed(2))
check('Roll-forward cohérent: 210 + 31 − 13 = 228', 210 + may.new_members - may.cancellations === may.active_members)

// ——— Cash flow ≠ P&L ———
console.log('\n— Cash flow —')
check('Cash avril = net + amort − capital − CAPEX', close(c.cashFlow, c.netProfit + c.equipmentAmort - c.principalRepayment - c.capexPaid))
check('Cash avril ≈ −280.03', close(c.cashFlow, -280.03, 0.6), c.cashFlow.toFixed(2))
check('CASH FLOW ≠ RÉSULTAT NET (écart ≈ 2004)', Math.abs(c.cashFlow - c.netProfit) > 1000, (c.cashFlow - c.netProfit).toFixed(2))
check('Capital remboursé HORS P&L (P&L ne bouge pas si capital change)', close(c.netProfit, c.ebt - c.tax))
check('Mai: net ≈ 1439.19', close(cMay.netProfit, 1439.19, 0.6), cMay.netProfit.toFixed(2))
check('Mai: cash ≈ 3431.56 (> net grâce aux amort non-cash)', close(cMay.cashFlow, 3431.56, 0.8), cMay.cashFlow.toFixed(2))
const cumul = c.cashFlow + cMay.cashFlow
check('Trésorerie cumulée ≈ 3151.53', close(cumul, 3151.53, 1), cumul.toFixed(2))

// ——— ROI ———
console.log('\n— ROI —')
const { roi, totalInvest, annualEbitda } = roiForClub([c, cMay], versoixCapex)
check('Investissement total = 430000', totalInvest === 430000)
check('EBITDA annualisé = (3890+7835.88)×6 = 70355.28', close(annualEbitda, 70355.28, 0.5), annualEbitda.toFixed(2))
check('ROI = 70355.28/430000 = 16.36%', close(roi, 0.16362, 0.0001), (roi * 100).toFixed(2) + '%')

// ——— Forecast ———
console.log('\n— Forecast —')
const params = {
  startMonth: '2026-05', months: 36,
  startMembers: 228, newPerMonth: 31, churnPct: 5.7,
  arpu: 179, annexTTC: 6460, opexBase: 30494, opexInflationPct: 2, acquisitionMonthly: 5400,
}
const series = forecastSeries(params, versoixSettings, versoixCapex, [versoixLoan])
check('36 mois projetés', series.length === 36)
check('Premier mois = 2026-06', series[0].month === '2026-06')
check('Membres croissent (nouveaux > churn)', series[35].members > 228, `${series[35].members} membres à M+36`)
check('EBITDA M+36 > EBITDA M+1 (croissance)', series[35].ebitda > series[0].ebitda)
check('Intérêts projetés décroissants', series[35].interest < series[0].interest)
check('Impôt projeté seulement si bénéfice', series.every((r) => r.tax >= 0))
const conso = consolidateForecast([series, series])
check('Forecast consolidé = somme exacte (2 clubs identiques)', close(conso[10].ebitda, 2 * series[10].ebitda) && conso[10].members === 2 * series[10].members)

// ——— Consolidation (multi-club, same month) ———
console.log('\n— Consolidation —')
const lausanneSettings = { ...versoixSettings, profit_tax_rate: 13.8 }
const other = { ...april, club_id: 'lausanne', arpu: null, active_members: 300, cancellations: 9 }
const cOther = computeEntryFull(other, lausanneSettings, [], [])
const group = consolidate([c, cOther], [april, other])
check('Consolidé: revenus HT = somme exacte', close(group.revenueTotal, c.revenueTotal + cOther.revenueTotal))
check('Consolidé: EBITDA = somme exacte', close(group.ebitda, c.ebitda + cOther.ebitda))
check('Consolidé: intérêts = somme exacte', close(group.interest, c.interest + cOther.interest))
check('Consolidé: impôt = somme des impôts par club', close(group.tax, c.tax + cOther.tax))
check('Consolidé: net = somme exacte', close(group.netProfit, c.netProfit + cOther.netProfit))
check('Consolidé: cash flow = somme exacte', close(group.cashFlow, c.cashFlow + cOther.cashFlow))
check('Consolidé: churn = résiliations/membres actifs groupe', close(group.churnRate, (7 + 9) / (210 + 300)))

console.log(failures === 0 ? '\n🎉 Tous les calculs sont corrects' : `\n💥 ${failures} échec(s)`)
process.exit(failures === 0 ? 0 : 1)
