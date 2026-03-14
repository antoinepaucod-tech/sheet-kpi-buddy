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
- Onboarding & Follow-up system (5-step onboarding + scheduled followups)
- Monthly KPIs with objectives and progress bars
- Members management with renewal dialog + billing cycle
- Multi-month analysis, PDF export, Transactions, Payments
- Course KPIs, Sessions, Client KPIs, Coaches pages
- Challenge 6 Sem., Bilans/Suivis, Categories, Recurring payments
- Email communications via Resend

## Recent Fixes (March 14, 2026)
- Fixed revenue total (1797→599), active members (3→2), chart members mapping
- Deleted rogue 2030-12 KPI, cleaned test data pollution
- Enhanced renewal dialog: billing cycle toggle now green-themed, clickable container, visible Switch
- Made both "Changer d'abonnement" and "Modifier le cycle de facturation" rows fully clickable
- Onboarding: show completed members by default (toggle ON), stat card shows onboarding completions (3)

## Backlog
- **P0**: Explain full workflow to user
- **P1**: Fix remaining visual dashboard errors
- **P1**: Link course KPIs to salaries for auto-expenses
- **P2**: WhatsApp alerts (Twilio)
- **P2**: Data migration interface
- **P2**: Auto CPL/CPR/LTV calculation
