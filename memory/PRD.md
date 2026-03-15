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
    ├── src/pages/ (Dashboard, MembersPage, CoursesPage, ChallengePage, AnnualReviewsPage, SettingsTypesPage, PaymentsPage, etc.)
    ├── src/hooks/ (useMonthlyKPIData, useTranslations, etc.)
    └── craco.config.js (custom webpack config with ResizeObserver fix)
```

## Completed Features
- Apple Design System + 18+ feature modules
- GoHighLevel (GHL) Integration - sync, funnel, sale confirmation, auto-member creation
- Onboarding - Simplified 2 tabs, sidebar badge
- Challenge 6 Sem - Objective based on actual check-ins only (not boolean), bilans section
- Renewal dialog - Dynamic dropdowns, billing toggle
- Categories - Editable
- Monthly KPIs, Members, Transactions, Payments, Course KPIs, Sessions
- Client KPIs, Coaches, Bilans/Suivis, Recurring payments, Email via Resend
- PDF Report export
- ResizeObserver fix - 3-layer suppression [2026-03-14]
- Dynamic subscription types - from DB [2026-03-14]
- Settings Types page - Full CRUD [2026-03-14]
- Auto-generate bilans mensuels [2026-03-14]
- Course KPIs to salary expenses [2026-03-14]
- Bulk course creation - "Planifier la semaine" dialog [2026-03-15]
- Auto-sync salaires on attendance change [2026-03-15]
- **Late payments red badge** in sidebar [2026-03-15]
- **Challenge objective fix** - removed boolean fallback, only real check-ins count [2026-03-15]
- **GHL sale creates accounting transaction** - "VENTES / ABONNEMENTS" category [2026-03-15]
- **Coach replacement per week** - S1-S5 dropdown dialog, yellow indicators for overrides [2026-03-15]

## Test Reports
- iteration_37.json: 100% (badge, challenge fix, GHL tx, coach replacement)
- iteration_36.json: 100% (bulk creation, auto-sync salary, edit modal, year selector)
- iteration_35.json: 100% (bilans, salary generation)
- iteration_34.json: 100% (ResizeObserver, dynamic types, Settings CRUD)

## Credentials
- Login: test@crossfit.ch / test123

## Backlog
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees
- **P2**: Calcul automatique de CPL, CPR, LTV
