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
- **Onboarding** - Simplified: only Onboarding + Historique tabs, badge in sidebar (count of pending)
- **Challenge 6 Sem** - Check-in read-only, bilans section, auto-generate weekly bilans
- **Renewal dialog** - Fixed: billing toggle visible, dropdowns with position="popper", no overflow
- Monthly KPIs, Members management, Multi-month analysis, PDF export
- Transactions, Payments, Course KPIs, Sessions, Client KPIs, Coaches
- Bilans/Suivis, Categories, Recurring payments, Email via Resend

## Recent Changes (March 14, 2026)
- Onboarding page: removed "À venir", "Manqués" tabs and "Planifier un suivi" button
- Added sidebar notification badge for pending onboardings
- Completed onboardings shown in Historique tab with table
- Renewal dialog: fixed dropdown overflow with position="popper", cleaned duplicate membership types
- Challenge: check-in boxes read-only, bilans section with auto-generate button
- Cleaned test data (TEST_ participants, rogue KPIs, duplicate GHL sales)

## Backlog
- **P0**: Explain full workflow to user
- **P1**: Fix remaining visual dashboard errors
- **P1**: Link course KPIs to salaries for auto-expenses
- **P2**: WhatsApp alerts (Twilio)
- **P2**: Data migration interface
- **P2**: Auto CPL/CPR/LTV calculation
