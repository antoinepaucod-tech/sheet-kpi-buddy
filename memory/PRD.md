# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Core Architecture
- React frontend + FastAPI backend + MongoDB
- GoHighLevel (GHL) integration for sales pipeline
- Resend for email integration

## Completed Features
- Apple Design System + 18 feature modules
- **GoHighLevel (GHL) Integration** - COMPLETE:
  - Sync pipeline with date filter + auto-month switch
  - Enhanced sale confirmation dialog: subscription type, member type (PIF/Recurring/PT), cash, signature date from GHL, expiration auto-calculated, recurring billing cycle
  - Member creation with deduplication + 6 Week Challenge auto-add
  - KPI updates: cash_collected, fast_cash, total_revenue, active_members, new_members
- Onboarding & Follow-up system (5-step onboarding + scheduled followups)
- Monthly KPIs with objectives and progress bars
- Members management with renewal dialog + billing cycle
- Multi-month analysis, PDF export, Transactions, Payments
- Course KPIs, Sessions, Client KPIs, Coaches pages
- Challenge 6 Sem., Bilans/Suivis, Categories, Recurring payments
- Email communications via Resend

## Data Consistency Fixes (March 14, 2026)
- Cleaned test data pollution from testing agent (12 test sales, rogue 2030-12 KPI)
- Fixed chart data mapping: `active_members || total_active_members || total_members`
- Synced `total_members` with `active_members` in GHL confirm-sale endpoint
- Fixed renewal dialog: overflow-y-auto + functional state updates for billing toggle

## Backlog
- **P0**: Explain full workflow to user
- **P1**: Fix remaining visual dashboard errors
- **P1**: Link course KPIs to salaries for auto-expenses
- **P2**: WhatsApp alerts (Twilio)
- **P2**: Data migration interface
- **P2**: Auto CPL/CPR/LTV calculation
