# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Core Architecture
- React frontend + FastAPI backend + MongoDB
- GoHighLevel (GHL) integration for sales pipeline
- Resend for email integration

## Completed Features
- Apple Design System + 18 feature modules
- **GoHighLevel (GHL) Integration** - COMPLETE
- **Onboarding** - Simplified (only Onboarding + Historique tabs), badge in sidebar
- **Challenge 6 Sem** - Check-in read-only, bilans section, auto-generate weekly bilans
- **Renewal dialog** - Fixed: dropdowns with position="popper", no ResizeObserver error, clean membership types from settings
- **Categories** - Now editable (pencil icon + PUT endpoint), duplicates removed
- Monthly KPIs, Members management, Multi-month analysis, PDF export
- Transactions, Payments, Course KPIs, Sessions, Client KPIs, Coaches
- Bilans/Suivis, Recurring payments, Email via Resend

## Recent Changes (March 14, 2026)
- Categories: added edit functionality (Pencil icon + backend PUT /api/categories/{id})
- Removed duplicate membership types (Trimestriel, 6 Semaines)
- Suppressed ResizeObserver error globally (Radix UI bug in Dialogs)
- Onboarding: removed "À venir", "Manqués" tabs, simplified to 2 tabs only
- Sidebar: added badge notification for pending onboardings
- Renewal dialog: Select dropdowns use position="popper", all state updates use functional prev => ({...prev})

## Backlog
- **P0**: Explain full workflow to user
- **P1**: Fix remaining visual dashboard errors
- **P1**: Link course KPIs to salaries for auto-expenses
- **P2**: WhatsApp alerts (Twilio)
- **P2**: Data migration interface
- **P2**: Auto CPL/CPR/LTV calculation
