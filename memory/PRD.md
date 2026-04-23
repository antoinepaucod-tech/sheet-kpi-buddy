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
- KPIs Cours (planification hebdomadaire, édition, suppression)
- Saisie Séances (attendance tracking avec totaux temps réel)
- Config Types (types d'abonnement avec toggle liste des membres)
- Export/Import DB pour synchronisation preview → production

## Completed Tasks (Latest Session 2026-03-24)
- [x] Skip Onboarding feature
- [x] Sync billing_amount to pending/late payments on member update
- [x] Fix Kristina Jonova future payment marked paid
- [x] Fix Teo Succi & Adrianna Zapata missing club_id
- [x] Fix Cindy payment generation when billing_amount 0→positive
- [x] Fix sidebar badges not refreshing on club switch
- [x] DB Query Optimization - 11 warnings resolved
- [x] Export/Import DB endpoints for preview→production sync
- [x] Fix bulk course creation (missing club_id)
- [x] Fix new course type creation (Dialog instead of prompt)
- [x] Fix course name editing in edit modal
- [x] Fix attendance totals not updating (localUpdates state)
- [x] Feature: Toggle member list per subscription type in Config Types

## Completed Tasks (Session 2026-03-28)
- [x] Supabase KPI sync service (POST /api/sync/supabase, /api/sync/supabase/all, GET /api/sync/status)
- [x] APScheduler hourly auto-sync to Supabase
- [x] Auto-trigger sync after KPI recalculation (kpis.py → trigger_sync_for_club)
- [x] Club mapping MongoDB→Supabase UUID (Versoix, Servette, Grand-Saconnex, Lausanne)

## Completed Tasks (Session 2026-04-01)
- [x] Fix total_members/total_coaches split in Supabase payload (coach = member_type "coach" OR membership contains THE COACH/VIRTUAL COACH)
- [x] Month selector extended: 12 months into the future, default = current month
- [x] Dashboard arrow navigation: calendar-based, no longer limited to DB months
- [x] Monthly Rollover CRON (POST /api/rollover/run, /run/all, GET /status)
  - Auto-generates payments for current month (idempotent)
  - Auto-generates recurring transactions (idempotent, duplicate-safe)
  - Auto-marks past-due payments as "late"
  - Auto-creates KPI record for current month
  - Auto-recalculates KPIs + triggers Supabase sync
  - APScheduler daily at 01:00 UTC

## Completed Tasks (Session 2026-04-23 — Migration Atlas)
- [x] **Migration DB MongoDB locale → MongoDB Atlas** (2026-04-23)
  - Backup complet pré-migration (724 KB ZIP, 27 collections, 5037 docs)
  - Connection Atlas hardcodée dans `/app/backend/core/config.py` (load_dotenv override=False)
  - `mongorestore` kpibuddy → club_management : 5037/5037 docs OK, 0 failure
  - Validation intégrité : 100% match manifest vs Atlas
  - Tests endpoints : /members (328), /coaches (7), /payments (162) → HTTP 200
  - DB locale `kpibuddy` conservée intacte pour rollback 48h minimum
  - Doc : `/app/MIGRATION_ATLAS.md` (procédure complète + rollback)

## Completed Tasks (Session 2026-04-22 — Sprint B)
- [x] Sprint A : Infrastructure soft delete (archived_at, rent_amount, rent_status, endpoints /archive, /restore, /revert-to-unpaid)
- [x] Sprint B Backend : Classification endpoints A/B/C complète
  - Type C (blocage 400) : POST /challenges/{id}/participants, /annual-reviews, /followups, /payments
  - Type B (filtre silencieux) sur toutes les listes : payments (+/late +/upcoming), followups (+/upcoming +/missed), annual-reviews (+/upcoming +/overdue +/stats +/dashboard-alerts)
  - Type B sur les générations en masse : payments/generate, annual-reviews/auto-generate, challenges/auto-generate-bilans, notifications/send-bulk
  - Type A + warning `member_archived` : mark-paid, revert-to-unpaid
- [x] B.5 Redirection DELETE → soft delete (coaches + members, idempotent)
- [x] Script migration /app/backend/scripts/migrate_sprint_b.py (--dry-run par défaut, --apply avec confirmation)
- [x] Testing backend : 24/24 tests pytest passent (/app/backend/tests/test_iteration72_sprint_b_filters.py)

## Upcoming Tasks
- (P0) Sprint B suite : --apply de la migration APRÈS validation user + arbitrage des 3 cas ambigus
- (P0) Sprint B Frontend (B.4 + B.6) : boutons Archiver/Restaurer, onglet "Voir archivés", badges, modales confirmation
- (P1) Sprint C : Filtres par type membre (IFRC, HG, Open Gym, Partenaire) et coach (Interne, THE COACH)
- (P1) Sprint D : Couleurs transactions, planning, stats, membres à risques
- (P1) Investigation collection doublon `instructors`
- (P1) Integration API bsport
- (P1) Integration Revolut Business API + Category mapping
- (P2) Integration API GoHighLevel + Notifications
- (P2) CRON renouvellement token Meta Ads (60 jours)
- (P2) Alertes WhatsApp via Twilio

## Upcoming Tasks (OLD)
- (P1) Integration API bsport
- (P1) Integration Revolut Business API + Category mapping

## Backlog
- (P3) Refactoring MembersPage.js (>1500 lines) et Dashboard.js (>900 lines)
- (P3) Responsive Mobile / PWA optimization

## 3rd Party Integrations
- Supabase REST API (sync KPIs) — ACTIVE, anon key
- Meta Facebook Marketing API — requires User API Key
- GoHighLevel API — requires User API Key
- Resend (Emails) — requires User API Key

## Key Credentials
- Super Admin: antoine.paucod@the-coach.pro / TheCoach1290.
- Deployed URL: https://franchise-sync.emergent.host
