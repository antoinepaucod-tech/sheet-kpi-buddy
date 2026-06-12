import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClubs, useSettings, useUpsertSettings, useMyRole } from '../hooks/useData'
import { DEFAULT_SETTINGS, equipmentAmortMonthly } from '../lib/calc'
import { fmtMoney } from '../lib/format'
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
    </div>
  )
}
