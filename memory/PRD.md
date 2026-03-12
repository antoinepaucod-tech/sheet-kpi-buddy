# TRANSFORM - Product Requirements Document

## Overview
Application SaaS de pilotage financier pour clubs de sport. Anciennement "Sheet KPI Buddy" / "TheCoach", renommée "TRANSFORM".

## Core Features (18 modules)

1. **Authentication** - JWT, multi-tenancy (club_id isolation)
2. **KPIs Dashboard** - Revenue/expense, advanced metrics, PDF export, comparison
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
- **Backend**: FastAPI, 16 router files, modular architecture
- **Frontend**: React, 18 pages, shadcn/ui, Recharts, TanStack Query
- **Database**: MongoDB
- **Email**: Resend (domain: thecoachswitzerland.ch, sender: contact@thecoachswitzerland.ch)

## Design System - TRANSFORM
- **Theme**: Dark, Apple-inspired
- **Background**: #09090B (main), #121214 (cards/surfaces)
- **Accent**: Rose-600 (#E11D48)
- **Typography**: Barlow Condensed (headings, uppercase), IBM Plex Sans (body), JetBrains Mono (KPIs/data)
- **Border radius**: rounded-sm (sharp, minimal)
- **Headers**: font-heading text-4xl font-extrabold text-white uppercase tracking-tight

## Sidebar Sections
1. PILOTAGE: Dashboard, Analyse Multi-Mois
2. MEMBRES: Membres, Paiements, Onboarding
3. ACTIVITE: KPIs Cours, Saisie Seances, KPIs Clients, Coachs
4. PROGRAMMES: Challenge 6 Sem., Bilans / Suivis
5. COMPTABILITE: Transactions, Recurrentes, Categories
6. COMMUNICATION: Messagerie
7. CONFIGURATION: Parametres, Config. Types

## Completed Work
- Full backend refactoring into modular APIRouters
- Duo subscriptions
- Review history charts (recharts)
- Global attendance grid
- Resend email integration & inbox
- Sidebar reorganization
- **TRANSFORM UI/UX redesign (completed 2026-03-12)**:
  - All branding changed from KPI Buddy/TheCoach to TRANSFORM
  - Consistent dark theme across all 18+ pages
  - Unified page headers (Barlow Condensed, uppercase)
  - Stats cards: rounded-sm, bg-[#121214], font-mono values
  - Backend branding updated (API title, PDF footer, email templates)

## Backlog
### P0
- [ ] Integration API Bsport (en attente agreement utilisateur)

### P1
- [ ] Export CSV membres
- [ ] Lier KPIs cours aux salaires (validation)

### P2
- [ ] WhatsApp (Twilio), WebSockets, auto-renouvellements
- [ ] Dashboard coach personnel
- [ ] Interface migration donnees "Lovable"

## Testing: iteration_16 - 100% frontend pass
