import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClubs, useSettings, useEntries, useCapex, useFinancing } from '../hooks/useData'
import {
  computeEntryFull, investorMetrics, consolidateInvestorMetrics, DEFAULT_SETTINGS,
} from '../lib/calc'
import { fmtMoney, fmtMoney2, fmtPct, fmtRatio, fmtNum, monthLabel } from '../lib/format'
import { Card, KpiCard, SectionTitle, Button, Spinner } from '../components/ui'

const GROUP = '__group__'

export default function InvestorView() {
  const { t, i18n } = useTranslation()
  const { data: clubs, isLoading: l1 } = useClubs()
  const { data: settings, isLoading: l2 } = useSettings()
  const { data: entries, isLoading: l3 } = useEntries()
  const { data: capex } = useCapex()
  const { data: financing } = useFinancing()
  const [view, setView] = useState(GROUP)
  const [exporting, setExporting] = useState(false)

  const perClub = useMemo(() => {
    if (!clubs || !entries) return []
    return clubs.map((club) => {
      const s = (settings ?? []).find((x) => x.club_id === club.id) ?? DEFAULT_SETTINGS
      const clubEntries = entries.filter((e) => e.club_id === club.id)
      const computed = clubEntries.map((e) => computeEntryFull(e, s, capex ?? [], financing ?? []))
      const latestEntry = clubEntries[clubEntries.length - 1] ?? null
      const latestComputed = computed[computed.length - 1] ?? null
      return {
        club,
        settings: s,
        latestEntry,
        latestComputed,
        metrics: investorMetrics(latestComputed, latestEntry, s, computed),
      }
    })
  }, [clubs, settings, entries, capex, financing])

  const group = useMemo(() => consolidateInvestorMetrics(perClub), [perClub])

  if (l1 || l2 || l3) return <Spinner />

  const isGroup = view === GROUP
  const current = isGroup ? null : perClub.find((p) => p.club.id === view)
  const m = isGroup ? group : current?.metrics
  const active = isGroup ? group.activeMembers : (current?.latestEntry?.active_members ?? 0)
  const capacity = isGroup ? group.capacity : (current?.settings?.max_capacity ?? 0)

  async function exportPdf() {
    setExporting(true)
    try {
      const { buildInvestorPdf } = await import('../lib/investorPdf')
      const latestMonth = perClub
        .map((p) => p.latestEntry?.month)
        .filter(Boolean)
        .sort()
        .pop()
      const doc = await buildInvestorPdf({
        generatedAt: new Date().toLocaleDateString(i18n.language === 'fr' ? 'fr-CH' : 'en-GB'),
        clubCount: perClub.length,
        monthLabel: latestMonth ? monthLabel(latestMonth) : '—',
        group,
        clubs: perClub.map((p) => ({
          name: p.club.name,
          month: p.latestEntry ? monthLabel(p.latestEntry.month) : null,
          mrr: p.metrics.mrr,
          ebitdaMargin: p.metrics.ebitdaMargin,
          occupancy: p.metrics.occupancy,
          churnRate: p.metrics.churnRate,
          valuation: p.metrics.valuation,
          multiple: p.metrics.multiple,
        })),
        labels: {
          title: t('investor.title'),
          group: t('investor.group'),
          valuation: t('investor.valuation'),
          valuationBasisGroup: t('investor.valuationBasisGroup'),
          annualEbitda: t('investor.annualEbitda'),
          mrr: t('investor.mrr'),
          ebitdaMargin: t('investor.ebitdaMargin'),
          occupancy: t('investor.occupancy'),
          revenuePerMember: t('investor.revenuePerMember'),
          revenuePerM2: t('investor.revenuePerM2'),
          ltvCac: t('kpi.ltvCac'),
          churn: t('kpi.churn'),
          byClub: t('investor.byClub'),
          annualizedNote:
            group.annualMonths && group.annualMonths < 12
              ? t('investor.annualizedOn', { n: group.annualMonths })
              : null,
        },
        fmt: { money: fmtMoney, pct: fmtPct, ratio: fmtRatio, num: fmtNum },
      })
      doc.save('profit-os-investor-view.pdf')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>{t('investor.title')}</SectionTitle>
        {isGroup ? (
          <Button onClick={exportPdf} disabled={exporting} className="px-3 py-2 text-xs">
            {exporting ? t('investor.exporting') : t('investor.export')}
          </Button>
        ) : null}
      </div>

      <select
        value={view}
        onChange={(e) => setView(e.target.value)}
        className="w-full rounded-xl border border-line bg-card2 px-3 py-2.5 text-base text-white outline-none focus:border-accent"
      >
        <option value={GROUP}>{t('investor.group')}</option>
        {(clubs ?? []).map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <p className="text-xs text-muted">{t('investor.latestMonth')}</p>

      {!isGroup && !current?.latestComputed ? (
        <Card>
          <p className="text-sm text-muted">{t('investor.noData')}</p>
        </Card>
      ) : (
        <>
          <Card className="border-accent/40">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              {t('investor.valuation')}
            </span>
            <p className="num font-display text-5xl text-accent">{fmtMoney(m?.valuation)}</p>
            <p className="num mt-1 text-xs text-muted">
              {isGroup
                ? t('investor.valuationBasisGroup')
                : t('investor.valuationBasis', { multiple: `${fmtNum(m?.multiple)}x` })}
              {' · '}
              {t('investor.annualEbitda')}: <span className="text-white">{fmtMoney(m?.annualEbitda)}</span>
              {m?.annualMonths && m.annualMonths < 12 ? (
                <span className="text-accent"> · {t('investor.annualizedOn', { n: m.annualMonths })}</span>
              ) : null}
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard label={t('investor.mrr')} value={fmtMoney(m?.mrr)} tone="accent" />
            <KpiCard
              label={t('investor.ebitdaMargin')}
              value={fmtPct(m?.ebitdaMargin)}
              tone={m?.ebitdaMargin >= 0 ? 'pos' : 'neg'}
            />
            <KpiCard
              label={t('investor.occupancy')}
              value={fmtPct(m?.occupancy)}
              sub={capacity ? t('investor.occupancySub', { active: fmtNum(active), capacity: fmtNum(capacity) }) : null}
            />
            <KpiCard label={t('investor.revenuePerMember')} value={fmtMoney2(m?.revenuePerMember)} />
            <KpiCard
              label={t('investor.revenuePerM2')}
              value={fmtMoney(m?.revenuePerM2)}
              sub={
                m?.annualMonths && m.annualMonths < 12
                  ? `${t('investor.revenuePerM2Unit')} · ${t('investor.annualizedOn', { n: m.annualMonths })}`
                  : t('investor.revenuePerM2Unit')
              }
            />
            <KpiCard
              label={`${t('kpi.ltvCac')} · ${t('kpi.churn')}`}
              value={fmtRatio(m?.ltvCac)}
              sub={`${t('kpi.churn')}: ${fmtPct(m?.churnRate)}`}
            />
          </div>

          {isGroup ? (
            <Card>
              <h3 className="mb-2 text-sm font-medium text-white/80">{t('investor.byClub')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted">
                      <th className="py-1.5 font-medium">Club</th>
                      <th className="num py-1.5 text-right font-medium">{t('investor.mrr')}</th>
                      <th className="num py-1.5 text-right font-medium">{t('investor.ebitdaMargin')}</th>
                      <th className="num py-1.5 text-right font-medium">{t('investor.occupancy')}</th>
                      <th className="num py-1.5 text-right font-medium">{t('investor.valuation')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perClub.map(({ club, metrics }) => (
                      <tr key={club.id} className="border-t border-line">
                        <td className="py-2">
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: club.color }} />
                          {club.name}
                        </td>
                        <td className="num py-2 text-right text-white">{fmtMoney(metrics.mrr)}</td>
                        <td className={`num py-2 text-right ${metrics.ebitdaMargin == null ? 'text-muted' : metrics.ebitdaMargin >= 0 ? 'text-pos' : 'text-neg'}`}>
                          {fmtPct(metrics.ebitdaMargin)}
                        </td>
                        <td className="num py-2 text-right text-white">{fmtPct(metrics.occupancy)}</td>
                        <td className="num py-2 text-right font-semibold text-accent">
                          {metrics.valuation != null ? `${fmtMoney(metrics.valuation)} (${fmtNum(metrics.multiple)}x)` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
