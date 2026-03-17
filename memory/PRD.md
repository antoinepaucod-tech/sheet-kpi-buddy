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

## Member Classification Logic
- **Partis**: exit_date < today (187)
- **Courants**: pas de exit_date OU exit_date >= today, pas de doublon (139)
- **DUO**: 2 enregistrements = 2 personnes, groupes visuellement
- Resultat: 97 actifs, 31 coachs actifs, 5 expires, 187 partis

## Completed Work
- Import complet des 6 CSV + 7 coachs
- Dashboard stats temps reel + alertes expirations
- Edition exit_date + filtres par abonnement
- Deduplication membres (HUBFIT+COACH)
- Regroupement visuel DUO + avertissement edition
- Fix: exit_date futur = actif (pas parti)
- Fix: Partenaires DUO non doublons
- Churn en temps reel depuis exit_dates
- Systeme rappels automatiques bilans
- KPIs auto-recalcules depuis transactions (4762 CHF vs 300 CHF)
- Transactions cliquables vers membres dans Details Dashboard
- Cycle de renouvellement editable (Mensuel/Trimestriel/Semestriel/Annuel) avec recalcul date expiration
- Section Facturation recurrente modifiable (removed disabled, scroll modal)

## Backlog
- **P1**: Explication complete des workflows a l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface migration donnees CSV
- **P2**: Calcul CPL, CPR, LTV

## Key API Endpoints
- `GET /api/members/stats`: Stats deduplicees temps reel
- `GET /api/monthly-kpis`: KPIs enrichis churn reel
- `POST /api/monthly-kpis/{month}/recalculate`: Recalcul depuis transactions
- `POST /api/annual-reviews/auto-generate`: Generation auto bilans
- `GET /api/monthly-kpis/{month}/details`: Details avec client_name
