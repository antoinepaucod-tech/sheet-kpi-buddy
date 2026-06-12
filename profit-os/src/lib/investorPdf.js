// Pitch-ready PDF export of the Investor View (group), branded Transform OS.
// Pure function of its data argument so it can run in the browser and in Node (validation).
import { jsPDF } from 'jspdf'

const BG = '#09090B'
const CARD = '#18181C'
const ACCENT = '#F97316'
const WHITE = '#F4F4F5'
const MUTED = '#9D9DA6'
const POS = '#22C55E'
const NEG = '#EF4444'

// Bebas Neue is loaded at runtime (browser) and embedded; falls back to
// helvetica bold uppercase when the font cannot be fetched (e.g. offline).
const BEBAS_URL = 'https://fonts.gstatic.com/s/bebasneue/v15/JTUSjIg69CK48gW7PXoo9Wlhyw.ttf'
let bebasB64 = null

async function tryLoadBebas() {
  if (bebasB64) return bebasB64
  try {
    const res = await fetch(BEBAS_URL)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    }
    bebasB64 = btoa(bin)
    return bebasB64
  } catch {
    return null
  }
}

// data: {
//   generatedAt, clubCount, monthLabel,
//   group: { valuation, annualEbitda, mrr, ebitdaMargin, revenuePerMember, revenuePerM2,
//            occupancy, activeMembers, capacity, ltvCac, churnRate },
//   clubs: [{ name, month, mrr, ebitdaMargin, occupancy, churnRate, valuation, multiple }],
//   labels: { ...i18n strings }, fmt: { money, pct, ratio, num }
// }
// jsPDF's standard fonts are WinAnsi-encoded: the narrow no-break space used by
// fr-CH number formatting (U+202F) is not mapped and renders as a stray glyph.
const clean = (s) => String(s).replace(/[  ]/g, ' ')

export async function buildInvestorPdf(data) {
  const rawDoc = new jsPDF({ unit: 'mm', format: 'a4' })
  // sanitize every string drawn into the PDF
  const doc = new Proxy(rawDoc, {
    get(target, prop) {
      if (prop === 'text') {
        return (txt, x, y, opts) => target.text(clean(txt), x, y, opts)
      }
      const v = target[prop]
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
  const W = 210
  const M = 14 // margin

  const bebas = await tryLoadBebas()
  if (bebas) {
    doc.addFileToVFS('BebasNeue.ttf', bebas)
    doc.addFont('BebasNeue.ttf', 'Bebas', 'normal')
  }
  const display = (size) => {
    if (bebas) doc.setFont('Bebas', 'normal')
    else doc.setFont('helvetica', 'bold')
    doc.setFontSize(size)
  }
  const body = (size, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
  }

  // dark page background
  doc.setFillColor(BG)
  doc.rect(0, 0, 210, 297, 'F')

  // — header
  doc.setFillColor(ACCENT)
  doc.rect(0, 0, W, 1.6, 'F')
  display(11)
  doc.setTextColor(MUTED)
  doc.text('TRANSFORM OS', M, 16)
  display(30)
  doc.setTextColor(ACCENT)
  doc.text(data.labels.title.toUpperCase(), M, 28)
  body(9)
  doc.setTextColor(MUTED)
  doc.text(`${data.labels.group} — ${data.clubCount} clubs · ${data.monthLabel} · ${data.generatedAt}`, M, 34)

  // — hero: group valuation
  doc.setFillColor(CARD)
  doc.roundedRect(M, 40, W - 2 * M, 34, 3, 3, 'F')
  body(8.5)
  doc.setTextColor(MUTED)
  doc.text(data.labels.valuation.toUpperCase(), M + 8, 49)
  display(28)
  doc.setTextColor(ACCENT)
  doc.text(data.fmt.money(data.group.valuation), M + 8, 61)
  body(8)
  doc.setTextColor(MUTED)
  doc.text(data.labels.valuationBasisGroup, M + 8, 68)
  body(9, true)
  doc.setTextColor(WHITE)
  doc.text(
    `${data.labels.annualEbitda}: ${data.fmt.money(data.group.annualEbitda)}`,
    W - M - 8,
    61,
    { align: 'right' }
  )
  if (data.labels.annualizedNote) {
    body(7)
    doc.setTextColor(ACCENT)
    doc.text(data.labels.annualizedNote, W - M - 8, 66, { align: 'right' })
  }

  // — KPI grid (2 rows x 3)
  const kpis = [
    [data.labels.mrr, data.fmt.money(data.group.mrr)],
    [data.labels.ebitdaMargin, data.fmt.pct(data.group.ebitdaMargin)],
    [data.labels.occupancy, data.fmt.pct(data.group.occupancy)],
    [data.labels.revenuePerMember, data.fmt.money(data.group.revenuePerMember)],
    [data.labels.revenuePerM2, data.fmt.money(data.group.revenuePerM2)],
    [`${data.labels.ltvCac} · ${data.labels.churn}`, `${data.fmt.ratio(data.group.ltvCac)} · ${data.fmt.pct(data.group.churnRate)}`],
  ]
  const gw = (W - 2 * M - 8) / 3
  kpis.forEach(([label, value], i) => {
    const x = M + (i % 3) * (gw + 4)
    const y = 80 + Math.floor(i / 3) * 26
    doc.setFillColor(CARD)
    doc.roundedRect(x, y, gw, 22, 2.5, 2.5, 'F')
    body(7)
    doc.setTextColor(MUTED)
    doc.text(label.toUpperCase(), x + 5, y + 7)
    display(15)
    doc.setTextColor(WHITE)
    doc.text(String(value), x + 5, y + 16.5)
  })

  // — per-club table
  let y = 140
  display(14)
  doc.setTextColor(WHITE)
  doc.text(data.labels.byClub.toUpperCase(), M, y)
  y += 6
  const cols = [
    { key: 'name', label: 'CLUB', x: M, align: 'left' },
    { key: 'mrr', label: data.labels.mrr.toUpperCase(), x: 84, align: 'right' },
    { key: 'ebitdaMargin', label: data.labels.ebitdaMargin.toUpperCase(), x: 113, align: 'right' },
    { key: 'occupancy', label: data.labels.occupancy.toUpperCase(), x: 140, align: 'right' },
    { key: 'churnRate', label: data.labels.churn.toUpperCase(), x: 158, align: 'right' },
    { key: 'valuation', label: data.labels.valuation.toUpperCase(), x: W - M, align: 'right' },
  ]
  body(6.5, true)
  doc.setTextColor(MUTED)
  cols.forEach((c) => doc.text(c.label, c.x, y, { align: c.align }))
  y += 2
  doc.setDrawColor(60, 60, 66)
  doc.line(M, y, W - M, y)
  y += 6
  for (const club of data.clubs) {
    body(9, true)
    doc.setTextColor(WHITE)
    doc.text(club.name, M, y)
    body(6.5)
    doc.setTextColor(MUTED)
    if (club.month) doc.text(club.month, M, y + 4)
    body(9)
    doc.setTextColor(club.mrr != null ? WHITE : MUTED)
    doc.text(data.fmt.money(club.mrr), 84, y, { align: 'right' })
    doc.setTextColor(club.ebitdaMargin == null ? MUTED : club.ebitdaMargin >= 0 ? POS : NEG)
    doc.text(data.fmt.pct(club.ebitdaMargin), 113, y, { align: 'right' })
    doc.setTextColor(club.occupancy != null ? WHITE : MUTED)
    doc.text(data.fmt.pct(club.occupancy), 140, y, { align: 'right' })
    doc.setTextColor(club.churnRate != null ? WHITE : MUTED)
    doc.text(data.fmt.pct(club.churnRate), 158, y, { align: 'right' })
    body(9, true)
    doc.setTextColor(club.valuation != null ? ACCENT : MUTED)
    doc.text(
      club.valuation != null ? `${data.fmt.money(club.valuation)} (${data.fmt.num(club.multiple)}x)` : '—',
      W - M,
      y,
      { align: 'right' }
    )
    y += 11
    doc.setDrawColor(38, 38, 44)
    doc.line(M, y - 4, W - M, y - 4)
  }

  // — footer
  doc.setFillColor(ACCENT)
  doc.rect(0, 290, W, 1.2, 'F')
  body(7)
  doc.setTextColor(MUTED)
  doc.text('PROFIT OS · TRANSFORM OS — confidentiel', M, 287)
  doc.text(data.generatedAt, W - M, 287, { align: 'right' })

  return doc
}
