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
- `annual_reviews`: 108+ bilans auto-generes pour membres actifs

## Dashboard Logic
- **Entonnoir de Vente**: Donnees GHL reelles (leads=84, close=1 Caroline, cash=599 CHF pour mars 2026)
- **Transactions Recurrentes**: 73 abonnements actifs depuis payment_schedules, 16024 CHF/mois
- **Detail des Membres**: Stats temps reel via /api/members/stats (97 actifs, 32 coachs)
- **Alertes Bilans**: Widget dashboard avec total planifies, en retard, cette semaine, 30 prochains jours
- **Auto-recalcul**: finances recalculees au chargement, GHL sync separee

## Completed Work
- Import 6 CSV + coachs + deduplication + DUO
- Dashboard temps reel + alertes + churn
- Regroupement DUO + avertissement edition
- Cycle renouvellement editable + Facturation modifiable
- KPIs auto-recalcules depuis transactions
- Transactions cliquables vers membres
- Entonnoir GHL synchro: 84 leads, 1 close (Caroline), 599 CHF cash
- Transactions recurrentes peuplees: 73 abonnements, 16024 CHF/mois
- **Systeme complet Bilans/Suivis (2026-03-18):**
  - Auto-generation pour tous les membres actifs (exclut coachs et partis)
  - Formulaire de completion avec resume auto presences + paiements
  - Widget alertes bilans sur le Dashboard principal
  - Email de rappel avec CTA "Prendre rendez-vous" (mailto)
  - Historique des bilans avec graphiques d'evolution
  - Endpoint member-summary pour recapitulatif presences/paiements

## Backlog
- **P1**: Explication complete des workflows
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface migration donnees CSV
- **P2**: Calcul CPL, CPR, LTV
- **P3**: Refactoring de recalculate_month (decomposer en sous-fonctions)
- **P3**: Deplacer logique DUO cote backend
- **P3**: Verification/nettoyage donnees sources CSV
