import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { useClubs, useSettings, useEntries } from '../hooks/useData'
import { computeMonth, DEFAULT_SETTINGS } from '../lib/calc'
import { fmtMoney, fmtMoney2, fmtPct, fmtRatio, fmtMonths, fmtNum, monthLabel } from '../lib/format'
import { Card, KpiCard, SectionTitle, ClubSelect, Spinner } from '../components/ui'

export default function Club() {
  const { t } = useTranslation()
  const { data: clubs, isLoading: l1 } = useClubs()
  const { data: settings, isLoading: l2 } = useSettings()
  const { data: entries, isLoading: l3 } = useEntries()
  const [clubId, setClubId] = useState(null)

  const selected = clubId ?? clubs?.[0]?.id ?? null

  const rows = useMemo(() => {
    if (!entries || !selected) return []
    const s = (settings ?? []).find((x) => x.club_id === selected) ?? DEFAULT_SETTINGS
    return entries
      .filter((e) => e.club_id === selected)
      .map((e) => ({ entry: e, c: computeMonth(e, s) }))
  }, [entries, settings, selected])

  if (l1 || l2 || l3) return <Spinner />

  const latest = rows[rows.length - 1]
  const chartData = rows.map(({ entry, c }) => ({
    name: monthLabel(entry.month),
    [t('club.totalRevenue')]: Math.round(c.revenueTotal),
    [t('club.totalOpex')]: Math.round(c.opexTotal + c.acquisitionTotal),
    [t('kpi.netProfit')]: Math.round(c.netProfit),
  }))

  return (
    <div className="flex flex-col gap-5 py-2">
      <SectionTitle>{t('club.title')}</SectionTitle>
      <ClubSelect clubs={clubs} value={selected} onChange={setClubId} />

      {!latest ? (
        <Card>
          <p className="text-sm text-muted">{t('club.noEntries')}</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label={t('kpi.revenue')} value={fmtMoney(latest.c.revenueTotal)} sub={monthLabel(latest.entry.month)} />
            <KpiCard
              label={t('kpi.netProfit')}
              value={fmtMoney(latest.c.netProfit)}
              tone={latest.c.netProfit >= 0 ? 'pos' : 'neg'}
              sub={`${t('kpi.netMargin')} ${fmtPct(latest.c.netMargin)}`}
            />
            <KpiCard label={t('kpi.cac')} value={fmtMoney2(latest.c.cac)} sub={`${t('kpi.cpl')} ${fmtMoney2(latest.c.cpl)}`} />
            <KpiCard label={t('kpi.ltvCac')} value={fmtRatio(latest.c.ltvCac)} sub={`${t('kpi.ltv')} ${fmtMoney(latest.c.ltv)}`} tone="accent" />
            <KpiCard label={t('kpi.payback')} value={fmtMonths(latest.c.paybackMonths)} />
            <KpiCard
              label={t('kpi.breakEven')}
              value={`${fmtNum(latest.c.breakEvenMembers)} ${t('kpi.breakEvenUnit')}`}
              sub={`${t('kpi.activeMembers')}: ${fmtNum(latest.entry.active_members)}`}
            />
            <KpiCard label={t('kpi.newMembers')} value={fmtNum(latest.entry.new_members)} sub={`${t('kpi.leads')}: ${fmtNum(latest.entry.leads_generated)}`} />
            <KpiCard label={t('kpi.arpu')} value={fmtMoney2(latest.c.arpu)} />
          </div>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-white/80">{t('club.evolution')}</h3>
            <div className="h-60">
              <ResponsiveContainer>
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke="#26262C" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#8E8E96', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8E8E96', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ background: '#1A1A1F', border: '1px solid #26262C', borderRadius: 12, fontFamily: 'Inter', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Inter' }} />
                  <Area dataKey={t('club.totalRevenue')} fill="#F9731633" stroke="#F97316" strokeWidth={2} />
                  <Area dataKey={t('club.totalOpex')} fill="#52525B33" stroke="#52525B" strokeWidth={2} />
                  <Line dataKey={t('kpi.netProfit')} stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {[...rows].reverse().map(({ entry, c }) => (
            <PnlCard key={entry.id} entry={entry} c={c} />
          ))}
        </>
      )}
    </div>
  )
}

function Row({ label, value, bold, tone }) {
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? 'border-t border-line pt-2 font-semibold' : ''}`}>
      <span className={`text-sm ${bold ? 'text-white' : 'text-muted'}`}>{label}</span>
      <span className={`num text-sm ${tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-white'}`}>
        {value}
      </span>
    </div>
  )
}

function PnlCard({ entry, c }) {
  const { t } = useTranslation()
  return (
    <Card>
      <h3 className="mb-2 font-display text-xl uppercase text-white/90">
        {t('club.pnl')} — <span className="num">{monthLabel(entry.month)}</span>
      </h3>
      <Row label={`${t('club.revenueMembers')} (${entry.active_members} × ${fmtMoney2(c.arpu)})`} value={fmtMoney(c.revenueMembers)} />
      <Row label={t('club.revenueAnnex')} value={fmtMoney(c.revenueAnnex)} />
      <Row label={t('club.totalRevenue')} value={fmtMoney(c.revenueTotal)} bold />

      <div className="mt-3" />
      <Row label={t('club.staff')} value={fmtMoney(entry.staff_cost)} />
      <Row label={t('club.rent')} value={fmtMoney(entry.rent)} />
      <Row label={t('club.amort')} value={fmtMoney(c.equipmentAmort)} />
      <Row label={t('club.cleaning')} value={fmtMoney(entry.cleaning)} />
      <Row label={t('club.insurance')} value={fmtMoney(entry.insurance)} />
      <Row label={t('club.energy')} value={fmtMoney(entry.energy)} />
      <Row label={t('club.misc')} value={fmtMoney(entry.misc_opex)} />
      <Row label={t('club.totalOpex')} value={fmtMoney(c.opexTotal)} bold />

      <div className="mt-3" />
      <Row label={t('club.adSpend')} value={fmtMoney(entry.ad_spend)} />
      <Row label={t('club.agencyFees')} value={fmtMoney(entry.agency_fees)} />
      <Row label={t('club.videoFees')} value={fmtMoney(entry.video_fees)} />
      <Row label={t('club.totalAcquisition')} value={fmtMoney(c.acquisitionTotal)} bold />

      <div className="mt-3" />
      <Row
        label={`${t('kpi.netProfit')} (${fmtPct(c.netMargin)})`}
        value={fmtMoney(c.netProfit)}
        bold
        tone={c.netProfit >= 0 ? 'pos' : 'neg'}
      />
    </Card>
  )
}
