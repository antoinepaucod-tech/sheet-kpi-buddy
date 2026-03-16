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
  - recurring_revenue/expense: templates recurrents actifs avec flags generated_this_month et validated_this_month
  - recurring_validations: liste des validations du mois

## Recurring Validation System
- Collection: `recurring_validations`
- Schema: { id, recurring_id, month, description, category, amount, type, validated, validated_at }
- Endpoints:
  - `GET /api/recurring-validations/{year_month}` - liste des validations du mois
  - `POST /api/recurring-validations` - valider une recurrence pour un mois (body: recurring_id, month)
  - `DELETE /api/recurring-validations/{id}` - annuler une validation
- UI: Section "Validation Mensuelle" dans la page Recurrentes + boutons "Valider" dans le Dashboard Details

## Transaction Deletion Logic
- Suppression manuelle: la transaction est supprimee sans creer d'exclusion
- Suppression d'une transaction correspondant a un template recurrent: cree une exclusion pour eviter la re-generation
- Les KPIs sont recalcules automatiquement apres suppression

## 6-Week Challenge
- Objectif par semaine: 3 seances minimum (configurable via checkins_goal)
- isComplete = checkins >= goal (pas de fallback sur l'ancien champ booleen)
- Section bilans par participant: affiche le statut de chaque participant (Bilan rempli, En attente, Pas de bilan)

## Completed Features
- ResizeObserver 3-layer fix
- Dynamic subscription types from DB
- Settings Types page CRUD
- Auto-generate bilans mensuels
- Course KPIs to salary expenses
- Bulk course creation
- Auto-sync salaires on attendance change
- Late payments red badge + Bilans dual badges
- Challenge objective fix (3 sessions minimum)
- GHL sale creates accounting transaction
- Coach replacement per week S1-S5
- Restore excluded transaction
- Dynamic revenue/expense recalculation
- Auto-recalculate KPIs on tx create/delete/restore
- Active members count from actual subscription dates
- Zero out KPI columns with no transactions
- **P0 Fix: Dashboard Details tab - full revenue/expense/recurring breakdown** [2026-03-16]
- **Auto-recalculate KPIs after recurring generation** [2026-03-16]
- **Suppression Fast Cash Revenue du dashboard** [2026-03-16]
- **Objectif 6-Week Challenge = 3 seances min** [2026-03-16]
- **Renommage Reviews -> Bilans / Suivis** [2026-03-16]
- **Fix filtres page Bilans (reset statut sur clic periode)** [2026-03-16]
- **Bilans par participant dans la page Challenge** [2026-03-16]
- **Simplification suppression transactions (pas d'exclusion auto pour manuelles)** [2026-03-16]
- **Validation mensuelle des recurrences (confirmer paiement/reception)** [2026-03-16]

## Credentials
- Login: test@crossfit.ch / test123

## Backlog
- **P1**: Explication complete du workflow de l'application
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees
- **P2**: Calcul automatique de CPL, CPR, LTV
