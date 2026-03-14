# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".
- **Stack:** React frontend + FastAPI backend + MongoDB
- **Integrations:** GoHighLevel (GHL), Resend (email)

## Core Architecture
```
/app/
├── backend/ (FastAPI)
│   ├── routers/ (ghl, settings, members, kpis, challenges, courses, annual_reviews, etc.)
│   ├── models/ (settings, members, kpi, courses, transactions, etc.)
│   ├── services/ (ghl_service)
│   └── server.py
└── frontend/ (React + Shadcn/UI + TailwindCSS + CRACO)
    ├── src/components/ (GHLFunnelSection, Layout, ui/)
    ├── src/pages/ (Dashboard, MembersPage, CoursesPage, AnnualReviewsPage, SettingsTypesPage, etc.)
    ├── src/hooks/ (useMonthlyKPIData, useTranslations, etc.)
    └── craco.config.js (custom webpack config with ResizeObserver fix)
```

## Completed Features
- Apple Design System + 18+ feature modules
- GoHighLevel (GHL) Integration - sync, funnel, sale confirmation, auto-member creation
- Onboarding - Simplified 2 tabs (Onboarding + Historique), sidebar badge
- Challenge 6 Sem - Check-in read-only, bilans section, auto-generate
- Renewal dialog - Dynamic dropdowns, billing toggle
- Categories - Editable (pencil icon + PUT endpoint)
- Monthly KPIs, Members, Transactions, Payments, Course KPIs, Sessions
- Client KPIs, Coaches, Bilans/Suivis, Recurring payments, Email via Resend
- PDF Report export
- **ResizeObserver fix** - 3-layer suppression (CRACO runtimeErrors + monkey-patch + error handler) [2026-03-14]
- **Dynamic subscription types** - Membership types from DB, used in MembersPage + GHLFunnelSection [2026-03-14]
- **Settings Types page** - Full CRUD for membership and member types [2026-03-14]
- **Auto-generate bilans mensuels** - Button on Bilans/Suivis page, creates monthly check-ins for non-challenge members [2026-03-14]
- **Course KPIs to salary expenses** - Fixed instructor field bug, improved salary generation with coach_id fallback [2026-03-14]

## Test Reports
- iteration_35.json: 100% (bilans auto-generate + salary generation)
- iteration_34.json: 100% (ResizeObserver + dynamic types + Settings CRUD)

## Credentials
- Login: test@crossfit.ch / test123

## Backlog
- **P1**: Expliquer le workflow complet a l'utilisateur
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees
- **P2**: Calcul automatique de CPL, CPR, LTV
