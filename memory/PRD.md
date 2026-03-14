# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Core Architecture
- React frontend + FastAPI backend + MongoDB
- GoHighLevel (GHL) integration for sales pipeline
- Resend for email integration

## Completed Features (All tested - 100% pass rate)
- Apple Design System + 18 feature modules
- **GoHighLevel (GHL) Integration** - COMPLETE (sync, funnel, sale confirmation, auto-member)
- **Onboarding** - Simplified: 2 tabs (Onboarding + Historique), sidebar badge
- **Challenge 6 Sem** - Check-in read-only, bilans section, auto-generate
- **Renewal dialog** - Dropdowns fixed (position="popper"), billing toggle with green container
- **Categories** - Editable (pencil icon + PUT /api/categories/{id})
- **ResizeObserver fix** - Global suppressor in index.js, StrictMode removed
- **Membership types** - Cleaned to 5 types (removed Trimestriel, 6 Semaines duplicates)
- Monthly KPIs, Members, Transactions, Payments, Course KPIs, Sessions
- Client KPIs, Coaches, Bilans/Suivis, Recurring payments, Email via Resend

## Test Reports
- iteration_32.json: 100% (backend confirm-sale + frontend dialog)
- iteration_33.json: 100% (full E2E: all pages, dialogs, dropdowns, ResizeObserver)

## Backlog
- **P0**: Explain full workflow to user
- **P1**: Fix remaining visual dashboard errors  
- **P1**: Link course KPIs to salaries for auto-expenses
- **P2**: WhatsApp alerts (Twilio)
- **P2**: Data migration interface
- **P2**: Auto CPL/CPR/LTV calculation
