# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)

## Subscription Types (31)
- **14 Membres Generaux Recurrents**: HUBFIT, HYBRID FULL (mensuel, duo, student, sans engagement), IFRC, OPEN GYM, THE COACH PASS (mensuel, annuel), UNLIMITED ACCESS (mensuel, duo, sans engagement), VIRTUAL COACH
- **17 Membres PIF**: 6 WEEKS CHALLENGE, HUBFIT(PIF), HYBRID FULL (annuel, duo annuel), IFRC(PIF), OFFRE 6 MOIS, OPEN GYM (annuel), PACK 10/20, PRET, THE COACH ENTREE, THE COACH PASS (annuel PIF, 6 mois), UNLIMITED ACCESS (annuel, duo annuel), VIRTUAL COACH(PIF)
- Chaque type a: member_type, is_coach_subscription, is_duo, is_pif, nb_membres

## Categories Comptables (13)
### Revenue (4)
- ABONNEMENTS (revenue_members) - revenue_type: Membre
- COACHING (revenue_coaching) - revenue_type: Service
- RETAIL (retail_revenue) - revenue_type: Produit
- COACHING VIRTUEL (coaching_virtuel_revenue) - revenue_type: Service

### Expense (9)
- LOYER, SALAIRES, SALAIRES COACHS, UTILITIES, MARKETING, PUBLICITE, ASSURANCE, AUTRE, DIVERS

## Business Rules
- **PIF**: montant total au 1er mois, 0 CHF les mois suivants
- **Duo**: 2 membres lies par subscription_group_id, seul le primaire genere des revenus
- **Membres actifs**: base sur subscription_end_date dans le futur OU pas d'exit_date
- **Revenue types**: Membre, Produit, Service
- **Recurrences**: auto-generees chaque mois, controlees par subscription_end_date et recurrence_end_date
- **Funnel %**: Calcules dynamiquement dans compute_metrics()
- **cash_collected**: = total revenue from transactions
- **avg_per_sale**: = cash_collected / close

## Workflows de Creation de Membres
### Workflow 1 - GHL Confirm Sale (POST /api/ghl/confirm-sale)
1. Crée le membre avec subscription_type et member_type
2. Calcule subscription_end_date si non fourni (Challenge: +42j, Annuel: +365j, etc.)
3. Crée un échéancier de paiement (si billing activé)
4. Crée un bilan/suivi (type "challenge" pour les challenges, "quarterly" sinon)
5. Auto-ajoute au Challenge actif si applicable
6. Crée une transaction comptable (catégorie ABONNEMENTS)
7. Recalcule les KPIs via _auto_recalculate_kpis

### Workflow 2 - Ajout Manuel (POST /api/members)
1. Auto-détecte si l'abonnement est un "challenge" (nom contient "challenge")
2. Si challenge: active automatiquement le bilan avec type "challenge" et date = signature + 42j
3. Crée le membre, l'échéancier de paiement, le bilan
4. Auto-ajoute au Challenge actif si applicable
5. Crée une transaction comptable (catégorie ABONNEMENTS)
6. Recalcule les KPIs

## Review/Bilan Types
- **challenge**: 42 jours après signature (6 Weeks Challenge)
- **monthly**: chaque mois
- **quarterly**: tous les 3 mois
- **semi-annually**: tous les 6 mois
- **annually**: tous les ans

## KPI Model Fields
### Revenue
- revenue_members, revenue_coaching, coaching_virtuel_revenue, retail_revenue, fast_cash_revenue

### Expenses
- loyer, salaires, salaires_coach, salaires_coachs, utilities, other_expenses, other_expenses_misc, insurance, marketing_spend, ad_spend

## Credentials
- Login: test@crossfit.ch / test123

## Completed Work
- [2026-03-16] Migration vers 31 types d'abonnements
- [2026-03-16] Correction workflows GHL et manuel (transactions, KPIs, bilans)
- [2026-03-16] Fix typo "CHALENGE" → "CHALLENGE" (DB, frontend, fallbacks)
- [2026-03-16] Fix auto-detection type "challenge" pour bilans dans le workflow manuel
- [2026-03-16] Fix UnboundLocalError base_date dans ghl.py (confirm-sale)
- [2026-03-16] Nettoyage données de test (DEBUG_Test, bilans dupliqués Thecoach)
- [2026-03-16] Ajout option "Challenge (6 semaines)" dans le select de fréquence de bilan

## Backlog
- **P0**: Import historique des transactions depuis 2024 (en attente du fichier CSV)
- **P1**: Configurer les types de bilans en fonction du type d'abonnement
- **P1**: Système de rappels automatiques pour bilans/suivis
- **P2**: Explication complète des workflows à l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de données
- **P2**: Calcul CPL, CPR, LTV
