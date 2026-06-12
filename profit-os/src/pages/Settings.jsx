import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useClubs, useSettings, useUpsertSettings, useMyRole,
  useFinancing, useCapex, useAddFinancing, useDeleteFinancing, useAddCapex, useDeleteCapex,
} from '../hooks/useData'
import { DEFAULT_SETTINGS, equipmentAmortMonthly, loanPayment } from '../lib/calc'
import { fmtMoney, fmtMoney2, fmtNum } from '../lib/format'
import { Card, SectionTitle, ClubSelect, NumField, Button, Spinner } from '../components/ui'

export default function Settings() {
  const { t } = useTranslation()
  const { data: clubs, isLoading: l1 } = useClubs()
  const { data: settings, isLoading: l2 } = useSettings()
  const { data: role } = useMyRole()
  const upsert = useUpsertSettings()

  const [clubId, setClubId] = useState(null)
  const [form, setForm] = useState(DEFAULT_SETTINGS)
  const [flash, setFlash] = useState(null)

  const selected = clubId ?? clubs?.[0]?.id ?? null
  const current = useMemo(
    () => (settings ?? []).find((s) => s.club_id === selected),
    [settings, selected]
  )
  const readOnly = role === 'viewer'

  useEffect(() => {
    if (current) {
      setForm({
        avg_membership_months: current.avg_membership_months,
        default_arpu: current.default_arpu,
        equipment_value: current.equipment_value,
        equipment_amort_months: current.equipment_amort_months,
        vat_rate: current.vat_rate,
        employer_charges_rate: current.employer_charges_rate,
        profit_tax_rate: current.profit_tax_rate,
        surface_m2: current.surface_m2,
        max_capacity: current.max_capacity,
        ebitda_multiple: current.ebitda_multiple,
        currency: current.currency,
      })
    } else {
      setForm(DEFAULT_SETTINGS)
    }
  }, [current, selected])

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }))
  const amort = equipmentAmortMonthly(form)

  async function save() {
    await upsert.mutateAsync({
      club_id: selected,
      avg_membership_months: Number(form.avg_membership_months) || 30,
      default_arpu: Number(form.default_arpu) || 0,
      equipment_value: Number(form.equipment_value) || 0,
      equipment_amort_months: Number(form.equipment_amort_months) || 60,
      vat_rate: Number(form.vat_rate) || 0,
      employer_charges_rate: Number(form.employer_charges_rate) || 0,
      profit_tax_rate: Number(form.profit_tax_rate) || 0,
      surface_m2: Number(form.surface_m2) || 0,
      max_capacity: Number(form.max_capacity) || 0,
      ebitda_multiple: Number(form.ebitda_multiple) || 5,
      currency: form.currency || 'CHF',
    })
    setFlash(t('common.saved'))
    setTimeout(() => setFlash(null), 2500)
  }

  if (l1 || l2) return <Spinner />

  return (
    <div className="flex flex-col gap-5 py-2">
      <SectionTitle>{t('settings.title')}</SectionTitle>
      <ClubSelect clubs={clubs} value={selected} onChange={setClubId} />

      <Card className="flex flex-col gap-3">
        <h3 className="font-display text-xl uppercase text-accent">{t('settings.clubSettings')}</h3>
        <NumField label={t('settings.avgDuration')} value={form.avg_membership_months} onChange={set('avg_membership_months')} disabled={readOnly} />
        <NumField label={t('settings.defaultArpu')} value={form.default_arpu} onChange={set('default_arpu')} step="0.01" disabled={readOnly} />
        <NumField label={t('settings.vatRate')} value={form.vat_rate} onChange={set('vat_rate')} step="0.1" disabled={readOnly} />
        <NumField label={t('settings.chargesRate')} value={form.employer_charges_rate} onChange={set('employer_charges_rate')} step="0.1" disabled={readOnly} />
        <NumField label={t('settings.taxRate')} value={form.profit_tax_rate} onChange={set('profit_tax_rate')} step="0.1" disabled={readOnly} />
        <NumField label={t('settings.surface')} value={form.surface_m2} onChange={set('surface_m2')} disabled={readOnly} />
        <NumField label={t('settings.capacity')} value={form.max_capacity} onChange={set('max_capacity')} disabled={readOnly} />
        <NumField label={t('settings.ebitdaMultiple')} value={form.ebitda_multiple} onChange={set('ebitda_multiple')} step="0.5" disabled={readOnly} />
        <NumField label={t('settings.equipmentValue')} value={form.equipment_value} onChange={set('equipment_value')} disabled={readOnly} />
        <NumField label={t('settings.equipmentMonths')} value={form.equipment_amort_months} onChange={set('equipment_amort_months')} disabled={readOnly} />
        <div className="flex items-center justify-between rounded-xl bg-card2 px-3 py-2.5">
          <span className="text-sm text-white/80">{t('settings.amortPreview')}</span>
          <span className="num font-semibold text-accent">{fmtMoney(amort)}</span>
        </div>
        {!readOnly ? (
          <Button onClick={save} disabled={upsert.isPending || !selected}>
            {flash ?? t('common.save')}
          </Button>
        ) : null}
      </Card>

      <FinancingCard clubId={selected} readOnly={readOnly} />
      <CapexCard clubId={selected} readOnly={readOnly} />
    </div>
  )
}

const inputCls =
  'num rounded-xl border border-line bg-card2 px-3 py-2 text-sm text-white outline-none focus:border-accent disabled:opacity-50'

function FinancingCard({ clubId, readOnly }) {
  const { t } = useTranslation()
  const { data: financing } = useFinancing()
  const add = useAddFinancing()
  const del = useDeleteFinancing()
  const [form, setForm] = useState({ label: '', principal: '', annual_rate: '', term_months: '', start_date: '' })

  const items = (financing ?? []).filter((f) => f.club_id === clubId)
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }))
  const valid = form.label && Number(form.principal) > 0 && Number(form.term_months) > 0 && form.start_date

  async function submit() {
    await add.mutateAsync({
      club_id: clubId,
      label: form.label,
      principal: Number(form.principal),
      annual_rate: Number(form.annual_rate) || 0,
      term_months: Number(form.term_months),
      start_date: form.start_date,
    })
    setForm({ label: '', principal: '', annual_rate: '', term_months: '', start_date: '' })
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="font-display text-xl uppercase text-accent">{t('settings.financing')}</h3>
        <p className="text-xs text-muted">{t('settings.financingHint')}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t('settings.none')}</p>
      ) : (
        items.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl bg-card2 px-3 py-2.5">
            <div>
              <p className="text-sm text-white">{f.label}</p>
              <p className="num text-xs text-muted">
                {fmtMoney(f.principal)} · {fmtNum(f.annual_rate)}% · {f.term_months} mois · {f.start_date}
              </p>
              <p className="num text-xs text-accent">
                {t('settings.monthlyPayment')}: {fmtMoney2(loanPayment(f))}
              </p>
            </div>
            {!readOnly ? (
              <Button variant="danger" onClick={() => del.mutate(f.id)} className="px-3 py-1.5 text-xs">
                {t('common.delete')}
              </Button>
            ) : null}
          </div>
        ))
      )}
      {!readOnly ? (
        <div className="grid grid-cols-2 gap-2">
          <input className={`${inputCls} col-span-2`} placeholder={t('settings.label')} value={form.label} onChange={set('label')} />
          <input className={inputCls} type="number" placeholder={t('settings.principal')} value={form.principal} onChange={set('principal')} />
          <input className={inputCls} type="number" step="0.1" placeholder={t('settings.annualRate')} value={form.annual_rate} onChange={set('annual_rate')} />
          <input className={inputCls} type="number" placeholder={t('settings.termMonths')} value={form.term_months} onChange={set('term_months')} />
          <input className={inputCls} type="date" value={form.start_date} onChange={set('start_date')} />
          <Button onClick={submit} disabled={!valid || add.isPending} className="col-span-2">
            {t('settings.add')}
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

function CapexCard({ clubId, readOnly }) {
  const { t } = useTranslation()
  const { data: capex } = useCapex()
  const add = useAddCapex()
  const del = useDeleteCapex()
  const [form, setForm] = useState({ label: '', amount: '', date: '', amort_months: '' })

  const items = (capex ?? []).filter((c) => c.club_id === clubId)
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }))
  const valid = form.label && Number(form.amount) > 0 && Number(form.amort_months) > 0 && form.date

  async function submit() {
    await add.mutateAsync({
      club_id: clubId,
      label: form.label,
      amount: Number(form.amount),
      date: form.date,
      amort_months: Number(form.amort_months),
    })
    setForm({ label: '', amount: '', date: '', amort_months: '' })
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="font-display text-xl uppercase text-accent">{t('settings.capex')}</h3>
        <p className="text-xs text-muted">{t('settings.capexHint')}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t('settings.none')}</p>
      ) : (
        items.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-card2 px-3 py-2.5">
            <div>
              <p className="text-sm text-white">{c.label}</p>
              <p className="num text-xs text-muted">
                {fmtMoney(c.amount)} · {c.date} · {c.amort_months} mois
              </p>
              <p className="num text-xs text-accent">
                {t('settings.monthlyAmort')}: {fmtMoney2(c.amount / c.amort_months)}
              </p>
            </div>
            {!readOnly ? (
              <Button variant="danger" onClick={() => del.mutate(c.id)} className="px-3 py-1.5 text-xs">
                {t('common.delete')}
              </Button>
            ) : null}
          </div>
        ))
      )}
      {!readOnly ? (
        <div className="grid grid-cols-2 gap-2">
          <input className={`${inputCls} col-span-2`} placeholder={t('settings.label')} value={form.label} onChange={set('label')} />
          <input className={inputCls} type="number" placeholder={t('settings.amount')} value={form.amount} onChange={set('amount')} />
          <input className={inputCls} type="number" placeholder={t('settings.amortMonths')} value={form.amort_months} onChange={set('amort_months')} />
          <input className={`${inputCls} col-span-2`} type="date" value={form.date} onChange={set('date')} />
          <Button onClick={submit} disabled={!valid || add.isPending} className="col-span-2">
            {t('settings.add')}
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
