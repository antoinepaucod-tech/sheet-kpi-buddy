# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Data Model

### Subscription Types (26 active)
**Membres PIF (13):** 6 WEEKS CHALLENGE, HYBRID FULL - PAIEMENT ANNUEL X1, HYBRID FULL DUO - PAIEMENT ANNUEL X1, OFFRE 6 MOIS - 499 CHF, OPEN GYM - PAIEMENT ANNUEL X1, PACK 10 SESSIONS, PACK 20 SESSIONS, PRÊT, THE COACH ENTRÉE, THE COACH PASS - PAIEMENT ANNUEL X1, THE COACH PASS 6 MOIS - PAIEMENT X1, UNLIMITED ACCESS - PAIEMENT X1 - ANNUEL, UNLIMITED ACCESS DUO - PAIEMENT ANNUEL X1

**Membres Généraux Récurrents (13):** HUBFIT, HYBRID FULL - PAIEMENT MENSUEL, HYBRID FULL DUO - PAIEMENT MENSUEL, HYBRID FULL DUO SANS ENGAGEMENT - PAIEMENT MENSUEL, HYBRID FULL SANS ENGAGEMENT - PAIEMENT MENSUEL, HYBRID FULL STUDENT - PAIEMENT MENSUEL, IFRC, OPEN GYM - PAIEMENT MENSUEL, THE COACH PASS MENSUEL, UNLIMITED ACCESS - PAIEMENT MENSUEL, UNLIMITED ACCESS DUO - PAIEMENT MENSUEL, UNLIMITED ACCESS SANS EMGAGEMENT - PAIEMENT MENSUEL, VIRTUAL COACH

### Accounting Categories (38)
- **Revenue (25):** Per membership type + COMPLEMENTS ALIMENTAIRES, PT ANTOINE, PRÊT
- **Expense (13):** LOGICIELS, ABONNEMENTS, LOYERS, SALAIRES COACH, TELEPHONIE, REMBOURSEMENT PRÊT, RETRAIT BANCOMAT, ALIMENTAIRE, PUBLICITÉ, SALAIRES, COURSES, FRAIS PROFESSIONNELS, REMBOURSEMENT UNIFORME COACHS
- Each category has: kpi_column mapping, is_recurring, recurrence_day, default_amount

### Members (326 imported)
- 228 Membres Généraux Récurrents
- 98 Membres PIF
- Fields: name, membership, member_type, cash_collected, contract_signed_date, subscription_end_date, exit_date, sold_by, persons_count, subscription_group_id, is_primary_subscriber, onboarding fields

### Transactions (3425 imported)
- Fields: date, category, amount, type, client_name, amount_received, payment_method, invoice_number, notes, product_description, is_validated, is_auto_generated

### Monthly KPIs (32 months, Jan 2024 - Apr 2027)
- Revenue: general_eft_revenue, pt_revenue, retail_revenue, fast_cash_revenue
- Expenses: rent, salaries, salaires_coach, ad_spend, computer_software, subscriptions, internet_telephone, credit_repayment, food_expenses, utilities, insurance
- Members: pif_members, recurring_general_members, pt_members, total_active_members
- Funnel: leads, calls_made, scheduled, show, close, cash_collected

## KPI Column Mapping
- Revenue type=membre → general_eft_revenue
- Revenue type=produit → retail_revenue  
- Revenue type=service → pt_revenue
- LOYERS → rent, SALAIRES → salaries, SALAIRES COACH → salaires_coach
- LOGICIELS → computer_software, ABONNEMENTS → subscriptions
- TELEPHONIE → internet_telephone, PUBLICITÉ → ad_spend
- ALIMENTAIRE → food_expenses, REMBOURSEMENT PRÊT → credit_repayment
- COURSES → utilities, FRAIS PROFESSIONNELS → other_expenses_misc

## Workflows de Création de Membres
### Workflow 1 - GHL Confirm Sale (POST /api/ghl/confirm-sale)
1. Crée le membre avec subscription_type et member_type
2. Calcule subscription_end_date (Challenge: +42j, Annuel: +365j)
3. Crée un échéancier de paiement + bilan/suivi
4. Auto-ajoute au Challenge actif si applicable
5. Crée une transaction comptable + Recalcule les KPIs

### Workflow 2 - Ajout Manuel (POST /api/members)
1. Auto-détecte challenge, active bilan type "challenge" + date = signature + 42j
2. Crée membre, échéancier, bilan, transaction + Recalcule KPIs

## Pages Principales
- Dashboard (/) - KPIs, graphiques, funnel
- Membres (/members) - Liste, ajout, modification
- Transactions (/transactions) - Liste par mois
- Budget Mensuel (/budget) - Grille éditable catégories × mois
- Catégories (/categories) - Gestion des catégories comptables
- Récurrentes (/recurring) - Gestion des transactions récurrentes
- Challenge 6 Sem. (/challenge) - Programme challenge
- Bilans/Suivis (/annual-reviews) - Bilans par membre
- KPIs Cours (/courses) - Fréquentation des cours

## Completed Work
- [2026-03-16] Fix typo CHALENGE → CHALLENGE (DB, frontend, fallbacks)
- [2026-03-16] Fix auto-detection type "challenge" pour bilans workflow manuel
- [2026-03-16] Fix UnboundLocalError base_date dans ghl.py (confirm-sale)
- [2026-03-16] Import complet des données: 326 membres, 3425 transactions, 38 catégories, 32 KPIs mensuels, 76 KPIs cours, 7 instructeurs, 26 types d'abonnements
- [2026-03-16] Fix classification PIF/Récurrent pour les 26 types d'abonnements
- [2026-03-16] Nouvelle page Budget Mensuel avec grille éditable (catégories × mois × montants)
- [2026-03-16] Mise à jour _auto_recalculate_kpis pour 38 catégories avec aliases FR/EN
- [2026-03-16] Fix Dashboard default month (dernier mois avec données au lieu d'avril 2027)

## Backlog
- **P1**: Configurer les types de bilans en fonction du type d'abonnement
- **P1**: Système de rappels automatiques pour bilans/suivis
- **P2**: Explication complète des workflows à l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de données
- **P2**: Calcul CPL, CPR, LTV
