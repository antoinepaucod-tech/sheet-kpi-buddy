// End-to-end validation: auth, RLS, calculations on demo data, scenario save/load.
import { createClient } from '@supabase/supabase-js'
import { computeEntryFull, consolidate } from '../src/lib/calc.js'

const URL = process.env.VITE_SUPABASE_URL || 'https://tnmpphysbtoezzjfqxcd.supabase.co'
const KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubXBwaHlzYnRvZXp6amZxeGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MDQ3NTAsImV4cCI6MjA4ODE4MDc1MH0.RwjC0nru_s46aX_uB9IgxAmY2EzdNRXt8vE2_XSMZmc'

let failures = 0
const check = (label, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}
const close = (a, b, eps = 0.01) => Math.abs(a - b) < eps

// 1. Anon must see nothing
const anon = createClient(URL, KEY)
{
  const { data } = await anon.from('profit_monthly_entries').select('*')
  check('Anon ne voit aucune entrée (RLS)', (data ?? []).length === 0)
  const { data: clubs, error } = await anon.rpc('profit_clubs')
  check('Anon ne voit aucun club via profit_clubs', !!error || (clubs ?? []).length === 0)
}

// 2. Owner login + data access
const owner = createClient(URL, KEY)
{
  const { error } = await owner.auth.signInWithPassword({
    email: 'antoine.owner@test.local',
    password: 'Test1234!',
  })
  check('Login antoine.owner@test.local', !error, error?.message)

  const { data: clubs } = await owner.rpc('profit_clubs')
  check('Owner voit exactement 4 clubs', clubs?.length === 4, clubs?.map((c) => c.name).join(', '))

  const { data: settings } = await owner.from('profit_club_settings').select('*')
  check('Owner voit 4 réglages clubs', settings?.length === 4)

  const { data: entries } = await owner
    .from('profit_monthly_entries')
    .select('*')
    .order('month', { ascending: true })
  check('Owner voit 2 entrées démo (Versoix)', entries?.length === 2)

  // 3. Manual verification of computed KPIs (April 2026, Versoix)
  const { data: capexList } = await owner.from('profit_capex').select('*')
  const { data: financingList } = await owner.from('profit_financing').select('*')
  check('Owner voit les CAPEX (2 lignes Versoix)', capexList?.length >= 2)
  check('Owner voit le financement (1 prêt Versoix)', financingList?.length >= 1)
  const versoixSettings = settings.find((s) => s.club_id === '36e06074-f9e6-404c-a81b-ec4350ad76f0')
  const april = entries.find((e) => e.month === '2026-04-01')
  const c = computeEntryFull(april, versoixSettings, capexList ?? [], financingList ?? [])

  // Fiscal layer: ARPU 179 TTC, VAT 8.1%, employer charges 17%, profit tax 14%
  const arpuHT = 179 / 1.081
  check('CPL avril = 3500/120 = 29.17', close(c.cpl, 3500 / 120), c.cpl.toFixed(2))
  check('CAC avril = 5500/24 = 229.17', close(c.cac, 5500 / 24), c.cac.toFixed(2))
  check('LTV = ARPU HT × 30 = 4967.62', close(c.ltv, arpuHT * 30), c.ltv.toFixed(2))
  check('Payback = CAC/ARPU HT = 1.38 mois', close(c.paybackMonths, 5500 / 24 / arpuHT), c.paybackMonths.toFixed(2))
  check('Amortissements CAPEX = 250000/120 + 180000/60 = 5083.33', close(c.equipmentAmort, 5083.33, 0.01))
  check('Charges sociales = 18000×17% = 3060', close(c.socialCharges, 3060))
  check('OPEX hors amort = 30610', close(c.opexTotal, 30610), String(c.opexTotal))
  check('Revenus HT = 43240/1.081 = 40000', close(c.revenueTotal, 40000), c.revenueTotal.toFixed(2))
  check('EBITDA = 3890', close(c.ebitda, 3890), c.ebitda.toFixed(2))
  check('EBIT = −1193.33', close(c.ebit, -1193.33, 0.01), c.ebit.toFixed(2))
  check('Intérêts dette ≈ 1090.61 (dans le P&L)', close(c.interest, 1090.61, 0.5), c.interest.toFixed(2))
  check('Impôt = 0 (résultat avant impôt négatif)', c.tax === 0)
  check('Résultat net ≈ −2283.95', close(c.netProfit, -2283.95, 0.5), c.netProfit.toFixed(2))
  check('Cash flow ≈ −280 ≠ résultat net (capital hors P&L)', close(c.cashFlow, -280.05, 1) && Math.abs(c.cashFlow - c.netProfit) > 1000, c.cashFlow.toFixed(2))
  check('Break-even = 224 membres', c.breakEvenMembers === 224, String(c.breakEvenMembers))
  check('Churn avril = 3.33% / durée déduite 30 mois', close(c.churnRate, 7 / 210) && close(c.impliedDuration, 30))

  // 4. Consolidated view = exact sum of clubs (April: only Versoix has data)
  const aprilEntries = entries.filter((e) => e.month === '2026-04-01')
  const computedList = aprilEntries.map((e) =>
    computeEntryFull(e, settings.find((s) => s.club_id === e.club_id), capexList ?? [], financingList ?? [])
  )
  const group = consolidate(computedList, aprilEntries)
  const sumNet = computedList.reduce((a, x) => a + x.netProfit, 0)
  const sumRev = computedList.reduce((a, x) => a + x.revenueTotal, 0)
  check('Consolidé: revenus = somme des clubs', close(group.revenueTotal, sumRev))
  check('Consolidé: résultat net = somme des clubs', close(group.netProfit, sumNet))

  // 5. Scenario save then reload
  const scenarioData = { active_members: 250, arpu: 165, ad_spend: 5000, base_month: '2026-06' }
  const { data: saved, error: saveErr } = await owner
    .from('profit_scenarios')
    .insert({ name: 'Validation auto', club_id: april.club_id, data: scenarioData })
    .select()
    .single()
  check('Scénario sauvegardé', !saveErr, saveErr?.message)
  const { data: reloaded } = await owner.from('profit_scenarios').select('*').eq('id', saved.id).single()
  check(
    'Scénario rechargé identique',
    reloaded && JSON.stringify(reloaded.data) === JSON.stringify(scenarioData)
  )
  await owner.from('profit_scenarios').delete().eq('id', saved.id)
}

// 6. Viewer is read-only
const viewer = createClient(URL, KEY)
{
  const { error } = await viewer.auth.signInWithPassword({
    email: 'coach2.viewer@test.local',
    password: 'Test1234!',
  })
  check('Login coach2.viewer@test.local', !error, error?.message)
  const { data: entries } = await viewer.from('profit_monthly_entries').select('*')
  check('Viewer voit les entrées', entries?.length === 2)
  const { data: inserted } = await viewer
    .from('profit_monthly_entries')
    .insert({ club_id: '36e06074-f9e6-404c-a81b-ec4350ad76f0', month: '2026-01-01' })
    .select()
  check('Viewer ne peut PAS écrire (RLS)', !inserted || inserted.length === 0)
}

console.log(failures === 0 ? '\n🎉 Toutes les validations passent' : `\n💥 ${failures} échec(s)`)
process.exit(failures === 0 ? 0 : 1)
