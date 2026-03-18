# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Regles Metier Principales

### Revenus Recurrents
- Source: membres avec `billing_enabled=True` ET `billing_amount > 0`
- Exclut: coachs (THE COACH/VIRTUAL COACH), membres partis (exit_date passe)
- 47 membres actuellement, total ~6202 CHF/mois

### Bilans / Suivis
- **Activation manuelle:** Toggle `annual_review_enabled` par membre
- **Date du 1er bilan:** Configurable par membre via `first_review_date`
- **Frequence:** Configurable (mensuel/trimestriel/semestriel/annuel), defaut mensuel
- **Exclusions:** HUBFIT, coachs, membres partis
- **Auto-generation:** Uniquement pour membres avec toggle active
- **Email rappel:** Envoye a l'EQUIPE (pas au membre), CTA vers fiche client

### Classification
- **Revenus/Depenses:** Base sur le champ `type` de chaque transaction
- **Coachs:** Exclus de Saisie Seances et KPIs Clients
- **Membres expires:** Exclus du KPI Clients
- **DUO:** Partenaire lie via duo_partner_id
- **Renouvellement:** Options de duree dedupliquees

## Completed Work (2026-03-18)
- Import 6 CSV + coachs + deduplication + DUO
- Dashboard temps reel + alertes + churn
- Regroupement DUO + avertissement edition
- Cycle renouvellement editable + Facturation modifiable
- KPIs auto-recalcules depuis transactions
- Transactions cliquables vers membres
- Entonnoir GHL synchro
- Systeme Bilans/Suivis avec activation manuelle
- Revenus recurrents bases sur billing_enabled
- Fix onboarding (optimistic update, plus de saut)
- Fix dialog membre (billing + review + duo scrollable)
- Fix Caroline en revenu (classification par type transaction)
- Coachs exclus Seances + KPIs Clients
- Fix renouvellement doublons
- Neal Zaharna cree comme partenaire DUO
- Email bilan envoye au staff avec CTA fiche client

## Backlog
- **P1**: Explication complete des workflows
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface migration donnees CSV
- **P2**: Calcul CPL, CPR, LTV
- **P3**: Refactoring de recalculate_month
- **P3**: Deplacer logique DUO cote backend
- **P3**: Verification/nettoyage donnees sources CSV
