# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Regles Metier Principales

### Paiements
- Source: membres avec `billing_enabled=True` ET `billing_amount > 0`
- Exclut: coachs, membres partis
- Synchronises avec noms membres (plus jamais "Inconnu")
- Generation mensuelle: `/api/payments/generate/{year}/{month}`
- 75 plannings actifs, 47 paiements generes pour mars 2026

### Revenus Recurrents
- Source: membres avec `billing_enabled=True` (47 membres, ~6202 CHF/mois)
- Exclut: coachs, membres partis

### Bilans / Suivis
- Activation manuelle par membre (toggle + date du 1er bilan)
- Frequence configurable (mensuel par defaut)
- Email rappel envoye au staff, CTA vers fiche client
- Exclusions: HUBFIT, coachs, partis

### Classification
- Revenus/Depenses: base sur le champ `type` de chaque transaction
- Coachs exclus de Seances + KPIs Clients
- Membres expires exclus de KPIs Clients
- Renouvellement: options dedupliquees

## Completed Work
- Import 6 CSV + coachs + deduplication + DUO
- Dashboard temps reel + alertes + churn + entonnoir GHL
- Systeme Bilans/Suivis avec activation manuelle
- Revenus recurrents bases sur billing_enabled
- Fix onboarding (optimistic update)
- Fix dialog membre (billing + review + duo scrollable)
- Fix Caroline en revenu
- Coachs exclus Seances + KPIs Clients
- Neal Zaharna cree comme partenaire DUO
- Email bilan envoye au staff avec CTA fiche client
- **Paiements synchronises (2026-03-18):**
  - Suppression 3 schedules obsoletes + 7 paiements orphelins
  - 75 plannings enrichis avec noms membres
  - Generation paiements basee sur billing_enabled (plus payment_schedules)
  - 47 paiements mars 2026 avec tous les noms corrects

## Backlog
- **P1**: Explication complete des workflows
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface migration donnees CSV
- **P2**: Calcul CPL, CPR, LTV
- **P3**: Refactoring recalculate_month
- **P3**: Logique DUO cote backend
- **P3**: Verification donnees sources CSV
