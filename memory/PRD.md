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
- **Onboarding system** - Completed onboardings now appear in Historique tab (not toggle)
- **Challenge 6 Semaines** - Check-in boxes read-only (driven by session attendance), bilans section added
- **Auto-bilan generation**: Weekly bilans auto-created for challenge participants, monthly for others
- Monthly KPIs, Members management, Renewal dialog with billing cycle
- Multi-month analysis, PDF export, Transactions, Payments
- Course KPIs, Sessions, Client KPIs, Coaches pages
- Bilans/Suivis, Categories, Recurring payments
- Email via Resend

## Recent Changes (March 14, 2026)
- Moved completed onboardings from toggle to Historique tab
- Challenge check-in boxes: read-only (no click), display only
- Added "Bilans hebdomadaires" section to Challenge page
- Auto-generate 6 weekly bilans when participant added to challenge
- POST /api/challenges/auto-generate-bilans endpoint for monthly bilans
- Added bilan_frequency field to member model
- Cleaned test data (TEST_ members, rogue KPIs)
- Fixed billing cycle toggle visibility in renewal dialog (green container)
- Fixed chart data mapping (active_members)

## Backlog
- **P0**: Explain full workflow to user
- **P1**: Fix remaining visual dashboard errors
- **P1**: Link course KPIs to salaries for auto-expenses
- **P2**: WhatsApp alerts (Twilio)
- **P2**: Data migration interface
- **P2**: Auto CPL/CPR/LTV calculation
