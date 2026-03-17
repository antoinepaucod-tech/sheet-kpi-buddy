# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Data
- `customer_members`: 326 membres (139 courants, 187 partis, 1 doublon)
- `accounting_transactions`: 3425 transactions
- `monthly_kpis`: 32 mois (recalcules depuis transactions reelles)
- `payment_schedules`: 75 (73 actifs pour mars 2026)

## Member Classification Logic
- **Partis**: exit_date < today (187)
- **Courants**: pas de exit_date OU exit_date >= today, pas de doublon (139)
- **DUO**: 2 enregistrements = 2 personnes, groupes visuellement
- Resultat: 97 actifs, 31 coachs actifs, 5 expires, 187 partis

## Dashboard Logic
- **Mon Club**: KPIs top-level (Revenus, Benefice, Membres, Coachs, Churn) - ROAS retire (pas de Meta Ads)
- **Entonnoir de Vente**: Calcule depuis nouvelles inscriptions du mois (close = new sign-ups, cash = first transactions)
- **Detail des Membres**: Stats temps reel via /api/members/stats (pas KPIs statiques)
- **Transactions Recurrentes**: 73 abonnements actifs depuis payment_schedules + customer_members billing, 16024 CHF/mois
- **Auto-recalcul**: Le mois selectionne est recalcule automatiquement au chargement du Dashboard

## Completed Work
- Import complet des 6 CSV + 7 coachs
- Dashboard stats temps reel + alertes expirations
- Deduplication membres (HUBFIT+COACH, DUO non-doublons)
- Regroupement visuel DUO + avertissement edition
- Fix: exit_date futur = actif, Churn temps reel
- Systeme rappels automatiques bilans
- KPIs auto-recalcules depuis transactions
- Transactions cliquables vers membres
- Cycle de renouvellement editable + Section Facturation modifiable
- Dashboard: ROAS supprime, Cash Collecte corrige, Members synchronise
- **Entonnoir de Vente peuple**: 10 conversions mars, 4762 CHF cash
- **Transactions Recurrentes peuplees**: 73 abonnements, 16024 CHF/mois, noms des membres affiches

## Backlog
- **P1**: Explication complete des workflows
- **P2**: Integration Meta Ads API pour ROAS reel
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface migration donnees CSV
- **P2**: Calcul CPL, CPR, LTV
