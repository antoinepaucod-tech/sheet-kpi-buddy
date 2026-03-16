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
- Onglets: Actifs | Coachs | Expirés/Churn | Expirant | Partis | Tous

### DUO Members
- 7 abonnements DUO actifs (primary + partner = 14 records)
- `persons_count=2` pour les primaires, `persons_count=1` pour les partenaires
- `is_primary_subscriber` et `subscription_group_id` pour lier les pairs
- Certains membres avec "&" dans le nom (ex: "Nathalie Zaharna & Neal") ne sont PAS marqués DUO
- Doublons identifiés: Nicholas Schmale (HUBFIT×2), 4 personnes avec double abo (HUBFIT + THE COACH)

### Real-time Member Stats (from /api/members/stats)
- 326 Total (importés)
- 66 Membres actifs (non-coach, non-parti, non-expiré)
- 29 Coachs actifs
- 5 Membres expirés (subscription_end_date < today, pas partis)
- 226 Partis (exit_date définie)
- 0 Expirant (30j)

## Pages Principales
- Dashboard (/) - KPIs financiers + stats membres en temps réel + **zone d'alertes** expirations
- Membres (/members) - Onglets, filtres par abonnement (26 types), **édition exit_date**
- Transactions (/transactions) - Édition, filtres catégories, client links
- Budget Mensuel (/budget) - Grille éditable catégories × mois
- KPIs Cours (/courses) - Fréquentation des cours (taux formaté 1 décimale)

## Key API Endpoints
- `GET /api/members/stats` - Stats membres temps réel
- `GET /api/members/memberships` - 26 noms d'abonnements uniques
- `GET /api/members/expiring?days=60` - Membres dont l'abonnement expire bientôt
- `PUT /api/members/{id}` - Mise à jour membre (inclut exit_date)
- `GET /api/courses?year=X&month=Y` - Cours avec fréquentation

## Completed Work
- [2026-03-16] Import complet des données (326 membres, 3425 transactions, 38 catégories)
- [2026-03-16] Page Budget Mensuel avec grille éditable
- [2026-03-16] Différenciation Coachs (badge, exclusion des actifs, onglet)
- [2026-03-16] Édition manuelle des transactions (PUT + modal UI)
- [2026-03-16] Cartes statistiques cliquables sur MembersPage
- [2026-03-16] Filtres transactions par catégorie
- [2026-03-16] **FIX P0: Dashboard stats temps réel (/api/members/stats)**
- [2026-03-16] **FIX P0: Filtre par abonnement (26 types) sur MembersPage**
- [2026-03-16] **FIX P0: Membres "Partis" correctement classés**
- [2026-03-16] **FIX P0: Échéanciers de paiement générés (75 total)**
- [2026-03-16] **FIX P0: Fréquentation des cours visible**
- [2026-03-16] **Édition de la date de sortie (exit_date) dans le formulaire membre**
- [2026-03-16] **Zone d'alertes Dashboard pour abonnements expirant (60j)**

## Backlog
- **P1**: Configurer les types de bilans selon le type d'abonnement
- **P1**: Système de rappels automatiques pour bilans/suivis
- **P2**: Explication complète des workflows à l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de données
- **P2**: Calcul CPL, CPR, LTV
