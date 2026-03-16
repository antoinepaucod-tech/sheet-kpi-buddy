# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)

## Subscription Types (31)
- **14 Membres Generaux Recurrents**: HUBFIT, HYBRID FULL (mensuel, duo, student, sans engagement), IFRC, OPEN GYM, THE COACH PASS (mensuel, annuel), UNLIMITED ACCESS (mensuel, duo, sans engagement), VIRTUAL COACH
- **17 Membres PIF**: 6 WEEKS CHALLENGE, HUBFIT(PIF), HYBRID FULL (annuel, duo annuel), IFRC(PIF), OFFRE 6 MOIS, OPEN GYM (annuel), PACK 10/20, PRET, THE COACH ENTREE, THE COACH PASS (annuel PIF, 6 mois), UNLIMITED ACCESS (annuel, duo annuel), VIRTUAL COACH(PIF)
- Chaque type a: member_type, is_coach_subscription, is_duo, is_pif, nb_membres

## Categories Comptables (13)
### Revenue (4)
- ABONNEMENTS (revenue_members) - revenue_type: Membre
- COACHING (revenue_coaching) - revenue_type: Service
- RETAIL (retail_revenue) - revenue_type: Produit
- COACHING VIRTUEL (coaching_virtuel_revenue) - revenue_type: Service

### Expense (9)
- LOYER, SALAIRES, SALAIRES COACHS, UTILITIES, MARKETING, PUBLICITE, ASSURANCE, AUTRE, DIVERS

## Business Rules
- **PIF**: montant total au 1er mois, 0 CHF les mois suivants
- **Duo**: 2 membres lies par subscription_group_id, seul le primaire genere des revenus
- **Membres actifs**: base sur subscription_end_date dans le futur OU pas d'exit_date
- **Revenue types**: Membre, Produit, Service
- **Recurrences**: auto-generees chaque mois, controlees par subscription_end_date et recurrence_end_date
- **Funnel %**: Calcules dynamiquement dans compute_metrics()
- **cash_collected**: = total revenue from transactions
- **avg_per_sale**: = cash_collected / close

## KPI Model Fields
### Revenue
- revenue_members, revenue_coaching, coaching_virtuel_revenue, retail_revenue, fast_cash_revenue

### Expenses
- loyer, salaires, salaires_coach, salaires_coachs, utilities, other_expenses, other_expenses_misc, insurance, marketing_spend, ad_spend

## Recurring Validation
- Collection: recurring_validations
- Validation mensuelle de chaque recurrence (paiement/reception confirme)

## Audit de Coherence (2026-03-16)
### Verifie et corrige:
- SettingsTypesPage: formulaire inclut member_type, is_coach, is_duo, is_pif, nb_membres
- MembersPage: membership default="" (plus "Annuel"), auto-fill member_type depuis le type choisi
- CategoriesPage: revenue_type affiche + editable, DEFAULT_KPI_COLUMNS a jour
- GHLFunnelSection: SUBSCRIPTION_TYPES dynamiques avec member_type, isPIF, isCoach, isDuo
- KPI model: nouvelles colonnes (coaching_virtuel_revenue, other_expenses_misc, salaires_coachs)
- Dashboard Details: revenue/expense breakdown, recurring validations
- Transactions: categories dynamiques, pas d'exclusion auto pour manuelles

## Credentials
- Login: test@crossfit.ch / test123

## Backlog
- **P0**: Import historique des transactions depuis 2024 (en attente du fichier)
- **P1**: Explication complete du workflow
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees
- **P2**: Calcul CPL, CPR, LTV
