# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)

## Revenue/Expense Calculation Logic
- **Auto-recalculate**: KPIs recalculent automatiquement a chaque creation/suppression/restauration de transaction ET apres generation des recurrences
- Revenue = sum of revenue kpi_columns from transactions (fallback: fast_cash_revenue if no tx)
- Expenses = sum of expense kpi_columns (includes salaires_coachs)
- active_members = count of members with subscription_end_date >= today

## Notification Badges (Sidebar)
- **Onboarding** : badge bleu = pending
- **Paiements** : badge rouge = late payments
- **Bilans / Suivis** : badge bleu = upcoming (14j) + badge rouge = overdue

## KPI Details Endpoint
- `GET /api/monthly-kpis/{month}/details` retourne:
  - kpi: toutes les donnees KPI du mois
  - revenue_breakdown: repartition des revenus par categorie avec transactions
  - expense_breakdown: repartition des depenses par categorie avec transactions
  - recurring_revenue/expense: templates recurrents actifs avec flag generated_this_month

## Completed Features (Latest Session)
- ResizeObserver 3-layer fix [2026-03-14]
- Dynamic subscription types from DB [2026-03-14]
- Settings Types page CRUD [2026-03-14]
- Auto-generate bilans mensuels [2026-03-14]
- Course KPIs to salary expenses (instructor fix) [2026-03-14]
- Bulk course creation "Planifier la semaine" [2026-03-15]
- Auto-sync salaires on attendance change [2026-03-15]
- Late payments red badge + Bilans dual badges [2026-03-15]
- Challenge objective fix (real check-ins only) [2026-03-15]
- GHL sale creates accounting transaction [2026-03-15]
- Coach replacement per week S1-S5 [2026-03-15]
- Restore excluded transaction [2026-03-15]
- Dynamic revenue/expense recalculation [2026-03-15]
- Label "Cotisations" -> "Abonnements" [2026-03-15]
- Auto-recalculate KPIs on tx create/delete/restore [2026-03-15]
- Active members count from actual subscription dates [2026-03-15]
- Zero out KPI columns with no transactions [2026-03-15]
- **P0 Fix: Dashboard Details tab - full revenue/expense/recurring breakdown** [2026-03-16]
- **Auto-recalculate KPIs after recurring transaction generation** [2026-03-16]
- **New endpoint GET /api/monthly-kpis/{month}/details** [2026-03-16]

## Credentials
- Login: test@crossfit.ch / test123

## Backlog
- **P1**: Explication complete du workflow de l'application
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees
- **P2**: Calcul automatique de CPL, CPR, LTV
