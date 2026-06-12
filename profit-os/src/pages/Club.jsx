import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer, ComposedChart, Area, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts'
import { useClubs, useSettings, useEntries, useCapex, useFinancing } from '../hooks/useData'
import { computeEntryFull, roiForClub, DEFAULT_SETTINGS } from '../lib/calc'
import { fmtMoney, fmtMoney2, fmtPct, fmtRatio, fmtMonths, fmtNum, monthLabel } from '../lib/format'
import { Card, KpiCard, SectionTitle, ClubSelect, Spinner } from '../components/ui'

export default function Club() {
  const { t } = useTranslation()
  const { data: clubs, isLoading: l1 } = useClubs()
  const { data: settings, isLoading: l2 } = useSettings()
  const { data: entries, isLoading: l3 } = useEntries()
  const { data: capex } = useCapex()
  const { data: financing } = useFinancing()
  const [clubId, setClubId] = useState(null)

  const selected = clubId ?? clubs?.[0]?.id ?? null

  const rows = useMemo(() => {
    if (!entries || !selected) return []
    const s = (settings ?? []).find((x) => x.club_id === selected) ?? DEFAULT_SETTINGS
    let cumul = 0
    return entries
      .filter((e) => e.club_id === selected)
      .map((e) => {
        const c = computeEntryFull(e, s, capex ?? [], financing ?? [])
        cumul += c.cashFlow
        return { entry: e, c, cumulativeCash: cumul }
      })
  }, [entries, settings, selected, capex, financing])

  const roi = useMemo(
    () =>
      roiForClub(
        rows.map((r) => r.c),
        (capex ?? []).filter((x) => x.club_id === selected)
      ),
    [rows, capex, selected]
  )

  if (l1 || l2 || l3) return <Spinner />

  const latest = rows[rows.length - 1]
  const chartData = rows.map(({ entry, c }) => ({
    name: monthLabel(entry.month),
    [t('club.totalRevenue')]: Math.round(c.revenueTotal),
    [t('club.totalOpex')]: Math.round(c.opexTotal + c.equipmentAmort + c.acquisitionTotal),
    [t('kpi.ebitda')]: Math.round(c.ebitda),
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
              label={t('kpi.ebitda')}
              value={fmtMoney(latest.c.ebitda)}
              tone={latest.c.ebitda >= 0 ? 'pos' : 'neg'}
            />
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
            <KpiCard
              label={t('kpi.churn')}
              value={fmtPct(latest.c.churnRate)}
              sub={`${t('kpi.netGrowth')}: ${latest.c.netGrowth >= 0 ? '+' : ''}${fmtNum(latest.c.netGrowth)}`}
              tone={latest.c.netGrowth >= 0 ? 'pos' : 'neg'}
            />
            <KpiCard
              label={t('kpi.impliedDuration')}
              value={fmtMonths(latest.c.impliedDuration)}
              sub={t('kpi.configuredDuration', { value: fmtNum(latest.c.duration) })}
            />
            <KpiCard
              label={t('kpi.roi')}
              value={fmtPct(roi.roi)}
              sub={roi.totalInvest ? `CAPEX: ${fmtMoney(roi.totalInvest)}` : null}
              tone="accent"
            />
            <KpiCard
              label={t('kpi.treasury')}
              value={fmtMoney(latest.cumulativeCash)}
              tone={latest.cumulativeCash >= 0 ? 'pos' : 'neg'}
              sub={`${t('kpi.cashFlow')}: ${fmtMoney(latest.c.cashFlow)}`}
            />
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
                  <Line dataKey={t('kpi.ebitda')} stroke="#EAB308" strokeWidth={2} dot={{ r: 3 }} />
                  <Line dataKey={t('kpi.netProfit')} stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-white/80">{t('club.growth')}</h3>
            <div className="h-56">
              <ResponsiveContainer>
                <ComposedChart
                  data={rows.map(({ entry, c }) => ({
                    name: monthLabel(entry.month),
                    [t('kpi.newMembers')]: entry.new_members,
                    [t('kpi.cancellations')]: -entry.cancellations,
                    [t('kpi.members')]: entry.active_members,
                  }))}
                >
                  <CartesianGrid stroke="#26262C" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#8E8E96', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="flow" tick={{ fill: '#8E8E96', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={36} />
                  <YAxis yAxisId="stock" orientation="right" tick={{ fill: '#8E8E96', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip contentStyle={{ background: '#1A1A1F', border: '1px solid #26262C', borderRadius: 12, fontFamily: 'Inter', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Inter' }} />
                  <Bar yAxisId="flow" dataKey={t('kpi.newMembers')} fill="#22C55E" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="flow" dataKey={t('kpi.cancellations')} fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="stock" dataKey={t('kpi.members')} stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-medium text-white/80">{t('club.cash')}</h3>
            <div className="mb-4 h-56">
              <ResponsiveContainer>
                <ComposedChart
                  data={rows.map(({ entry, c, cumulativeCash }) => ({
                    name: monthLabel(entry.month),
                    [t('kpi.cashFlow')]: Math.round(c.cashFlow),
                    [t('kpi.treasury')]: Math.round(cumulativeCash),
                  }))}
                >
                  <CartesianGrid stroke="#26262C" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#8E8E96', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8E8E96', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ background: '#1A1A1F', border: '1px solid #26262C', borderRadius: 12, fontFamily: 'Inter', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Inter' }} />
                  <Bar dataKey={t('kpi.cashFlow')} fill="#F97316" radius={[4, 4, 0, 0]} />
                  <Line dataKey={t('kpi.treasury')} stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {[...rows].reverse().map(({ entry, c, cumulativeCash }) => (
              <div key={entry.id} className="border-t border-line py-2">
                <p className="num mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{monthLabel(entry.month)}</p>
                <Row label={t('club.cashNet')} value={fmtMoney(c.netProfit)} />
                <Row label={t('club.cashAmort')} value={fmtMoney(c.equipmentAmort)} />
                <Row label={t('club.cashPrincipal')} value={fmtMoney(-c.principalRepayment)} />
                <Row label={t('club.cashCapex')} value={fmtMoney(-c.capexPaid)} />
                <Row label={t('club.cashMonth')} value={fmtMoney(c.cashFlow)} bold tone={c.cashFlow >= 0 ? 'pos' : 'neg'} />
                <Row label={t('club.cashCumul')} value={fmtMoney(cumulativeCash)} tone={cumulativeCash >= 0 ? 'pos' : 'neg'} />
              </div>
            ))}
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
      <Row
        label={`${t('club.totalRevenue')} (${t('club.ttc')}: ${fmtMoney(c.revenueTotalTTC)})`}
        value={fmtMoney(c.revenueTotal)}
        bold
      />

      <div className="mt-3" />
      <Row label={t('club.staffGross')} value={fmtMoney(c.staffGross)} />
      <Row label={t('club.socialCharges', { rate: fmtPct(c.chargesRate) })} value={fmtMoney(c.socialCharges)} />
      <Row label={t('club.rent')} value={fmtMoney(entry.rent)} />
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
      <Row label={t('club.ebitda')} value={fmtMoney(c.ebitda)} bold tone={c.ebitda >= 0 ? 'pos' : 'neg'} />
      <Row label={t('club.amort')} value={fmtMoney(-c.equipmentAmort)} />
      <Row label={t('club.ebit')} value={fmtMoney(c.ebit)} bold tone={c.ebit >= 0 ? 'pos' : 'neg'} />
      <Row label={t('club.interest')} value={fmtMoney(-c.interest)} />
      <Row label={t('club.ebt')} value={fmtMoney(c.ebt)} bold tone={c.ebt >= 0 ? 'pos' : 'neg'} />
      <Row label={t('club.tax', { rate: fmtPct(c.taxRate) })} value={fmtMoney(-c.tax)} />
      <Row
        label={`${t('kpi.netProfit')} (${fmtPct(c.netMargin)})`}
        value={fmtMoney(c.netProfit)}
        bold
        tone={c.netProfit >= 0 ? 'pos' : 'neg'}
      />
    </Card>
  )
}
