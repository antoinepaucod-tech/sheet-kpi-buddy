# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Data
- `customer_members`: 326 membres (139 courants, 187 partis, 1 doublon)
- `accounting_transactions`: 3425 transactions
- `accounting_categories`: 38 categories
- `monthly_kpis`: 32 mois (recalcules depuis transactions)
- `course_kpis`: 76 cours
- `instructors`: 7, `coaches`: 7

## Member Classification Logic
- **Partis**: exit_date < today (187 membres)
- **Courants**: pas de exit_date OU exit_date >= today, pas de doublon (139 membres)
- **Coaches**: 31 actifs
- **DUO**: 2 enregistrements distincts (PRIMARY + PARTNER), comptent pour 2 personnes
- Resultat: 97 membres actifs, 31 coachs actifs, 5 expires, 187 partis

## Completed Work
- Import complet des 6 CSV + 7 coachs synchronises
- Dashboard stats temps reel + zone alertes expirations
- Edition exit_date dans formulaire membre
- Filtre par abonnement sur MembersPage
- Nettoyage complet (comptes test, endpoints seed)
- Deduplication membres (double abo HUBFIT+COACH)
- Regroupement visuel des membres DUO
- Fix: Membres avec exit_date futur classes comme actifs
- Fix: Partenaires DUO non marques comme doublons
- Avertissement DUO: modal lors de l'edition/suppression
- Churn en temps reel depuis les exit_dates
- Systeme de rappels automatiques pour bilans
- **KPIs auto-recalcules depuis les transactions reelles** (4762 CHF au lieu de 300 CHF pour mars 2026)
- **Cycle de renouvellement editable** (Mensuel/Trimestriel/Semestriel/Annuel/Personnalise) avec recalcul auto de la date d'expiration
- **Transactions cliquables** dans les details des revenus (lien vers le membre correspondant)

## Backlog
- **P1**: Explication complete des workflows a l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees (import CSV)
- **P2**: Calcul CPL, CPR, LTV

## Key API Endpoints
- `GET /api/members/stats`: Stats en temps reel deduplicees
- `GET /api/monthly-kpis`: KPIs enrichis avec churn reel
- `POST /api/monthly-kpis/{month}/recalculate`: Recalcul KPIs depuis transactions
- `POST /api/annual-reviews/auto-generate`: Generation automatique des bilans
- `GET /api/monthly-kpis/{month}/details`: Details avec client_name pour lien vers membres
