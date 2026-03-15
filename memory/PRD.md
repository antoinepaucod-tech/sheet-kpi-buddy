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
    ├── src/pages/ (Dashboard, MembersPage, CoursesPage, ChallengePage, AnnualReviewsPage, PaymentsPage, TransactionsPage, etc.)
    ├── src/hooks/ (useMonthlyKPIData, useTranslations, etc.)
    └── craco.config.js (custom webpack config with ResizeObserver fix)
```

## Notification Badges (Sidebar)
- **Onboarding** : badge bleu = pending onboardings
- **Paiements** : badge rouge = late payments
- **Bilans / Suivis** : badge bleu = upcoming (14 jours) + badge rouge = overdue

## Completed Features
- Apple Design System + 18+ feature modules
- GoHighLevel (GHL) Integration + auto accounting transaction on sale confirmation
- Onboarding - Simplified 2 tabs, sidebar badge
- Challenge 6 Sem - Objective based on actual check-ins only
- Renewal dialog - Dynamic dropdowns, billing toggle
- Categories - Editable
- Monthly KPIs, Members, Transactions, Payments, Course KPIs, Sessions
- Client KPIs, Coaches, Bilans/Suivis, Recurring payments, Email via Resend
- PDF Report export
- ResizeObserver fix - 3-layer suppression [2026-03-14]
- Dynamic subscription types [2026-03-14]
- Settings Types page - Full CRUD [2026-03-14]
- Auto-generate bilans mensuels [2026-03-14]
- Course KPIs to salary expenses [2026-03-14]
- Bulk course creation [2026-03-15]
- Auto-sync salaires on attendance change [2026-03-15]
- Late payments red badge [2026-03-15]
- Challenge objective fix [2026-03-15]
- GHL sale creates accounting transaction (type=revenue, category from DB) [2026-03-15]
- Coach replacement per week (S1-S5 dropdown dialog) [2026-03-15]
- **Bilans/Suivis dual badges** (blue upcoming + red overdue) [2026-03-15]
- **GET /api/annual-reviews/overdue** endpoint [2026-03-15]

## Concepts
- **Transactions exclues** : Quand on supprime une transaction, elle est exclue (pas effacee). Recuperable via le toggle en bas de la page.
- **Recurrentes** : Templates de transactions auto-generees chaque mois (loyer, abonnements, etc.).

## Test Reports
- iteration_38.json: 100% (badges bilans, GHL transaction fix)
- iteration_37.json: 100% (badge late, challenge fix, coach replacement)
- iteration_36.json: 100% (bulk, auto-sync salary)
- iteration_35.json: 100% (bilans, salary)
- iteration_34.json: 100% (ResizeObserver, dynamic types)

## Credentials
- Login: test@crossfit.ch / test123

## Backlog
- **P2**: Alertes WhatsApp via Twilio
- **P2**: Interface de migration de donnees
- **P2**: Calcul automatique de CPL, CPR, LTV
