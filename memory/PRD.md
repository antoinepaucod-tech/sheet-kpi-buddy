# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Data Model

### Subscription Types (26 active)
**Membres PIF (13):** 6 WEEKS CHALLENGE, HYBRID FULL - PAIEMENT ANNUEL X1, HYBRID FULL DUO - PAIEMENT ANNUEL X1, OFFRE 6 MOIS - 499 CHF, OPEN GYM - PAIEMENT ANNUEL X1, PACK 10 SESSIONS, PACK 20 SESSIONS, PRÊT, THE COACH ENTRÉE, THE COACH PASS - PAIEMENT ANNUEL X1, THE COACH PASS 6 MOIS - PAIEMENT X1, UNLIMITED ACCESS - PAIEMENT X1 - ANNUEL, UNLIMITED ACCESS DUO - PAIEMENT ANNUEL X1

**Membres Généraux Récurrents (13):** HUBFIT, HYBRID FULL - PAIEMENT MENSUEL, HYBRID FULL DUO - PAIEMENT MENSUEL, HYBRID FULL DUO SANS ENGAGEMENT - PAIEMENT MENSUEL, HYBRID FULL SANS ENGAGEMENT - PAIEMENT MENSUEL, HYBRID FULL STUDENT - PAIEMENT MENSUEL, IFRC, OPEN GYM - PAIEMENT MENSUEL, THE COACH PASS MENSUEL, UNLIMITED ACCESS - PAIEMENT MENSUEL, UNLIMITED ACCESS DUO - PAIEMENT MENSUEL, UNLIMITED ACCESS SANS EMGAGEMENT - PAIEMENT MENSUEL, VIRTUAL COACH

### Coach vs Member Classification
- **Coach keywords:** THE COACH, VIRTUAL COACH
- **Coaches** sont séparés des membres actifs dans tout le SaaS
- Badge "COACH" bleu visible sur chaque coach
- Onglets: Actifs | Coachs | Expirés/Churn | Expirant | Tous

### Members (326 imported)
- 110 Coachs
- 105 Membres actifs (non-coach)
- 111 Membres expirés (non-coach, subscription_end_date < today)

### Accounting Categories (38)
- **Revenue (25):** Per membership type + COMPLEMENTS ALIMENTAIRES, PT ANTOINE, PRÊT
- **Expense (13):** LOGICIELS, ABONNEMENTS, LOYERS, SALAIRES COACH, etc.

### Transactions (3425 imported)
- Editable manuellement (PUT /api/transactions/{id})
- Filtrables par catégorie avec groupes dépliants
- Colonne Client avec lien vers profil membre

## Pages Principales
- Dashboard (/) - KPIs, graphiques, funnel
- Membres (/members) - Onglets: Actifs/Coachs/Expirés/Tous, cartes stats cliquables
- Transactions (/transactions) - Édition, filtres catégories, client links
- Budget Mensuel (/budget) - Grille éditable catégories × mois
- Catégories (/categories) - Gestion des catégories comptables
- Récurrentes (/recurring) - Gestion des transactions récurrentes
- Challenge 6 Sem. (/challenge) - Programme challenge
- Bilans/Suivis (/annual-reviews) - Bilans par membre
- KPIs Cours (/courses) - Fréquentation des cours

## Completed Work
- [2026-03-16] Fix typo CHALENGE, workflows GHL/manuel, classification PIF/Récurrent
- [2026-03-16] Import complet des données (326 membres, 3425 transactions, 38 catégories, etc.)
- [2026-03-16] Page Budget Mensuel avec grille éditable
- [2026-03-16] Différenciation Coachs (badge COACH, exclusion des actifs, onglet dédié)
- [2026-03-16] Édition manuelle des transactions (PUT endpoint + modal UI)
- [2026-03-16] Séparation Expirés/Churn avec style distinct et badge EXPIRÉ
- [2026-03-16] Cartes statistiques cliquables comme filtres dans MembersPage
- [2026-03-16] Filtres transactions par catégorie avec groupes dépliants (Revenus/Dépenses)
- [2026-03-16] Colonne Client dans transactions avec lien vers profil membre

## Backlog
- **P1**: Configurer les types de bilans en fonction du type d'abonnement
- **P1**: Système de rappels automatiques pour bilans/suivis
- **P2**: Explication complète des workflows à l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de données
- **P2**: Calcul CPL, CPR, LTV
