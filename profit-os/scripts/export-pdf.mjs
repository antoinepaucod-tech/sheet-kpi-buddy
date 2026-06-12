// Generates the Investor View PDF from the Versoix demo seeds (offline validation
// of the export). Output: /tmp/profit-os-investor-view.pdf
import { writeFileSync } from 'node:fs'
import {
  computeEntryFull, investorMetrics, consolidateInvestorMetrics,
} from '../src/lib/calc.js'
import { buildInvestorPdf } from '../src/lib/investorPdf.js'

// Same fixtures as calc.test.mjs (mirrors the DB seeds)
const versoixSettings = {
  avg_membership_months: 30, default_arpu: 179,
  equipment_value: 0, equipment_amort_months: 60,
  vat_rate: 8.1, employer_charges_rate: 17, profit_tax_rate: 14,
  surface_m2: 650, max_capacity: 350, ebitda_multiple: 5,
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
  club_id: 'versoix', month: '2026-04-01',
  ad_spend: 3500, agency_fees: 1200, video_fees: 800, leads_generated: 120, new_members: 24, cancellations: 7,
  staff_cost: 18000, rent: 6500, cleaning: 900, insurance: 450, energy: 1100, misc_opex: 600,
  active_members: 210, arpu: 179, revenue_pt: 4200, revenue_shop: 850, revenue_dropin: 600,
}
const may = {
  club_id: 'versoix', month: '2026-05-01',
  ad_spend: 4200, agency_fees: 1200, video_fees: 0, leads_generated: 145, new_members: 31, cancellations: 13,
  staff_cost: 18200, rent: 6500, cleaning: 900, insurance: 450, energy: 950, misc_opex: 400,
  active_members: 228, arpu: 179, revenue_pt: 4800, revenue_shop: 920, revenue_dropin: 740,
}

const chf = new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('fr-CH', { style: 'percent', maximumFractionDigits: 1 })
const num = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 1 })
const fmt = {
  money: (v) => (v == null ? '—' : chf.format(v)),
  pct: (v) => (v == null ? '—' : pct.format(v)),
  ratio: (v) => (v == null ? '—' : `${num.format(v)}:1`),
  num: (v) => (v == null ? '—' : num.format(v)),
}

const cApril = computeEntryFull(april, versoixSettings, versoixCapex, [versoixLoan])
const cMay = computeEntryFull(may, versoixSettings, versoixCapex, [versoixLoan])
const versoixIm = investorMetrics(cMay, may, versoixSettings, [cApril, cMay])

const noData = (name, settings) => ({
  name,
  metrics: investorMetrics(null, null, settings, []),
  latestComputed: null,
  latestEntry: null,
  settings,
})
const others = [
  noData('La Servette', { surface_m2: 800, max_capacity: 450, ebitda_multiple: 5 }),
  noData('Grand-Saconnex', { surface_m2: 550, max_capacity: 300, ebitda_multiple: 5 }),
  noData('Lausanne', { surface_m2: 700, max_capacity: 400, ebitda_multiple: 5 }),
]
const perClub = [
  { name: 'Hybrid Gym Versoix', metrics: versoixIm, latestComputed: cMay, latestEntry: may, settings: versoixSettings },
  ...others,
]
const group = consolidateInvestorMetrics(perClub)

const doc = await buildInvestorPdf({
  generatedAt: new Date().toLocaleDateString('fr-CH'),
  clubCount: 4,
  monthLabel: 'mai 2026',
  group,
  clubs: perClub.map((p) => ({
    name: p.name,
    month: p.latestEntry ? 'mai 2026' : null,
    mrr: p.metrics.mrr,
    ebitdaMargin: p.metrics.ebitdaMargin,
    occupancy: p.metrics.occupancy,
    churnRate: p.metrics.churnRate,
    valuation: p.metrics.valuation,
    multiple: p.metrics.multiple,
  })),
  labels: {
    title: 'Investor View',
    group: 'Groupe consolidé',
    valuation: 'Valorisation',
    valuationBasisGroup: 'Somme des valorisations par club (multiple propre à chaque club)',
    annualEbitda: 'EBITDA annualisé',
    mrr: 'MRR (HT)',
    ebitdaMargin: 'Marge EBITDA',
    occupancy: 'Taux d’occupation',
    revenuePerMember: 'Revenu / membre',
    revenuePerM2: 'Revenu / m²',
    ltvCac: 'LTV:CAC',
    churn: 'Churn',
    byClub: 'Par club',
  },
  fmt,
})

const out = '/tmp/profit-os-investor-view.pdf'
writeFileSync(out, Buffer.from(doc.output('arraybuffer')))
console.log(`✅ PDF généré: ${out}`)
console.log(`   Valorisation groupe: ${fmt.money(group.valuation)} (= Versoix seul, autres clubs sans données)`)
