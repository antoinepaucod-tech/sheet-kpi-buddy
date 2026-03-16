# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Data (6 CSV importés)
- `customer_members`: 326 membres (100 courants, 226 partis)
- `accounting_transactions`: 3425 transactions
- `accounting_categories`: 38 catégories
- `monthly_kpis`: 32 mois
- `course_kpis`: 76 cours
- `instructors`: 7, `coaches`: 7

## Member Deduplication Logic
- 5 personnes ont double abonnement (HUBFIT + COACH): leur fiche HUBFIT est marquée `is_coach_also=true` et exclue des "Actifs"
- 2 vrais doublons (Nicholas Schmale HUBFIT×2, Salomé DUO×2): marqués `is_duplicate=true`
- Résultat: 59 membres actifs, 29 coachs actifs, 5 expirés, 226 partis, 98 total courants

## Completed Work
- [2026-03-16] Import complet des 6 CSV + 7 coachs synchronisés
- [2026-03-16] Dashboard stats temps réel + zone alertes expirations
- [2026-03-16] Édition exit_date dans formulaire membre
- [2026-03-16] Filtre par abonnement (26 types) sur MembersPage
- [2026-03-16] Nettoyage complet (11 comptes test, endpoints seed, fichiers test)
- [2026-03-16] **Déduplication membres: personnes avec double abo (HUBFIT+COACH) ne comptent plus 2x**
- [2026-03-16] **Fix overflow cartes KPI sur Analyse Multi-Mois (text-base + truncate)**

## Backlog
- **P1**: Configurer les types de bilans selon le type d'abonnement
- **P1**: Système de rappels automatiques pour bilans/suivis
- **P2**: Explication complète des workflows à l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de données
- **P2**: Calcul CPL, CPR, LTV
