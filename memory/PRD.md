# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)

## Notification Badges (Sidebar)
- **Onboarding** : badge bleu = pending
- **Paiements** : badge rouge = late payments
- **Bilans / Suivis** : badge bleu = upcoming (14j) + badge rouge = overdue

## Revenue/Expense Calculation Logic
- `recalculate_month` sums dynamically from categories (kpi_column mapping)
- Revenue = sum of all revenue kpi_columns from transactions. Fallback: fast_cash_revenue
- Expenses = sum of all expense kpi_columns (includes salaires_coachs)
- GHL confirm-sale creates accounting transaction (type=revenue, category from DB) + updates revenue_members

## Key Flows
- **GHL Sale → Transaction**: confirm-sale creates member + accounting tx + updates KPI
- **Exclude/Restore**: Delete tx → moves to excluded. Restore → moves back to transactions
- **Salary Auto-gen**: Attendance change → auto-trigger generate-salary-expenses
- **Bilans Auto-gen**: Button on Bilans/Suivis page → creates monthly check-ins

## Completed Features (Latest)
- ResizeObserver 3-layer fix [2026-03-14]
- Dynamic subscription types from DB [2026-03-14]
- Settings Types page CRUD [2026-03-14]
- Auto-generate bilans mensuels [2026-03-14]
- Course KPIs to salary expenses [2026-03-14]
- Bulk course creation "Planifier la semaine" [2026-03-15]
- Auto-sync salaires on attendance change [2026-03-15]
- Late payments red badge [2026-03-15]
- Challenge objective fix (real check-ins only) [2026-03-15]
- GHL sale creates accounting transaction [2026-03-15]
- Coach replacement per week S1-S5 [2026-03-15]
- Bilans/Suivis dual badges (blue + red) [2026-03-15]
- **Restore excluded transaction** (now puts tx back in main list) [2026-03-15]
- **Dynamic revenue/expense recalculation** from categories [2026-03-15]
- **Label "Cotisations" → "Abonnements"** [2026-03-15]
- **useCoachMembership uses categories** for revenue classification [2026-03-15]
- **GHL confirm-sale updates revenue_members** in KPI [2026-03-15]

## Test Reports
- iteration_39: 100% (dashboard, transactions, GHL, restore, badges)
- iteration_38: 100% (badges bilans, GHL transaction fix)
- iteration_37: 100% (badge late, challenge fix, coach replacement)
- iteration_36: 100% (bulk, auto-sync salary)

## Credentials
- Login: test@crossfit.ch / test123

## Backlog
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees
- **P2**: Calcul automatique de CPL, CPR, LTV
