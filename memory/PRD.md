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
- `annual_reviews`: 95 bilans mensuels auto-generes pour membres actifs eligibles

## Regles Bilans / Suivis
- **Frequence:** Mensuelle pour tous les membres
- **Exclusions:**
  - Membres HUBFIT (jamais de bilan)
  - Toute personne ayant un abonnement coach (THE COACH / VIRTUAL COACH), meme si elle a aussi un abonnement membre
  - Membres partis (exit_date dans le passe)
- **Auto-generation:** Calcul date depuis contract_signed_date + 1 mois, ou dernier bilan complete + 1 mois
- **Apres completion:** Prochain bilan auto-planifie 1 mois plus tard
- **Resume auto:** Presences (12 dernieres semaines) + statut paiements affiches dans le modal de completion
- **Email rappel:** Inclut bouton CTA "Prendre rendez-vous" (mailto)
- **Alertes dashboard:** Widget avec total planifies, en retard, cette semaine, 30 prochains jours

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
  - Auto-generation pour membres actifs (exclut coachs, HUBFIT, partis)
  - Frequence mensuelle pour tous
  - Formulaire de completion avec resume auto presences + paiements
  - Widget alertes bilans sur le Dashboard principal
  - Email de rappel avec CTA "Prendre rendez-vous" (mailto)
  - Historique des bilans avec graphiques d'evolution

## Backlog
- **P1**: Explication complete des workflows
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface migration donnees CSV
- **P2**: Calcul CPL, CPR, LTV
- **P3**: Refactoring de recalculate_month (decomposer en sous-fonctions)
- **P3**: Deplacer logique DUO cote backend
- **P3**: Verification/nettoyage donnees sources CSV
