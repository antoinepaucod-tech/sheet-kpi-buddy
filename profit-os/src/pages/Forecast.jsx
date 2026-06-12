import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { useClubs, useSettings, useEntries, useCapex, useFinancing } from '../hooks/useData'
import { computeEntryFull, forecastSeries, consolidateForecast, DEFAULT_SETTINGS } from '../lib/calc'
import { fmtMoney, fmtNum, monthLabel, monthValue } from '../lib/format'
import { Card, ClubSelect, SliderField, Spinner } from '../components/ui'

const GROUP = '__group__'

// Default assumptions for a club, derived from its latest real month when available
function defaultParams(clubId, entries, settings, capex, financing) {
  const clubEntries = (entries ?? []).filter((e) => e.club_id === clubId)
  const last = clubEntries[clubEntries.length - 1]
  const s = (settings ?? []).find((x) => x.club_id === clubId) ?? DEFAULT_SETTINGS
  if (!last) {
    return {
      fromReal: false,
      startMonth: monthValue(),
      startMembers: 150,
      newPerMonth: 20,
      churnPct: 3.3,
      arpu: Number(s.default_arpu) || 179,
      annexTTC: 4000,
      opexBase: 25000,
      opexInflationPct: 2,
      acquisitionMonthly: 4000,
    }
  }
  const c = computeEntryFull(last, s, capex ?? [], financing ?? [])
  return {
    fromReal: true,
    startMonth: last.month.slice(0, 7),
    startMembers: last.active_members,
    newPerMonth: last.new_members,
    churnPct: c.churnRate != null ? +(c.churnRate * 100).toFixed(2) : 3.3,
    arpu: c.arpuTTC,
    annexTTC: c.revenueAnnexTTC,
    opexBase: Math.round(c.opexTotal),
    opexInflationPct: 2,
    acquisitionMonthly: Math.round(c.acquisitionTotal),
  }
}

export default function Forecast() {
  const { t } = useTranslation()
  const { data: clubs, isLoading: l1 } = useClubs()
  const { data: settings, isLoading: l2 } = useSettings()
  const { data: entries, isLoading: l3 } = useEntries()
  const { data: capex } = useCapex()
  const { data: financing } = useFinancing()

  const [view, setView] = useState(null) // club id or GROUP
  const [months, setMonths] = useState(36)
  const [overrides, setOverrides] = useState({}) // clubId -> params

  const ready = !l1 && !l2 && !l3
  const selected = view ?? clubs?.[0]?.id ?? null

  const paramsByClub = useMemo(() => {
    if (!ready) return {}
    return Object.fromEntries(
      (clubs ?? []).map((club) => [
        club.id,
        { ...defaultParams(club.id, entries, settings, capex, financing), ...(overrides[club.id] ?? {}) },
      ])
    )
  }, [ready, clubs, entries, settings, capex, financing, overrides])

  const seriesByClub = useMemo(() => {
    if (!ready) return {}
    return Object.fromEntries(
      (clubs ?? []).map((club) => {
        const s = (settings ?? []).find((x) => x.club_id === club.id) ?? DEFAULT_SETTINGS
        const p = paramsByClub[club.id]
        return [
          club.id,
          forecastSeries(
            { ...p, months },
            s,
            (capex ?? []).filter((c) => c.club_id === club.id),
            (financing ?? []).filter((f) => f.club_id === club.id)
          ),
        ]
      })
    )
  }, [ready, clubs, settings, capex, financing, paramsByClub, months])

  if (!ready) return <Spinner />

  const isGroup = selected === GROUP
  const series = isGroup
    ? consolidateForecast(Object.values(seriesByClub))
    : (seriesByClub[selected] ?? [])
  const club = (clubs ?? []).find((c) => c.id === selected)
  const params = isGroup ? null : paramsByClub[selected]
  const setParam = (key) => (v) =>
    setOverrides((o) => ({ ...o, [selected]: { ...(o[selected] ?? {}), [key]: v } }))

  const chartData = series.map((row) => ({
    name: monthLabel(row.month),
    [t('kpi.revenue')]: Math.round(row.revenueTotal),
    [t('kpi.ebitda')]: Math.round(row.ebitda),
    [t('kpi.netProfit')]: Math.round(row.netProfit),
    [t('kpi.members')]: row.members,
  }))

  // annual summary
  const years = []
  for (let y = 0; y * 12 < series.length; y++) {
    const slice = series.slice(y * 12, (y + 1) * 12)
    years.push({
      n: y + 1,
      ebitda: slice.reduce((a, r) => a + r.ebitda, 0),
      net: slice.reduce((a, r) => a + r.netProfit, 0),
      members: slice[slice.length - 1]?.members,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <select
          value={selected ?? ''}
          onChange={(e) => setView(e.target.value)}
          className="w-full rounded-xl border border-line bg-card2 px-3 py-2.5 text-base text-white outline-none focus:border-accent"
        >
          {(clubs ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value={GROUP}>{t('forecast.consolidated')}</option>
        </select>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="num w-full rounded-xl border border-line bg-card2 px-3 py-2.5 text-base text-white outline-none focus:border-accent"
        >
          {[36, 48, 60].map((m) => (
            <option key={m} value={m}>{t('forecast.months', { count: m })}</option>
          ))}
        </select>
      </div>

      {!isGroup && params ? (
        <Card className="flex flex-col gap-4">
          <div>
            <h3 className="font-display text-xl uppercase text-accent">
              {t('forecast.params', { club: club?.name })}
            </h3>
            <p className="text-xs text-muted">
              {params.fromReal ? t('forecast.fromReal') : t('forecast.noBase')}
            </p>
          </div>
          <SliderField label={t('forecast.startMembers')} value={params.startMembers} onChange={setParam('startMembers')} min={0} max={600} format={fmtNum} />
          <SliderField label={t('forecast.newPerMonth')} value={params.newPerMonth} onChange={setParam('newPerMonth')} min={0} max={80} format={fmtNum} />
          <SliderField label={t('forecast.churnMonthly')} value={params.churnPct} onChange={setParam('churnPct')} min={0} max={12} step={0.1} format={(v) => `${fmtNum(v)} %`} />
          <SliderField label={t('forecast.arpu')} value={params.arpu} onChange={setParam('arpu')} min={0} max={400} format={fmtMoney} />
          <SliderField label={t('forecast.annex')} value={params.annexTTC} onChange={setParam('annexTTC')} min={0} max={30000} step={100} format={fmtMoney} />
          <SliderField label={t('forecast.opexBase')} value={params.opexBase} onChange={setParam('opexBase')} min={0} max={100000} step={500} format={fmtMoney} />
          <SliderField label={t('forecast.opexInflation')} value={params.opexInflationPct} onChange={setParam('opexInflationPct')} min={0} max={10} step={0.1} format={(v) => `${fmtNum(v)} %`} />
          <SliderField label={t('forecast.acquisitionMonthly')} value={params.acquisitionMonthly} onChange={setParam('acquisitionMonthly')} min={0} max={30000} step={250} format={fmtMoney} />
        </Card>
      ) : null}

      <Card>
        <h3 className="mb-3 text-sm font-medium text-white/80">
          {t('forecast.chart')} — {isGroup ? t('forecast.consolidated') : club?.name}
        </h3>
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="#26262C" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#8E8E96', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(months / 8))} />
              <YAxis tick={{ fill: '#8E8E96', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip contentStyle={{ background: '#1A1A1F', border: '1px solid #26262C', borderRadius: 12, fontFamily: 'Inter', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Inter' }} />
              <Line dataKey={t('kpi.revenue')} stroke="#F97316" strokeWidth={2} dot={false} />
              <Line dataKey={t('kpi.ebitda')} stroke="#EAB308" strokeWidth={2} dot={false} />
              <Line dataKey={t('kpi.netProfit')} stroke="#22C55E" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-medium text-white/80">{t('forecast.yearSummary')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-1.5 font-medium" />
                <th className="num py-1.5 text-right font-medium">{t('kpi.members')}</th>
                <th className="num py-1.5 text-right font-medium">{t('kpi.ebitda')}</th>
                <th className="num py-1.5 text-right font-medium">{t('kpi.netProfit')}</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.n} className="border-t border-line">
                  <td className="py-1.5 text-muted">{t('forecast.year', { n: y.n })}</td>
                  <td className="num py-1.5 text-right text-white">{fmtNum(y.members)}</td>
                  <td className={`num py-1.5 text-right ${y.ebitda >= 0 ? 'text-pos' : 'text-neg'}`}>{fmtMoney(y.ebitda)}</td>
                  <td className={`num py-1.5 text-right ${y.net >= 0 ? 'text-pos' : 'text-neg'}`}>{fmtMoney(y.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
