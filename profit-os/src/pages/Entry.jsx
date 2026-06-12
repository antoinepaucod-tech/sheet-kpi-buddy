import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClubs, useSettings, useEntries, useUpsertEntry, useMyRole, useCapex, useFinancing } from '../hooks/useData'
import { computeEntryFull, DEFAULT_SETTINGS, EMPTY_ENTRY } from '../lib/calc'
import { fmtMoney, fmtMoney2, fmtPct, fmtRatio, fmtMonths, fmtNum, monthValue } from '../lib/format'
import { Card, KpiCard, SectionTitle, ClubSelect, MonthPicker, NumField, Button, Spinner } from '../components/ui'

export default function Entry() {
  const { t } = useTranslation()
  const { data: clubs, isLoading: l1 } = useClubs()
  const { data: settings, isLoading: l2 } = useSettings()
  const { data: entries, isLoading: l3 } = useEntries()
  const { data: role } = useMyRole()
  const { data: capex } = useCapex()
  const { data: financing } = useFinancing()
  const upsert = useUpsertEntry()

  const [clubId, setClubId] = useState(null)
  const [month, setMonth] = useState(monthValue())
  const [form, setForm] = useState(EMPTY_ENTRY)
  const [flash, setFlash] = useState(null)

  const selected = clubId ?? clubs?.[0]?.id ?? null
  const clubSettings = useMemo(
    () => (settings ?? []).find((s) => s.club_id === selected) ?? DEFAULT_SETTINGS,
    [settings, selected]
  )
  const existing = useMemo(
    () => (entries ?? []).find((e) => e.club_id === selected && e.month.slice(0, 7) === month),
    [entries, selected, month]
  )
  const readOnly = role === 'viewer'

  useEffect(() => {
    if (existing) {
      const { id, club_id, month: m, created_by, created_at, updated_at, ...fields } = existing
      setForm(fields)
    } else {
      setForm(EMPTY_ENTRY)
    }
  }, [existing, selected, month])

  const computed = computeEntryFull(
    { ...form, club_id: selected, month: `${month}-01` },
    clubSettings,
    capex ?? [],
    financing ?? []
  )
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }))

  async function save() {
    await upsert.mutateAsync({
      ...normalize(form),
      club_id: selected,
      month: `${month}-01`,
    })
    setFlash(t('entry.saveSuccess'))
    setTimeout(() => setFlash(null), 2500)
  }

  if (l1 || l2 || l3) return <Spinner />

  return (
    <div className="flex flex-col gap-5 py-2">
      <SectionTitle>{t('entry.title')}</SectionTitle>

      <div className="grid grid-cols-2 gap-3">
        <ClubSelect clubs={clubs} value={selected} onChange={setClubId} />
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {existing ? <p className="text-xs text-accent">{t('entry.existing')}</p> : null}
      {readOnly ? <p className="text-xs text-muted">{t('entry.viewerBlocked')}</p> : null}

      <Card>
        <h3 className="mb-3 font-display text-xl uppercase text-accent">{t('entry.acquisition')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumField label={t('entry.adSpend')} value={form.ad_spend} onChange={set('ad_spend')} disabled={readOnly} />
          <NumField label={t('entry.agencyFees')} value={form.agency_fees} onChange={set('agency_fees')} disabled={readOnly} />
          <NumField label={t('entry.videoFees')} value={form.video_fees} onChange={set('video_fees')} disabled={readOnly} />
          <NumField label={t('entry.leads')} value={form.leads_generated} onChange={set('leads_generated')} disabled={readOnly} />
          <NumField label={t('entry.newMembers')} value={form.new_members} onChange={set('new_members')} disabled={readOnly} />
          <NumField label={t('entry.cancellations')} value={form.cancellations} onChange={set('cancellations')} disabled={readOnly} />
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-xl uppercase text-accent">{t('entry.opex')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label={t('entry.staff')}
            value={form.staff_cost}
            onChange={set('staff_cost')}
            disabled={readOnly}
            hint={t('entry.staffHint', { rate: fmtPct(computed.chargesRate) })}
          />
          <NumField label={t('entry.rent')} value={form.rent} onChange={set('rent')} disabled={readOnly} />
          <NumField label={t('entry.cleaning')} value={form.cleaning} onChange={set('cleaning')} disabled={readOnly} />
          <NumField label={t('entry.insurance')} value={form.insurance} onChange={set('insurance')} disabled={readOnly} />
          <NumField label={t('entry.energy')} value={form.energy} onChange={set('energy')} disabled={readOnly} />
          <NumField label={t('entry.misc')} value={form.misc_opex} onChange={set('misc_opex')} disabled={readOnly} />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-card2 px-3 py-2.5">
          <div>
            <p className="text-sm text-white/80">{t('entry.amortAuto')}</p>
            <p className="text-xs text-muted">{t('entry.amortHint')}</p>
          </div>
          <span className="num font-semibold text-white">{fmtMoney(computed.equipmentAmort)}</span>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-xl uppercase text-accent">{t('entry.revenue')}</h3>
        <p className="mb-3 text-xs text-muted">{t('entry.ttcNote', { rate: fmtPct(computed.vatRate) })}</p>
        <div className="grid grid-cols-2 gap-3">
          <NumField label={t('entry.activeMembers')} value={form.active_members} onChange={set('active_members')} disabled={readOnly} />
          <NumField
            label={t('entry.arpu')}
            value={form.arpu}
            onChange={set('arpu')}
            disabled={readOnly}
            placeholder={String(clubSettings.default_arpu)}
            hint={t('entry.arpuHint', { value: fmtMoney2(clubSettings.default_arpu) })}
          />
          <NumField label={t('entry.revenuePt')} value={form.revenue_pt} onChange={set('revenue_pt')} disabled={readOnly} />
          <NumField label={t('entry.revenueShop')} value={form.revenue_shop} onChange={set('revenue_shop')} disabled={readOnly} />
          <NumField label={t('entry.revenueDropin')} value={form.revenue_dropin} onChange={set('revenue_dropin')} disabled={readOnly} />
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-xl uppercase text-white/90">{t('entry.computed')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard label={t('kpi.cpl')} value={fmtMoney2(computed.cpl)} />
          <KpiCard label={t('kpi.cac')} value={fmtMoney2(computed.cac)} />
          <KpiCard label={t('kpi.ltv')} value={fmtMoney(computed.ltv)} />
          <KpiCard label={t('kpi.ltvCac')} value={fmtRatio(computed.ltvCac)} tone="accent" />
          <KpiCard label={t('kpi.payback')} value={fmtMonths(computed.paybackMonths)} />
          <KpiCard label={t('kpi.breakEven')} value={`${fmtNum(computed.breakEvenMembers)} ${t('kpi.breakEvenUnit')}`} />
          <KpiCard
            label={t('kpi.churn')}
            value={fmtPct(computed.churnRate)}
            sub={`${t('kpi.netGrowth')}: ${computed.netGrowth >= 0 ? '+' : ''}${fmtNum(computed.netGrowth)}`}
          />
          <KpiCard
            label={t('kpi.impliedDuration')}
            value={fmtMonths(computed.impliedDuration)}
            sub={t('kpi.configuredDuration', { value: fmtNum(computed.duration) })}
          />
          <KpiCard label={t('kpi.interest')} value={fmtMoney(computed.interest)} />
          <KpiCard
            label={t('kpi.cashFlow')}
            value={fmtMoney(computed.cashFlow)}
            tone={computed.cashFlow >= 0 ? 'pos' : 'neg'}
          />
          <KpiCard label={t('kpi.revenue')} value={fmtMoney(computed.revenueTotal)} sub={`${t('club.ttc')}: ${fmtMoney(computed.revenueTotalTTC)}`} />
          <KpiCard label={t('kpi.opex')} value={fmtMoney(computed.opexTotal + computed.equipmentAmort)} />
          <KpiCard
            label={t('kpi.ebitda')}
            value={fmtMoney(computed.ebitda)}
            tone={computed.ebitda >= 0 ? 'pos' : 'neg'}
          />
          <KpiCard label={t('kpi.tax')} value={fmtMoney(computed.tax)} />
          <KpiCard
            label={t('kpi.netProfit')}
            value={fmtMoney(computed.netProfit)}
            tone={computed.netProfit >= 0 ? 'pos' : 'neg'}
            sub={fmtPct(computed.netMargin)}
          />
        </div>
      </Card>

      {!readOnly ? (
        <Button onClick={save} disabled={upsert.isPending || !selected} className="py-3">
          {flash ?? t('common.save')}
        </Button>
      ) : null}
    </div>
  )
}

// Coerce form strings to numbers / nulls before writing to Postgres
function normalize(form) {
  const out = {}
  for (const [k, v] of Object.entries(form)) {
    if (k === 'notes') {
      out[k] = v || null
    } else if (k === 'arpu' || k === 'equipment_amort_override') {
      out[k] = v === '' || v == null ? null : Number(v)
    } else {
      out[k] = v === '' || v == null ? 0 : Number(v)
    }
  }
  return out
}
