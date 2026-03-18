# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Data
- `customer_members`: 327 membres (incl. Neal Zaharna ajouté comme partenaire DUO)
- `accounting_transactions`: 3425 transactions
- `monthly_kpis`: 32 mois (recalcules depuis transactions + GHL)
- `payment_schedules`: 75 (73 actifs)
- `annual_reviews`: 95 bilans mensuels auto-generes pour membres actifs eligibles

## Regles Bilans / Suivis
- **Frequence:** Mensuelle pour tous les membres
- **Exclusions:** HUBFIT, coachs (THE COACH/VIRTUAL COACH), membres partis
- **Auto-generation:** Calcul date depuis contract_signed_date + 1 mois
- **Resume auto:** Presences + paiements dans le modal de completion
- **Email rappel:** CTA "Prendre rendez-vous" (mailto)
- **Alertes dashboard:** Widget avec total planifies, en retard, cette semaine, 30 prochains jours

## Regles Metier
- **Classification revenus/depenses:** Basee sur le champ `type` de chaque transaction (pas sur la categorie)
- **Coachs:** Exclus de Saisie Seances et KPIs Clients
- **Membres expires:** Exclus du KPI Clients (exit_date passe = exclus)
- **DUO:** Partenaire lie via duo_partner_id et subscription_group_id
- **Renouvellement:** Options de duree dedupliquees (pas de doublons)

## Completed Work
- Import 6 CSV + coachs + deduplication + DUO
- Dashboard temps reel + alertes + churn
- Regroupement DUO + avertissement edition
- Cycle renouvellement editable + Facturation modifiable
- KPIs auto-recalcules depuis transactions
- Transactions cliquables vers membres
- Entonnoir GHL synchro
- Transactions recurrentes peuplees
- Systeme complet Bilans/Suivis (2026-03-18)
- **Corrections 6 bugs (2026-03-18):**
  - DUO partenaire Neal Zaharna cree et lie a Nathalie
  - Caroline correctement classee en revenu (fix classification par type transaction)
  - Coachs exclus de Saisie Seances et KPIs Clients
  - Membres partis exclus de KPIs Clients
  - Options de renouvellement dedupliquees (plus de doublons)
  - Alexandra Dankova visible dans onglet "Expires" (subscription_end_date passee)

## Backlog
- **P1**: Explication complete des workflows
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface migration donnees CSV
- **P2**: Calcul CPL, CPR, LTV
- **P3**: Refactoring de recalculate_month
- **P3**: Deplacer logique DUO cote backend
- **P3**: Verification/nettoyage donnees sources CSV
