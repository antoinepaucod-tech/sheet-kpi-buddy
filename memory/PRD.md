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

### Real-time Member Stats (from /api/members/stats)
- 326 Total (importés), 66 Membres actifs, 29 Coachs actifs
- 5 Expirés, 226 Partis (exit_date définie)

## Key API Endpoints
- `GET /api/members/stats` - Stats membres temps réel
- `GET /api/members/memberships` - 26 noms d'abonnements uniques
- `GET /api/members/expiring?days=60` - Alertes expirations
- `PUT /api/members/{id}` - Mise à jour membre (inclut exit_date)
- `GET /api/courses?year=X&month=Y` - Cours avec fréquentation
- `GET /api/init` - Vérifie si des données existent (plus de seed automatique)

## Accounts
- `test@crossfit.ch` - Compte principal (CrossFit Lausanne)
- `antoine.paucod@the-coach.pro` - Compte utilisateur (HybridGym)

## Completed Work
- [2026-03-16] Import complet des données (326 membres, 3425 transactions, 38 catégories)
- [2026-03-16] Page Budget Mensuel avec grille éditable
- [2026-03-16] Différenciation Coachs (badge, exclusion des actifs, onglet)
- [2026-03-16] Édition manuelle des transactions (PUT + modal UI)
- [2026-03-16] Cartes statistiques cliquables sur MembersPage
- [2026-03-16] Filtres transactions par catégorie
- [2026-03-16] FIX P0: Dashboard stats temps réel (/api/members/stats)
- [2026-03-16] FIX P0: Filtre par abonnement (26 types) sur MembersPage
- [2026-03-16] FIX P0: Membres "Partis" correctement classés (exit_date)
- [2026-03-16] FIX P0: Échéanciers de paiement générés (75 total)
- [2026-03-16] FIX P0: Fréquentation des cours visible
- [2026-03-16] Édition de la date de sortie (exit_date) dans le formulaire membre
- [2026-03-16] Zone d'alertes Dashboard pour abonnements expirant (60j)
- [2026-03-16] **NETTOYAGE COMPLET: Suppression de 11 comptes test, endpoints seed, boutons démo, fichiers de test, logs GHL/notifications**

## Backlog
- **P1**: Configurer les types de bilans selon le type d'abonnement
- **P1**: Système de rappels automatiques pour bilans/suivis
- **P2**: Explication complète des workflows à l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de données
- **P2**: Calcul CPL, CPR, LTV
