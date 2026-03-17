# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Data
- `customer_members`: 326 membres (139 courants, 187 partis)
- `accounting_transactions`: 3425 transactions
- `monthly_kpis`: 32 mois (recalcules depuis transactions + GHL)
- `payment_schedules`: 75 (73 actifs)

## Dashboard Logic
- **Entonnoir de Vente**: Donnees GHL reelles (leads=84, close=1 Caroline, cash=599 CHF pour mars 2026). Recalculate ne touche PAS aux donnees GHL.
- **Transactions Recurrentes**: 73 abonnements actifs depuis payment_schedules, 16024 CHF/mois
- **Detail des Membres**: Stats temps reel via /api/members/stats (97 actifs, 32 coachs)
- **ROAS retire** (pas de Meta Ads)
- **Auto-recalcul**: finances recalculees au chargement, GHL sync separee

## Completed Work
- Import 6 CSV + coachs + deduplication + DUO
- Dashboard temps reel + alertes + churn
- Regroupement DUO + avertissement edition
- Cycle renouvellement editable + Facturation modifiable
- KPIs auto-recalcules depuis transactions
- Transactions cliquables vers membres
- Systeme rappels automatiques bilans
- **Entonnoir GHL synchro**: 84 leads, 1 close (Caroline), 599 CHF cash
- **Transactions recurrentes peuplees**: 73 abonnements, 16024 CHF/mois

## Backlog
- **P1**: Explication complete des workflows
- **P2**: Integration Meta Ads API pour ROAS
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface migration donnees CSV
- **P2**: Calcul CPL, CPR, LTV
