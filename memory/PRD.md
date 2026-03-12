# Sheet KPI Buddy - Product Requirements Document

## Overview
Application SaaS de pilotage financier pour clubs de sport.

## Core Features (18 modules)

1. **Authentication** - JWT, multi-tenancy
2. **KPIs Dashboard** - Revenue/expense, advanced metrics, PDF, comparison
3. **Transactions** - CRUD, categories, auto-recalc, bulk, recurring
4. **Members** - CRUD, subscriptions, billing, **Duo**, review frequency
5. **Payments** - Schedules, tracking, alerts, **email reminders**
6. **Onboarding** - 5-step checklist, follow-ups
7. **6 Weeks Challenge** - Fixed/Personal types, check-in goals
8. **Bilans / Suivis** - Multi-frequency, **history charts**, email reminders
9. **Course KPIs** - Attendance, instructors, **salary generation**
10. **Client KPIs** - Weekly training, engagement
11. **Global Attendance** - Grid view, editable, color-coded
12. **Coach Management** - CRUD, hourly rates, replacements
13. **Messagerie & Notifications** - Resend emails, templates, logs, compose, bulk
14. **Data Reset** - Reset transactional data, keep config
15. **Settings** - Club info, KPI targets, types, columns
16. **Sidebar Navigation** - 7 grouped sections, collapsible

## Architecture
- **Backend**: FastAPI, 16 router files, ~210 line server.py
- **Frontend**: React, 18 pages, shadcn/ui, Recharts, TanStack Query
- **Database**: MongoDB
- **Email**: Resend (domain: thecoachswitzerland.ch, sender: contact@thecoachswitzerland.ch)

## Sidebar Sections
1. PILOTAGE: Dashboard, Analyse Multi-Mois
2. MEMBRES: Membres, Paiements, Onboarding
3. ACTIVITÉ: KPIs Cours, Saisie Séances, KPIs Clients, Coachs
4. PROGRAMMES: Challenge 6 Sem., Bilans / Suivis
5. COMPTABILITÉ: Transactions, Récurrentes, Catégories
6. COMMUNICATION: Messagerie
7. CONFIGURATION: Paramètres, Config. Types

## Backlog
### P1
- [ ] Intégration API Bsport (en attente agreement)
- [ ] Export CSV membres

### P2
- [ ] WhatsApp (Twilio), WebSockets, auto-renouvellements
- [ ] Dashboard coach personnel

## Testing: 5 iterations (11-15) all 100% ✅
