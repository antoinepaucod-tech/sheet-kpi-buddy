# TRANSFORM - Pilotage Financier pour Clubs de Sport

## Description
SaaS de pilotage financier multi-clubs pour franchises de clubs de sport. L'application permet de gérer les membres, les finances, les KPIs, et les opérations de plusieurs clubs depuis un seul tableau de bord.

## Architecture
- **Frontend**: React (CRA) + Shadcn/UI + Lucide Icons
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB (kpibuddy)
- **Multi-Tenant**: Isolation par `club_id` via header `X-Club-Id`
- **Meta API**: Facebook Marketing API v20.0 pour Ad Spend automatisé

## Utilisateurs
- **Super Admin** (`antoine.paucod@the-coach.pro` / `TheCoach1290.`): Accès à tous les clubs + Dashboard Franchise
- **Manager** (`test@crossfit.ch` / `test123`): Accès restreint à Transform Versoix uniquement

## Clubs
1. Transform Versoix (toutes les données existantes)
2. Transform Grand Saconnex (vide)
3. Transform Servette (vide)
4. Transform Lausanne (vide)

## Fonctionnalités Implémentées

### Gestion Multi-Clubs (P0) - DONE (Mars 2026)
- 4 clubs créés avec isolation des données
- Script de migration: 4752 documents migrés vers Transform Versoix
- Tous les routers filtrés par `club_id`
- Sélecteur de club dans le header (Super Admin uniquement)
- Rôles: Super Admin / Manager
- Tests: iteration_63 (18/18 backend + 100% frontend)

### Dashboard Franchise - DONE (Mars 2026)
- Vue agrégée de tous les clubs (CA Total, Dépenses, Ad Spend, Membres, Coachs, ACRM, ROAS, Résultat Net)
- Comparatif visuel par club avec barres de progression (membres et coachs séparés)
- Evolution mensuelle du CA avec Ad Spend
- Tableau Budget Publicitaire par Club (Ad Spend, Impressions, Clicks, CPC, ROAS)
- Accessible uniquement au Super Admin
- Tests: iteration_64 + iteration_65 (bug fixes CSS + data mapping, 100% pass)

### Intégration Meta Ads API - DONE (Mars 2026)
- Connexion live au compte Meta Ads (act_1180089966353771 / Hybrid Gym)
- Token 60 jours avec échange automatique
- Endpoints: /meta/status, /meta/ad-spend/{year}/{month}, /meta/sync-ad-spend
- Synchronisation automatique du Ad Spend dans les KPIs mensuels
- Bannière de statut Meta dans le Dashboard Franchise
- Tests: iteration_64 (PASS)

### KPIs Financiers Avancés - DONE
- ACRM, LTV, ROAS, CAC, CPL, CPR, Collection Rate, ACRM Expected

### Gestion des Membres - DONE
- CRUD complet, dissociation Membres/Coachs, facturation récurrente

### Comptabilité - DONE
- Transactions, budget mensuel, récurrence, auto-recalcul KPIs

### Bilans / Suivis - DONE
- Planification automatique, fréquences configurables, notifications

## Credentials
- Super Admin: antoine.paucod@the-coach.pro / TheCoach1290.
- Manager: test@crossfit.ch / test123
- Meta App ID: 2184333752310459
- Meta Ad Account: 1180089966353771

## Prochaines Tâches

### P1
- Intégration API bsport (en attente des clés client)
- Intégration Revolut Business API

### P2
- Intégration GoHighLevel + Notifications avancées
- Alertes WhatsApp via Twilio
- Interface migration CSV

### P3
- Refactoring Dashboard.js (>900 lignes)
- Refactoring MembersPage.js (>1300 lignes)
- Renouvellement automatique du token Meta avant expiration
