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

## Completed Tasks (Session 2026-04-23 / 2026-05-08 — Migration Atlas + Sprint B Apply + Récupération DB-A)
- [x] **Migration DB MongoDB locale → MongoDB Atlas** (2026-04-23)
  - Backup complet pré-migration (724 KB ZIP, 27 collections, 5037 docs)
  - Connection Atlas hardcodée dans `/app/backend/core/config.py` (load_dotenv override=False)
  - `mongorestore` kpibuddy → club_management : 5037/5037 docs OK, 0 failure
  - DB locale `kpibuddy` conservée intacte pour rollback 48h minimum
  - Doc : `/app/MIGRATION_ATLAS.md`
- [x] **Sprint B `--apply` APPLIQUÉ sur Atlas** (2026-04-23)
  - Fix script `migrate_sprint_b.py` : import depuis `core.config` + garde-fou visuel de la cible DB
  - 207 archivés (204 exit_date + 3 HUBFIT obsolète) + 7 coachs rent_* init
  - 1 cas ambigu non touché : Cabassot & Bolle (HYBRID DUO normal)
- [x] **Récupération DB-A vers Atlas** (2026-05-08)
  - Découverte : le déploiement franchise-sync.emergent.host pointait sur DB-A (managed Emergent customer-apps.nngdus.mongodb.net) avant la migration Atlas du 23/04
  - 4 semaines de saisies utilisateur (30 mars - 28 avril) étaient dans DB-A, invisibles depuis Atlas perso
  - Dump DB-A obtenu via mongodb-viewer-2 Emergent (449 KB, 23 collections)
  - Merge sélectif via script `merge_db_a_recovery.py` (whitelist + INSERT only) :
    - 109 accounting_transactions (61 avril + 47 mars tardives + 1 mai)
    - 121 weekly_trainings (semaines 14-16 majoritairement)
    - 100 course_kpis
    - 12 activity_logs
    - 3 customer_members (Anouk Salina, Christine Wambaa, Norman Pilller) avec name trim + club_id Versoix forcé
  - Total : 345 docs récupérés
  - Sprint B préservé : 207 archivés, 7 coachs rent_* inchangés

## Completed Tasks (Session 2026-04-22 — Sprint B Backend)
- [x] Sprint A : Infrastructure soft delete (archived_at, rent_amount, rent_status, endpoints /archive, /restore, /revert-to-unpaid)
- [x] Sprint B Backend : Classification endpoints A/B/C complète
  - Type C (blocage 400) : POST /challenges/{id}/participants, /annual-reviews, /followups, /payments
  - Type B (filtre silencieux) sur toutes les listes : payments (+/late +/upcoming), followups (+/upcoming +/missed), annual-reviews (+/upcoming +/overdue +/stats +/dashboard-alerts)
  - Type B sur les générations en masse : payments/generate, annual-reviews/auto-generate, challenges/auto-generate-bilans, notifications/send-bulk
  - Type A + warning `member_archived` : mark-paid, revert-to-unpaid
- [x] B.5 Redirection DELETE → soft delete (coaches + members, idempotent)
- [x] Script migration /app/backend/scripts/migrate_sprint_b.py (--dry-run par défaut, --apply avec confirmation)
- [x] Testing backend : 24/24 tests pytest passent (/app/backend/tests/test_iteration72_sprint_b_filters.py)

## Completed Tasks (Session 2026-05-08 — Sprint B Frontend Lot 1) ✅
- [x] **B.4.1** Boutons Archive/Restore + ArchiveConfirmDialog (avec champ "Raison" optionnel)
  - Composants partagés : `useArchiveAction.js` hook, `ArchiveBadge.js`, `ArchiveConfirmDialog.js`
  - Backend : `/archive` accepte body `{reason}` (members + coaches), stocke `archived_reason`, log activity_log pour members
- [x] **B.4.2** Toggle "Inclure les archivés" sur /members (`members-include-archived-toggle`) et /coaches (`coaches-include-archived-toggle`) + badge `ARCHIVÉ` visuel sur les lignes archivées
- [x] **B.4.3** Page `/archives` (sidebar section "Administration") avec 2 onglets (Membres / Coachs) via `?only_archived=true`, recherche, restore par ligne + confirmation
- [x] Testing frontend e2e : 11/11 scenarios passed (iteration_73.json)
- [x] Cross-validation : archive coach avec raison → apparaît dans /archives → restore → réapparaît dans /coaches

## Upcoming Tasks
- (P0) Sprint B Frontend **Lot 2** (à démarrer après validation prod du Lot 1) :
  - B.4.4 : Actions en masse (bulk archive/restore) avec checkboxes + barre de progression
  - B.6.1 : Modale de confirmation pour repasser un paiement en impayé (+ option email)
  - B.6.2 : Modale de confirmation pour repasser un loyer coach en impayé (+ option email)
- (P1) Bug "Paiements onglet vide avril 2026" sans filtre (mis en pause volontaire)
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
