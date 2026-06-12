const chf = new Intl.NumberFormat('fr-CH', {
  style: 'currency',
  currency: 'CHF',
  maximumFractionDigits: 0,
})
const chf2 = new Intl.NumberFormat('fr-CH', {
  style: 'currency',
  currency: 'CHF',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const numFmt = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 1 })
const pctFmt = new Intl.NumberFormat('fr-CH', {
  style: 'percent',
  maximumFractionDigits: 1,
})

export const fmtMoney = (v) => (v == null ? '—' : chf.format(v))
export const fmtMoney2 = (v) => (v == null ? '—' : chf2.format(v))
export const fmtNum = (v) => (v == null ? '—' : numFmt.format(v))
export const fmtPct = (v) => (v == null ? '—' : pctFmt.format(v))
export const fmtRatio = (v) => (v == null ? '—' : `${numFmt.format(v)}:1`)
export const fmtMonths = (v) => (v == null ? '—' : `${numFmt.format(v)} mois`)

export function monthLabel(isoMonth) {
  // isoMonth: 'YYYY-MM-01' or 'YYYY-MM'
  const d = new Date(`${isoMonth.slice(0, 7)}-01T00:00:00`)
  return d.toLocaleDateString('fr-CH', { month: 'short', year: 'numeric' })
}

export function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
