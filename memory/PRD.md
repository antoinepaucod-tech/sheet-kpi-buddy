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

## Sales Funnel Percentages
- Calculees dynamiquement dans `compute_metrics()` a partir des raw counts:
  - call_percentage = calls_made / leads * 100
  - sched_percentage = scheduled / calls_made * 100
  - show_percentage = show / scheduled * 100
  - close_percentage = close / show * 100

## KPI Details Endpoint
- `GET /api/monthly-kpis/{month}/details` retourne:
  - kpi, revenue_breakdown, expense_breakdown
  - recurring_revenue/expense avec validated_this_month
  - recurring_validations

## Recurring Validation System
- Collection: `recurring_validations`
- Endpoints: GET/POST/DELETE /api/recurring-validations/{month|id}
- UI: Section "Validation Mensuelle" dans RecurringPage + boutons "Valider" dans Dashboard Details

## Transaction Deletion Logic
- Suppression manuelle: pas d'exclusion automatique
- Suppression correspondant a un template recurrent: cree une exclusion

## 6-Week Challenge
- Objectif par semaine: 3 seances minimum
- isComplete = checkins >= goal (pas de fallback booleen)
- Section bilans par participant avec statut

## Chart Fixes
- profitMargin clampe entre -200% et +200% dans le chart
- Members Evolution: ComposedChart avec Bar (Nouveaux, Perdus) + Line (Membres Actifs)
- formatPct arrondi pour valeurs extremes (>999)

## CSS / UI
- tf-stat-value: font-size clamp(14px, 1.2vw, 22px), overflow hidden, text-overflow ellipsis
- KPIDetailedView StatBox: text-sm avec truncate

## Completed Features (All Sessions)
- ResizeObserver 3-layer fix
- Dynamic subscription types, Settings CRUD
- Auto-generate bilans, Course KPIs to salary
- Bulk course creation, Auto-sync salaires
- Late payments badges, Challenge objective fix
- GHL sale creates transaction, Coach replacement S1-S5
- Restore excluded transaction, Dynamic recalculation
- Auto-recalculate KPIs on tx create/delete/restore
- Active members from subscription dates
- Dashboard Details: revenue/expense/recurring breakdown [2026-03-16]
- Auto-recalculate KPIs after recurring generation [2026-03-16]
- Suppression Fast Cash Revenue du dashboard [2026-03-16]
- Renommage Reviews -> Bilans / Suivis [2026-03-16]
- Fix filtres page Bilans [2026-03-16]
- Bilans par participant dans Challenge [2026-03-16]
- Simplification suppression transactions [2026-03-16]
- Validation mensuelle des recurrences [2026-03-16]
- **Fix Sales Funnel percentages (compute_metrics)** [2026-03-16]
- **Fix text overflow dans stat boxes (CSS clamp + truncate)** [2026-03-16]
- **Profit margin chart clampe a +-200%** [2026-03-16]
- **Members Evolution chart avec bars + line + legend** [2026-03-16]

## Credentials
- Login: test@crossfit.ch / test123

## Backlog
- **P1**: Explication complete du workflow de l'application
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees
- **P2**: Calcul automatique de CPL, CPR, LTV
