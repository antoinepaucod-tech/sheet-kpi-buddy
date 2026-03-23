# TRANSFORM - SaaS Multi-Club Franchise Management

## Problem Statement
Application SaaS pour la gestion multi-clubs (franchise) de salles de fitness/coaching. Permet le suivi des membres, paiements, onboardings, bilans, KPIs, et integration Meta Ads.

## Architecture
- **Frontend**: React + TanStack Query + Shadcn/UI
- **Backend**: FastAPI + MongoDB (Motor async)
- **Multi-Tenant**: Header `X-Club-Id` pour isoler les requetes par club
- **Auth**: JWT (Super Admin a acces a tous les clubs)

## Core Features Implemented
- Dashboard Franchise (multi-club overview, ROAS, Meta metrics)
- Gestion membres (CRUD, abonnements DUO, exit/renewal)
- Paiements (cycles billing interval_days, DUO logic, auto-cancel 0 CHF)
- Onboarding (pending/completed/skipped, exclude coaches/IFRC)
- Bilans / Annual Reviews (nutrition score, evolution chart)
- Meta Ads Integration (Ad spend, CAC calculation)
- Config Meta Ads Help Page

## Completed Tasks
- [x] Multi-Tenant Franchise Dashboard
- [x] Meta Ads Integration
- [x] Billing cycles interval_days fix
- [x] DUO payments fix (root member only)
- [x] Filter inactive/cancelled members from payments
- [x] Exclude coaches/IFRC from onboarding
- [x] Separate onboarding history from pending
- [x] Cleanup unused subscription types
- [x] Nutrition score + evolution chart in bilans
- [x] Skip Onboarding feature (2026-03-23)
- [x] Sync billing_amount to pending/late payments on member update (2026-03-23)
- [x] Fix Kristina Jonova future payment marked paid (2026-03-23)
- [x] Fix Teo Succi & Adrianna Zapata missing club_id (2026-03-23)
- [x] Fix Cindy payment generation when billing_amount 0→positive (2026-03-23)
- [x] Fix sidebar badges not refreshing on club switch (2026-03-23)
- [x] DB Query Optimization - 11 warnings resolved (2026-03-23)
  - distinct() for memberships
  - Date filter in MongoDB for expiring members
  - Pagination for transactions
  - Aggregation pipeline for monthly-grid (50K→pipeline)
  - Aggregation for churn count + limit 36 months KPIs
  - Aggregation $sum for recurring revenue
  - Reduced projections for member counts

## Upcoming Tasks
- (P1) Integration API bsport
- (P1) Integration Revolut Business API + Category mapping
- (P2) Integration API GoHighLevel + Notifications
- (P2) CRON renouvellement token Meta Ads (60 jours)
- (P2) Alertes WhatsApp via Twilio

## Backlog
- (P3) Refactoring MembersPage.js (>1500 lines) et Dashboard.js (>900 lines)
- (P3) Responsive Mobile / PWA optimization

## Key Credentials
- Super Admin: antoine.paucod@the-coach.pro / TheCoach1290.
