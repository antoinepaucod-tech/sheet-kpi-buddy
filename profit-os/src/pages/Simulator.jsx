import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useClubs, useSettings, useEntries, useScenarios, useSaveScenario, useDeleteScenario, useMyRole,
} from '../hooks/useData'
import { computeMonth, DEFAULT_SETTINGS, EMPTY_ENTRY } from '../lib/calc'
import { fmtMoney, fmtMoney2, fmtPct, fmtRatio, fmtMonths, fmtNum, monthLabel, monthValue } from '../lib/format'
import { Card, KpiCard, SectionTitle, ClubSelect, MonthPicker, SliderField, Button, Spinner } from '../components/ui'

const SIM_DEFAULTS = {
  ...EMPTY_ENTRY,
  arpu: 159,
  avg_membership_months: 30,
  active_members: 150,
  new_members: 20,
  leads_generated: 100,
  ad_spend: 3000,
  agency_fees: 1000,
  video_fees: 500,
  staff_cost: 15000,
  rent: 6000,
  cleaning: 800,
  insurance: 400,
  energy: 1000,
  misc_opex: 500,
  equipment_amort_override: 2000,
}

export default function Simulator() {
  const { t } = useTranslation()
  const { data: clubs, isLoading: l1 } = useClubs()
  const { data: settings, isLoading: l2 } = useSettings()
  const { data: entries, isLoading: l3 } = useEntries()
  const { data: scenarios } = useScenarios()
  const { data: role } = useMyRole()
  const saveScenario = useSaveScenario()
  const deleteScenario = useDeleteScenario()

  const [clubId, setClubId] = useState(null)
  const [month, setMonth] = useState(monthValue())
  const [sim, setSim] = useState(SIM_DEFAULTS)
  const [name, setName] = useState('')
  const [flash, setFlash] = useState(null)

  const selected = clubId ?? clubs?.[0]?.id ?? null
  const clubSettings = useMemo(
    () => (settings ?? []).find((s) => s.club_id === selected) ?? DEFAULT_SETTINGS,
    [settings, selected]
  )
  const real = useMemo(
    () => (entries ?? []).find((e) => e.club_id === selected && e.month.slice(0, 7) === month),
    [entries, selected, month]
  )

  // Simulator always carries its own ARPU/duration so sliders work standalone
  const simComputed = computeMonth(sim, clubSettings)
  const realComputed = real ? computeMonth(real, clubSettings) : null
  const readOnly = role === 'viewer'
  const set = (key) => (v) => setSim((s) => ({ ...s, [key]: v }))

  function loadFromReal() {
    if (!real) return
    const { id, club_id, month: m, created_by, created_at, updated_at, notes, ...fields } = real
    setSim({
      ...fields,
      arpu: fields.arpu ?? clubSettings.default_arpu,
      avg_membership_months: clubSettings.avg_membership_months,
      equipment_amort_override:
        fields.equipment_amort_override ??
        Math.round(clubSettings.equipment_value / clubSettings.equipment_amort_months),
    })
  }

  async function save() {
    if (!name.trim()) return
    await saveScenario.mutateAsync({
      name: name.trim(),
      club_id: selected,
      data: { ...sim, base_month: month },
    })
    setName('')
    setFlash(t('simulator.savedOk'))
    setTimeout(() => setFlash(null), 2500)
  }

  function load(sc) {
    const { base_month, ...fields } = sc.data ?? {}
    setSim({ ...SIM_DEFAULTS, ...fields })
    if (sc.club_id) setClubId(sc.club_id)
    if (base_month) setMonth(base_month)
    setFlash(t('simulator.loaded'))
    setTimeout(() => setFlash(null), 2000)
  }

  if (l1 || l2 || l3) return <Spinner />

  const money = (v) => fmtMoney(v)

  return (
    <div className="flex flex-col gap-5 py-2">
      <SectionTitle>{t('simulator.title')}</SectionTitle>

      <div className="grid grid-cols-2 gap-3">
        <ClubSelect clubs={clubs} value={selected} onChange={setClubId} />
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={loadFromReal} disabled={!real}>
          {t('simulator.baseOn')}
        </Button>
        <Button variant="ghost" onClick={() => setSim(SIM_DEFAULTS)}>
          {t('simulator.blank')}
        </Button>
      </div>
      {!real ? <p className="text-xs text-muted">{t('simulator.noReal')}</p> : null}
      {flash ? <p className="text-xs text-accent">{flash}</p> : null}

      <Card className="flex flex-col gap-4">
        <h3 className="font-display text-xl uppercase text-accent">{t('entry.revenue')}</h3>
        <SliderField label={t('entry.activeMembers')} value={sim.active_members} onChange={set('active_members')} min={0} max={600} format={fmtNum} />
        <SliderField label={t('entry.arpu')} value={sim.arpu} onChange={set('arpu')} min={0} max={400} step={1} format={fmtMoney2} />
        <SliderField label={t('simulator.duration')} value={sim.avg_membership_months} onChange={set('avg_membership_months')} min={1} max={60} format={(v) => fmtNum(v)} />
        <SliderField label={t('entry.revenuePt')} value={sim.revenue_pt} onChange={set('revenue_pt')} min={0} max={20000} step={100} format={money} />
        <SliderField label={t('entry.revenueShop')} value={sim.revenue_shop} onChange={set('revenue_shop')} min={0} max={10000} step={50} format={money} />
        <SliderField label={t('entry.revenueDropin')} value={sim.revenue_dropin} onChange={set('revenue_dropin')} min={0} max={10000} step={50} format={money} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h3 className="font-display text-xl uppercase text-accent">{t('entry.acquisition')}</h3>
        <SliderField label={t('entry.adSpend')} value={sim.ad_spend} onChange={set('ad_spend')} min={0} max={20000} step={100} format={money} />
        <SliderField label={t('entry.agencyFees')} value={sim.agency_fees} onChange={set('agency_fees')} min={0} max={10000} step={100} format={money} />
        <SliderField label={t('entry.videoFees')} value={sim.video_fees} onChange={set('video_fees')} min={0} max={10000} step={100} format={money} />
        <SliderField label={t('entry.leads')} value={sim.leads_generated} onChange={set('leads_generated')} min={0} max={500} format={fmtNum} />
        <SliderField label={t('entry.newMembers')} value={sim.new_members} onChange={set('new_members')} min={0} max={150} format={fmtNum} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h3 className="font-display text-xl uppercase text-accent">{t('entry.opex')}</h3>
        <SliderField label={t('entry.staff')} value={sim.staff_cost} onChange={set('staff_cost')} min={0} max={60000} step={500} format={money} />
        <SliderField label={t('entry.rent')} value={sim.rent} onChange={set('rent')} min={0} max={30000} step={250} format={money} />
        <SliderField label={t('club.amort')} value={sim.equipment_amort_override} onChange={set('equipment_amort_override')} min={0} max={10000} step={100} format={money} />
        <SliderField label={t('entry.cleaning')} value={sim.cleaning} onChange={set('cleaning')} min={0} max={5000} step={50} format={money} />
        <SliderField label={t('entry.insurance')} value={sim.insurance} onChange={set('insurance')} min={0} max={5000} step={50} format={money} />
        <SliderField label={t('entry.energy')} value={sim.energy} onChange={set('energy')} min={0} max={8000} step={50} format={money} />
        <SliderField label={t('entry.misc')} value={sim.misc_opex} onChange={set('misc_opex')} min={0} max={10000} step={50} format={money} />
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-xl uppercase text-white/90">
          {t('simulator.compare')}
          {real ? <span className="num text-muted"> — {monthLabel(real.month)}</span> : null}
        </h3>
        <CompareTable sim={simComputed} real={realComputed} />
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard
          label={t('kpi.netProfit')}
          value={fmtMoney(simComputed.netProfit)}
          tone={simComputed.netProfit >= 0 ? 'pos' : 'neg'}
          sub={fmtPct(simComputed.netMargin)}
        />
        <KpiCard label={t('kpi.ltvCac')} value={fmtRatio(simComputed.ltvCac)} tone="accent" sub={`${t('kpi.cac')} ${fmtMoney2(simComputed.cac)}`} />
        <KpiCard label={t('kpi.breakEven')} value={`${fmtNum(simComputed.breakEvenMembers)} ${t('kpi.breakEvenUnit')}`} sub={`${t('kpi.payback')} ${fmtMonths(simComputed.paybackMonths)}`} />
      </div>

      {!readOnly ? (
        <Card className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('simulator.saveAs')}
            className="rounded-xl border border-line bg-card2 px-3 py-2.5 text-white outline-none focus:border-accent"
          />
          <Button onClick={save} disabled={!name.trim() || saveScenario.isPending}>
            {t('simulator.save')}
          </Button>
        </Card>
      ) : null}

      <Card>
        <h3 className="mb-2 text-sm font-medium text-white/80">{t('simulator.load')}</h3>
        {(scenarios ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t('simulator.none')}</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {scenarios.map((sc) => (
              <div key={sc.id} className="flex items-center justify-between gap-2 py-2">
                <button onClick={() => load(sc)} className="flex-1 text-left">
                  <p className="text-sm text-white">{sc.name}</p>
                  <p className="num text-xs text-muted">
                    {(clubs ?? []).find((c) => c.id === sc.club_id)?.name ?? t('common.allClubs')}
                    {sc.data?.base_month ? ` · ${monthLabel(sc.data.base_month)}` : ''}
                  </p>
                </button>
                {!readOnly ? (
                  <Button variant="danger" onClick={() => deleteScenario.mutate(sc.id)} className="px-3 py-1.5 text-xs">
                    {t('common.delete')}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function CompareTable({ sim, real }) {
  const { t } = useTranslation()
  const rows = [
    ['kpi.revenue', 'revenueTotal', fmtMoney],
    ['kpi.opex', 'opexTotal', fmtMoney],
    ['kpi.acquisition', 'acquisitionTotal', fmtMoney],
    ['kpi.netProfit', 'netProfit', fmtMoney],
    ['kpi.netMargin', 'netMargin', fmtPct],
    ['kpi.cpl', 'cpl', fmtMoney2],
    ['kpi.cac', 'cac', fmtMoney2],
    ['kpi.ltv', 'ltv', fmtMoney],
    ['kpi.ltvCac', 'ltvCac', fmtRatio],
    ['kpi.payback', 'paybackMonths', fmtMonths],
    ['kpi.breakEven', 'breakEvenMembers', fmtNum],
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted">
            <th className="py-1.5 font-medium">{t('simulator.scenario')}</th>
            <th className="num py-1.5 text-right font-medium">{t('simulator.simulated')}</th>
            <th className="num py-1.5 text-right font-medium">{t('simulator.real')}</th>
            <th className="num py-1.5 text-right font-medium">{t('simulator.delta')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([labelKey, field, fmt]) => {
            const s = sim[field]
            const r = real?.[field]
            const delta = s != null && r != null ? s - r : null
            return (
              <tr key={field} className="border-t border-line">
                <td className="py-1.5 text-muted">{t(labelKey)}</td>
                <td className="num py-1.5 text-right text-white">{fmt(s)}</td>
                <td className="num py-1.5 text-right text-muted">{real ? fmt(r) : '—'}</td>
                <td className={`num py-1.5 text-right ${delta == null ? 'text-muted' : delta >= 0 ? 'text-pos' : 'text-neg'}`}>
                  {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${fmt(delta)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
