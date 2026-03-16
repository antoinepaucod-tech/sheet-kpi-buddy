# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)
- **Login:** test@crossfit.ch / test123

## Data (6 CSV importes)
- `customer_members`: 326 membres (138 courants, 187 partis, 1 doublon)
- `accounting_transactions`: 3425 transactions
- `accounting_categories`: 38 categories
- `monthly_kpis`: 32 mois
- `course_kpis`: 76 cours
- `instructors`: 7, `coaches`: 7

## Member Classification Logic
- **Partis**: exit_date < today (187 membres)
- **Courants**: pas de exit_date OU exit_date >= today, pas de doublon (138 membres)
- **Coaches**: abonnement contenant "THE COACH" ou "VIRTUAL COACH" (31 actifs)
- **Coach_also**: 5 personnes avec double abo (HUBFIT + COACH) -> fiche HUBFIT exclue des actifs
- **DUO**: 2 enregistrements distincts (PRIMARY + PARTNER), comptent pour 2 personnes, groupes visuellement
- **Doublons**: 1 vrai doublon (Nicholas Schmale HUBFIT x2)
- Resultat: 97 membres actifs, 31 coachs actifs, 5 expires, 187 partis

## Completed Work
- [2026-03-16] Import complet des 6 CSV + 7 coachs synchronises
- [2026-03-16] Dashboard stats temps reel + zone alertes expirations
- [2026-03-16] Edition exit_date dans formulaire membre
- [2026-03-16] Filtre par abonnement (26 types) sur MembersPage
- [2026-03-16] Nettoyage complet (11 comptes test, endpoints seed, fichiers test)
- [2026-03-16] Deduplication membres: personnes avec double abo (HUBFIT+COACH) ne comptent plus 2x
- [2026-03-16] Fix overflow cartes KPI sur Analyse Multi-Mois (text-base + truncate)
- [2026-03-16] Regroupement visuel des membres DUO (PRIMARY + PARTNER cote a cote avec badges)
- [2026-03-16] Fix: Membres avec exit_date futur classes comme actifs et non partis
- [2026-03-16] Fix: Partenaires DUO avec meme nom ne sont plus marques comme doublons

## Backlog
- **P1**: Systeme de rappels automatiques pour bilans/suivis
- **P1**: Explication complete des workflows a l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees (import CSV)
- **P2**: Calcul CPL, CPR, LTV
