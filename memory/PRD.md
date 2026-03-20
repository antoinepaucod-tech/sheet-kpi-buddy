# TRANSFORM - Pilotage Financier pour Clubs de Sport

## Description
SaaS de pilotage financier multi-clubs pour franchises de clubs de sport. L'application permet de gérer les membres, les finances, les KPIs, et les opérations de plusieurs clubs depuis un seul tableau de bord.

## Architecture
- **Frontend**: React (CRA) + Shadcn/UI + Lucide Icons
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB (kpibuddy)
- **Multi-Tenant**: Isolation par `club_id` via header `X-Club-Id`

## Utilisateurs
- **Super Admin** (`antoine.paucod@the-coach.pro`): Accès à tous les clubs, sélecteur de club dans le header
- **Manager**: Accès restreint à leur(s) club(s) uniquement

## Clubs
1. Transform Versoix (toutes les données existantes)
2. Transform Grand Saconnex (vide)
3. Transform Servette (vide)
4. Transform Lausanne (vide)

## Fonctionnalités Implémentées

### Gestion Multi-Clubs (P0) - DONE (Mars 2026)
- 4 clubs créés avec isolation des données
- Script de migration: 4752 documents migrés vers Transform Versoix
- Tous les routers filtrés par `club_id` via header `X-Club-Id`
- Sélecteur de club dans le header (Super Admin uniquement)
- Rôles: Super Admin / Manager
- Tests: 18/18 backend + 100% frontend (iteration_63)

### KPIs Financiers Avancés - DONE
- ACRM (Average Club Revenue per Member)
- LTV (Lifetime Value)
- ROAS (Return on Ad Spend) - basé sur GHL/Ad Spend
- CAC (Customer Acquisition Cost)
- CPL (Cost per Lead)
- CPR (Cost per Result)
- Collection Rate
- ACRM Expected

### Gestion des Membres - DONE
- CRUD complet avec types (Généraux, PIF, PT, Coaching)
- Dissociation Membres vs Coachs
- Suivi des abonnements et renouvellements
- Système de facturation récurrente

### Comptabilité - DONE
- Transactions (revenue/expense) avec catégories
- Budget mensuel par catégorie
- Récurrence (mensuelle, personnalisée)
- Auto-recalcul des KPIs

### Bilans / Suivis - DONE
- Planification automatique des bilans
- Fréquences configurables
- Notifications sidebar synchronisées

### Activité (Cours) - DONE
- Types de cours, KPIs par cours
- Gestion des instructeurs
- Génération des salaires

## Credentials de Test
- Super Admin: antoine.paucod@the-coach.pro / test123
- Manager: test@crossfit.ch / test123

## Prochaines Tâches

### P1
- Intégration API bsport (en attente des clés)
- Intégration Revolut Business API

### P2
- Intégration GoHighLevel + Notifications avancées
- Alertes WhatsApp via Twilio
- Interface migration CSV

### P3
- Refactoring Dashboard.js (>900 lignes)
- Refactoring MembersPage.js (>1300 lignes)
