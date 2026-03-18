# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Donnees Validees Mars 2026
- Revenue: 5062 CHF | Expenses: 2170 CHF | Net: 2892 CHF
- Recurring: 6202 CHF/mois (47 membres billing_enabled, hors coachs)
- Funnel GHL: 84 leads -> 0 appts -> 2 show -> 1 converted (Caroline) -> 300 CHF
- Membres actifs: 97 | Coachs: 30 | Nouveaux: 10 | Partis: 188
- Paiements: 94 total (47 mars + 47 avril), 0 inconnu
- Bilans: 95 planifies (toggle activation requis pour auto-generation)

## Regles Metier
- **Revenue/Expenses**: Basees sur le type de chaque TRANSACTION (pas le type de categorie)
- **Recurring**: Membres billing_enabled=True, billing_amount>0, non-coach, non-partis
- **Funnel**: Calcule depuis GHL sales + KPI existants
- **Paiements**: Generes depuis billing_enabled members (pas payment_schedules)
- **Bilans**: Activation manuelle par membre, frequence configurable, email au staff
- **Coachs exclus**: Seances, KPIs Clients, Recurring revenue, Paiements
- **HUBFIT exclus**: Bilans

## Completed Work (2026-03-18)
- Import CSV + Dashboard temps reel + DUO + Renouvellement
- KPIs recalcules avec types transactions (fix Caroline revenue)
- Funnel GHL populate dans KPI (leads/converted/cash)
- Recurring revenue coherent (47 membres, 6202 CHF) partout
- Paiements synchronises (0 inconnu, noms corrects)
- Bilans/Suivis avec activation manuelle + date 1er bilan
- Onboarding fix (optimistic update)
- Dialog membre ameliore (billing + review scrollable)
- Email bilan envoye au staff avec CTA fiche client
- Assessment global: toutes les donnees coherentes

## Backlog
- **P1**: Notifications avancees + donnees GHL via API
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface migration donnees CSV
- **P2**: Calcul CPL, CPR, LTV
- **P3**: Refactoring recalculate_month
- **P3**: Nettoyage donnees sources CSV
