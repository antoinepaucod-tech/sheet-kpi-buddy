import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { useClubs, useSettings, useEntries, useCapex, useFinancing } from '../hooks/useData'
import { computeEntryFull, consolidate, DEFAULT_SETTINGS } from '../lib/calc'
import { fmtMoney, fmtPct, fmtRatio, fmtMonths, fmtNum, monthLabel } from '../lib/format'
import { Card, KpiCard, SectionTitle, Spinner } from '../components/ui'

const chartTheme = {
  grid: '#26262C',
  tick: { fill: '#8E8E96', fontSize: 11, fontFamily: 'Inter' },
  tooltip: {
    contentStyle: { background: '#1A1A1F', border: '1px solid #26262C', borderRadius: 12, fontFamily: 'Inter', fontSize: 12 },
    labelStyle: { color: '#fff' },
  },
}

export function useGroupData() {
  const clubs = useClubs()
  const settings = useSettings()
  const entries = useEntries()
  const capex = useCapex()
  const financing = useFinancing()
  const loading = clubs.isLoading || settings.isLoading || entries.isLoading || capex.isLoading || financing.isLoading

  const data = useMemo(() => {
    if (loading) return null
    const clubIds = new Set((clubs.data ?? []).map((c) => c.id))
    const settingsByClub = Object.fromEntries((settings.data ?? []).map((s) => [s.club_id, s]))
    const groupEntries = (entries.data ?? []).filter((e) => clubIds.has(e.club_id))
    const months = [...new Set(groupEntries.map((e) => e.month.slice(0, 7)))].sort()

    let cumulativeCash = 0
    const byMonth = months.map((m) => {
      const monthEntries = groupEntries.filter((e) => e.month.slice(0, 7) === m)
      const computed = monthEntries.map((e) =>
        computeEntryFull(e, settingsByClub[e.club_id] ?? DEFAULT_SETTINGS, capex.data ?? [], financing.data ?? [])
      )
      const group = consolidate(computed, monthEntries)
      cumulativeCash += group.cashFlow
      return { month: m, entries: monthEntries, computed, group, cumulativeCash }
    })

    return {
      clubs: clubs.data ?? [],
      settingsByClub,
      entries: groupEntries,
      months,
      byMonth,
      capex: capex.data ?? [],
      financing: financing.data ?? [],
    }
  }, [loading, clubs.data, settings.data, entries.data, capex.data, financing.data])

  return { data, loading }
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { data, loading } = useGroupData()

  if (loading || !data) return <Spinner />

  const latest = data.byMonth[data.byMonth.length - 1]
  const chartData = data.byMonth.map((m) => ({
    name: monthLabel(m.month),
    [t('kpi.revenue')]: Math.round(m.group.revenueTotal),
    [t('kpi.opex')]: Math.round(m.group.opexTotal + m.group.equipmentAmort),
    [t('kpi.acquisition')]: Math.round(m.group.acquisitionTotal),
    [t('kpi.ebitda')]: Math.round(m.group.ebitda),
    [t('kpi.netProfit')]: Math.round(m.group.netProfit),
  }))

  return (
    <div className="flex flex-col gap-5 py-2">
      <div>
        <SectionTitle>{t('dashboard.title')}</SectionTitle>
        <p className="text-sm text-muted">{t('dashboard.subtitle', { count: data.clubs.length })}</p>
      </div>

      {!latest ? (
        <Card>
          <p className="text-sm text-muted">{t('common.noData')}</p>
        </Card>
      ) : (
        <>
          <p className="text-xs uppercase tracking-wider text-muted">
            {t('dashboard.latestMonth')} — <span className="num">{monthLabel(latest.month)}</span>
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label={t('kpi.revenue')} value={fmtMoney(latest.group.revenueTotal)} />
            <KpiCard
              label={t('kpi.ebitda')}
              value={fmtMoney(latest.group.ebitda)}
              tone={latest.group.ebitda >= 0 ? 'pos' : 'neg'}
            />
            <KpiCard
              label={t('kpi.netProfit')}
              value={fmtMoney(latest.group.netProfit)}
              tone={latest.group.netProfit >= 0 ? 'pos' : 'neg'}
              sub={`${t('kpi.netMargin')} ${fmtPct(latest.group.netMargin)}`}
            />
            <KpiCard
              label={t('kpi.opex')}
              value={fmtMoney(latest.group.opexTotal + latest.group.equipmentAmort)}
              sub={`${t('kpi.tax')}: ${fmtMoney(latest.group.tax)}`}
            />
            <KpiCard label={t('kpi.acquisition')} value={fmtMoney(latest.group.acquisitionTotal)} />
            <KpiCard label={t('kpi.cac')} value={fmtMoney(latest.group.cac)} sub={`${t('kpi.cpl')} ${fmtMoney(latest.group.cpl)}`} />
            <KpiCard label={t('kpi.ltvCac')} value={fmtRatio(latest.group.ltvCac)} sub={`${t('kpi.ltv')} ${fmtMoney(latest.group.ltv)}`} tone="accent" />
            <KpiCard label={t('kpi.payback')} value={fmtMonths(latest.group.paybackMonths)} />
            <KpiCard
              label={t('kpi.breakEven')}
              value={`${fmtNum(latest.group.breakEvenMembers)} ${t('kpi.breakEvenUnit')}`}
              sub={`${t('kpi.activeMembers')}: ${fmtNum(latest.group.activeMembers)}`}
            />
            <KpiCard
              label={t('kpi.cashFlow')}
              value={fmtMoney(latest.group.cashFlow)}
              tone={latest.group.cashFlow >= 0 ? 'pos' : 'neg'}
              sub={`${t('kpi.treasury')}: ${fmtMoney(latest.cumulativeCash)}`}
            />
            <KpiCard
              label={t('kpi.churn')}
              value={fmtPct(latest.group.churnRate)}
              sub={`${t('kpi.netGrowth')}: ${latest.group.netGrowth >= 0 ? '+' : ''}${fmtNum(latest.group.netGrowth)}`}
            />
          </div>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-white/80">{t('dashboard.evolution')}</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="name" tick={chartTheme.tick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartTheme.tick} axisLine={false} tickLine={false} width={48} />
                  <Tooltip {...chartTheme.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Inter' }} />
                  <Bar dataKey={t('kpi.revenue')} fill="#F97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={t('kpi.opex')} fill="#52525B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={t('kpi.acquisition')} fill="#A1A1AA" radius={[4, 4, 0, 0]} />
                  <Line dataKey={t('kpi.ebitda')} stroke="#EAB308" strokeWidth={2} dot={{ r: 3 }} />
                  <Line dataKey={t('kpi.netProfit')} stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-white/80">
              {t('dashboard.byClub')} — <span className="num">{monthLabel(latest.month)}</span>
            </h3>
            <div className="flex flex-col divide-y divide-line">
              {data.clubs.map((club) => {
                const idx = latest.entries.findIndex((e) => e.club_id === club.id)
                const c = idx >= 0 ? latest.computed[idx] : null
                return (
                  <div key={club.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: club.color }} />
                      <span className="text-sm">{club.name}</span>
                    </div>
                    {c ? (
                      <div className="flex items-center gap-4">
                        <span className="num text-sm text-muted">{fmtMoney(c.revenueTotal)}</span>
                        <span className={`num text-sm font-semibold ${c.netProfit >= 0 ? 'text-pos' : 'text-neg'}`}>
                          {fmtMoney(c.netProfit)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">{t('common.noData')}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
