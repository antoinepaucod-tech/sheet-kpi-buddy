# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Data Imported (6 CSV)
1. `membres.csv` → `customer_members`: 326 membres
2. `transactions_comptables.csv` → `accounting_transactions`: 3425 transactions
3. `categories_comptables.csv` → `accounting_categories`: 38 catégories
4. `kpis_mensuels.csv` → `monthly_kpis`: 32 mois
5. `kpis_cours.csv` → `course_kpis`: 76 cours
6. `instructeurs.csv` → `instructors`: 7 + `coaches`: 7

## Accounts (clean)
- `test@crossfit.ch` - Compte principal (CrossFit Lausanne)
- `antoine.paucod@the-coach.pro` - Compte utilisateur (HybridGym)

## Completed Work
- [2026-03-16] Import complet des 6 CSV
- [2026-03-16] Dashboard stats temps réel (/api/members/stats)
- [2026-03-16] Filtre par abonnement (26 types) sur MembersPage
- [2026-03-16] Membres "Partis" correctement classés (exit_date éditable)
- [2026-03-16] Zone d'alertes Dashboard pour abonnements expirant
- [2026-03-16] Nettoyage complet (11 comptes test, endpoints seed, fichiers test)
- [2026-03-16] **Synchronisation des 7 coachs du CSV dans la collection coaches**

## Backlog
- **P1**: Configurer les types de bilans selon le type d'abonnement
- **P1**: Système de rappels automatiques pour bilans/suivis
- **P2**: Explication complète des workflows à l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de données
- **P2**: Calcul CPL, CPR, LTV
