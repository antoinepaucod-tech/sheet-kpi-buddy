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

## Completed Tasks (Session 2026-05-08 — Sprint B Frontend Lot 2 + ESLint Guard + Onboarding Audit) ✅
- [x] **B.6.1** Modale `RevertPaymentDialog` sur paiements payés (+ option mail Resend)
- [x] **B.6.2** Modale `RevertCoachRentDialog` + champs `rent_amount`/`rent_status` + colonne Loyer
- [x] **Hotfix UI auto-refresh v4** : pattern `setQueriesData` synchrone (instant) + `invalidateQueries` (reconciliation) sur les mutations critiques (revert payment, mark-paid, delete-payment, revert coach rent). Helpers `patchPaymentInCache` / `removePaymentFromCache`.
- [x] **Sweep technique TanStack Query v5** : 40 calls `invalidateQueries(['key'])` (positionnel déprécié, no-op silencieux) migrés vers `invalidateQueries({queryKey:['key']})` sur 7 fichiers (Onboarding, Attendance, SettingsTypes, ClientKPI, Challenge, Courses, AnnualReviews). Vérifié : 0 occurrence positionnelle restante.
- [x] **ESLint guard** : règle `no-restricted-syntax` ciblant les CallExpression `invalidateQueries / refetchQueries / cancelQueries` avec premier arg ArrayExpression. Active en 2 endroits :
  - `package.json` `eslintConfig` (CRA build → fail au `yarn build`)
  - `eslint.config.js` flat config + script `yarn lint:rq` (CLI / CI)
  - Validé end-to-end : fichier de test avec violation → erreur claire en français-aware.
- [x] **Mini-feature Onboarding date+auteur** : Backend `PUT /members/{id}/onboarding` stamps `onboarding_completed_at`, `onboarding_completed_by`, `onboarding_completed_by_name` (= local part de l'email), `onboarding_completed_by_email` lors du passage à 100%. Idempotent (re-saves préservent l'auteur original). Régression (uncomplete) clear les 4 champs. Frontend OnboardingPage Historique : 2 nouvelles colonnes "Onboardé le" + "Par". Banner inline "Onboardé le X par Y" sur les cartes complétées (toggle "Voir complétés" ON). Backward-compat OK : 7 entrées historiques existantes affichent "—" pour Par.
- [x] Testing frontend e2e iter79 : 6/7 assertions PASS (86%). TEST2 inconclusive automated mais validé via cleanup phase + curl backend.

## Completed Tasks (Session 2026-05-08 — Sprint C : Catégorisation membres) ✅
- [x] **Audit préalable** : 27 memberships distincts catégorisés sur 124 actifs (lecture seule)
- [x] **Phase 1 — Backend helper** : `/app/backend/core/member_categorization.py` avec `get_member_category`, `get_duo_pair`, `is_active`, `_dedupe_partenaire`, `get_active_members_by_category`. Stratégie hybride : flags `is_coach_subscription`/`is_duo` du `membership_types` en source primaire + fallback regex pour les 6 orphelins. **67/67 tests pytest PASS**.
- [x] **2 endpoints lecture seule** : `GET /api/members/categories` (mapping complet) + `GET /api/members/categories/stats` (compteurs + dédup Partenaire). Validés via curl Versoix : `{HG:53, Coach:25, Partenaire:12, IFRC:12, OpenGym:7, Challenge:2, Pret:1, Inconnu:1, total:113}`.
- [x] **Phase 2 — Hook `useMemberCategories.js`** : TanStack Query, expose `getCategory/getDuoPartnerId/getDuoPartnerName/isPrimaryInDuo` + constantes `CATEGORY_LABELS`/`ONBOARDING_EXCLUDED_DEFAULT`/`ATTENDANCE_EXCLUDED_DEFAULT`.
- [x] **OnboardingPage** : Select "Catégorie" (data-testid `onboarding-category-filter`) à côté du search. Filtre par défaut exclut OpenGym/Pret/Inconnu. Pour Partenaires : 1 ligne par couple (dédup) + badge violet `& <partenaire> • DUO` sur le primary (data-testid `duo-pair-{id}`).
- [x] **AttendancePage** : 5 sections ordonnées **HG / IFRC / Challenge / Coachs (repliable, déplié par défaut, persisté localStorage `attendance_coaches_section_expanded`) / Partenaires (DUO)**. Pour les couples Partenaire : 2 lignes adjacentes regroupées visuellement (fond purple + bordure latérale `#BF5AF2` + badge `DUO` partagé sur la primary). Saisie indépendante par membre validée (1 cellule = 1 POST). Filtre `!m.is_coach` retiré (la catégorisation gère).
- [x] **CoursesPage** : Widget "Membres actifs par catégorie" (data-testid `category-stats-widget`) avec 6 mini-cards colorées par catégorie (HG/Coach/Partenaire/IFRC/OpenGym/Challenge), bordure latérale colorée.
- [x] Testing frontend e2e iter80+iter81 : **9/9 scénarios PASS (100%)** après 2 hotfixes (filter `is_coach` retiré, eslintConfig `extends:['react-app']` retiré qui cassait le dev compile).

## Completed Tasks (Session 2026-05-12 — Fix `generate-salary-expenses` club_id défense en profondeur) ✅
- [x] **Bug pré-existant fixé** : `POST /api/courses/generate-salary-expenses/{year}/{month}` ne propageait pas `club_id` dans les transactions insérées. Pattern Sprint A appliqué : (1) validation 400 si club_id absent du header, (2) injection explicite `doc["club_id"] = club_id` APRÈS `model_dump()`. Validation : sans X-Club-Id → 400, avec → club_id propagé. 4 transactions test créées+nettoyées.
- [x] **Audit exhaustif** des 43 autres inserts sur collections critiques effectué (voir Sprint Hardening dans Upcoming Tasks ci-dessous)

## Completed Tasks (Session 2026-05-12 — Cleanup collection `instructors` Option A) ✅
- [x] **Phase 1 — Backup** : `/app/backups/instructors_backup_20260512_083511.json` (7 docs)
- [x] **Phase 2 — Cleanup backend** :
  - Endpoints `GET/POST/PUT/DELETE /api/instructors` retirés (`routers/courses.py`)
  - Fallback `instructors_map` retiré dans `generate-salary-expenses` (utilise désormais uniquement `coaches.hourly_rate`)
  - Import Pydantic `Instructor` retiré + docstring fichier mise à jour
  - `routers/admin.py:13` (liste collections export/import) : `instructors` retiré
  - `routers/settings.py:142` (liste reset/seed) : `instructors` retiré
  - `scripts/import_data.py` : fonction `import_instructors()` supprimée + appel retiré + collection retirée de la liste reset
  - `scripts/migrate_multi_club.py:42` : `instructors` retiré de la liste
- [x] **Phase 3 — Cleanup frontend** : `useQuery(['instructors'])` retiré dans `CoursesPage.js` + 3 fallbacks UI (instructor fallback string, dropdown coach fallback, dropdown week instructor fallback)
- [x] **Phase 4 — Tests preview AVANT drop** : 9 pages chargées sans erreur console, `GET /api/instructors` → 404, `generate-salary-expenses/2026/3` PASS (calcul via coaches.hourly_rate)
- [x] **Phase 5 — Drop Mongo** : garde-fou cible OK (`transform.iocnr7b.mongodb.net/club_management`), `db.instructors.drop()` exécuté, collection absente post-drop, `coaches` inchangée (7 docs)
- [x] **Phase 6 — Tests post-drop** : 9 pages OK, planning W19-W22 affiché correctement
- [x] **Bug pré-existant détecté pendant cleanup** : `generate-salary-expenses` insère des transactions **sans `club_id`** (pas un régression du cleanup, pré-existant). 4 transactions test créées puis nettoyées immédiatement. À fixer plus tard.
- [x] Lint backend + frontend : 0 erreur


- [x] **Hook réutilisable** `useBulkArchiveAction(entityType)` (member|coach) : Set sélection, exécution séquentielle, progress, results, invalidation TanStack ciblée par entité, MAX_BULK_SIZE=50.
- [x] **Composants partagés** : `BulkActionBar` (sticky bottom, count + Archiver/Restaurer + Désélectionner) et `BulkArchiveConfirmDialog` (3 phases : confirm avec raison / progress avec barre / results avec détail erreurs collapsible).
- [x] **Intégration 3 pages** : `MembersPage` (archive), `CoachesPage` (archive), `ArchivesPage` (restore, 2 onglets avec hooks séparés membre/coach).
- [x] **Checkbox UX** : colonne en première position, header "Tout sélectionner" avec état `indeterminate` Radix natif, click sur ligne ne déclenche pas l'expand (stopPropagation cell).
- [x] **Garde-fous** : MAX_BULK_SIZE=50 enforcé via select-all cap (toast.info) + per-item click guard (toast.warning).
- [x] **Toast récap** : 3 modes (succès complet vert / partiel orange / échec complet rouge) + détail erreurs collapsible dans results dialog.
- [x] **Design fix** : right-padding (`pr-44`) sur BulkActionBar pour éviter le chevauchement avec le badge "Made with Emergent" en preview.
- [x] Testing e2e iter_86 : 12/12 frontend PASS. Test 11 (réelle exécution sur prod Atlas) intentionnellement skippé pour protéger les données. Code review confirme cache invalidation correcte (`['members']`, `['members-archived']`, `['memberships-unique']` pour member / `['coaches']`, `['coaches-archived']` pour coach).

## Completed Tasks (Session 2026-05-11 — Sprint D Phase 3 — D.2 + D.3) ✅- [x] **D.3 Backend** : Helper `iso_weeks_for_month(year, month)` (règle ISO "la semaine appartient au mois où tombe son lundi"). Endpoint `GET /api/courses/iso-weeks/{year}/{month}` retourne `{year, month, total_slots, slots:[{slot, iso_year, iso_week, monday_date}]}`. Vérifié sur Mars 2026 (5 lundis 02/09/16/23/30 W10-14), Avril 2026 (4 lundis 06/13/20/27 W15-18 — exclut bien le lundi 30/03 W14), Mai 2026 (4 lundis 04/11/18/25 — inclut le lundi 04/05 W19 et l'exclut d'avril).
- [x] **D.3 Backend — nouvelle formule `attendance_rate`** : `total_attendance / (max_capacity × nb_slots_écoulés)` où `nb_slots_écoulés` = slots dont `monday_date <= today`. Les semaines à 0 ne sont plus exclues du dénominateur (la formule précédente sur-estimait). Implémenté dans `_compute_attendance_rate` (`routers/courses.py`).
- [x] **D.3 Frontend** : `CoursesPage` fetch maintenant `/iso-weeks/{year}/{month}` et rend 4 ou 5 colonnes dynamiques avec label `S{n}` + date du lundi `DD/MM`. Badge "Remplaçant" jaune (`substitute-badge-{course_id}-{slot}`) si `weekN_instructor !== instructor`. `colSpan` Loader/Empty également dynamique (`7 + isoSlots.length`).
- [x] **D.2 Backend** : 2 nouveaux endpoints `POST /api/courses/copy-month/preview` (pure lecture, calcule `will_create`/`will_overwrite`/`will_keep`) et `POST /api/courses/copy-month` (exécution avec `overwrite: bool`). Identité d'un cours pour dédup : `(day_of_week, time_slot, course_name)`. Présences repartent à 0. Cours dest sans équivalent source = conservés intacts. Réponse : `{created, overwritten, kept, skipped, message}`.
- [x] **D.2 Frontend** : Composant `CopyPlanningDialog` avec 2 SelectMonth (12 mois passés / 6 futurs), checkbox overwrite, preview LIVE qui se recalcule au changement source/dest/overwrite. Affichage 3 lignes colorées (vert créés / jaune écrasés / gris conservés). Bouton "Recopier planning" remplace l'ancien bouton mono-direction. Lien fallback dans la bannière "aucun cours".
- [x] Testing e2e iter_85 : 11/11 backend + 7/7 frontend (100% PASS). Aucune mutation prod (preview testé en lecture seule, click final Recopier non exécuté pour préserver les 80 cours d'Avril 2026).

## Completed Tasks (Session 2026-05-11 — Sprint D Phase 2 + Bonus Engagement Widget) ✅- [x] **Phase 2 Backend** :
  - Champs Pydantic `pause_start_date` / `pause_end_date` / `pause_reason` ajoutés à `CustomerMember` (Optional, nullable, format YYYY-MM-DD)
  - Endpoint `PUT /api/members/{id}/pause` body `{start_date (requis), end_date (optionnel), reason (optionnel)}`. Validation : format ISO, end >= start, refuse si membre archivé (400).
  - Endpoint `DELETE /api/members/{id}/pause` : clear les 3 champs, idempotent.
  - Helper `_is_on_pause(member, today_iso)` activé (true ssi `start <= today` ET `(end is None OR today <= end)`)
  - `GET /api/members` enrichi : flag `on_pause` calculé pour chaque doc + param `include_paused` (default false → exclut paused)
  - `GET /api/members/at-risk` exclut auto via `_is_on_pause`
  - `GET /api/onboarding/pending` enrichi avec `on_pause` + param `include_paused`
- [x] **Bonus widget — Backend** : `GET /api/members/{id}` retourne nouveau bloc `engagement_recent = {status, category, sessions_last_4_weeks, last_session_date, last_session_iso_week, period_weeks}`. Statuts : `engaged` (≥3), `moderate` (1-2), `at_risk` (0), `on_pause` (priorité), `not_tracked` (OpenGym/Inconnu/Pret), `null` (archivé). Bulk fetch weekly_trainings sur 4 dernières semaines ISO.
- [x] **Phase 2 Frontend** :
  - Composants partagés : `PauseBadge.js`, `PauseMemberDialog.js` (mode set + remove), `EngagementWidget.js`
  - `MembersPage` : toggle `Inclure en pause` (data-testid `members-include-paused-toggle`), badge `EN PAUSE` sur ligne, opacité réduite, section Statut dans expanded (data-testid `pause-section-{id}`) avec boutons Mettre en pause / Modifier / Annuler la pause
  - `OnboardingPage` : toggle `onboarding-include-paused-toggle`, badge inline `EN PAUSE` (data-testid `onboarding-pause-badge-{id}`)
  - `AttendancePage` : toggle `attendance-include-paused-toggle`
  - PauseMemberDialog : 2 date pickers (start required, end optional avec min=start), textarea raison, mode `remove` confirme avant DELETE
- [x] **Bonus widget — Frontend** : `EngagementWidget` mounted dans MembersPage expanded view (sauf si archivé). Couleurs et icônes par statut (lucide). Compteur séances 4 sem + badge statut + dernière séance formatée FR (`EEEE d MMMM yyyy`).
- [x] Testing e2e iter_84 : 11/11 backend + 7/7 frontend (100% PASS). Cleanup auto des pauses test via fixture.

## Completed Tasks (Session 2026-05-11 — Sprint D Phase 1 + bonus UX) ✅
- [x] **Bonus UX PaymentsPage** : champ "Générer pour le mois X" seedé automatiquement depuis `selectedMonth` global (`useEffect` sync)
- [x] **D.1 Couleurs Transactions par type** : helper `getTxTypeStyle(tx)` retourne `{rowClass, amountClass, sign, kind}`. Mapping :
  - `revenue` → vert (`--color-success`, fond `rgba(48,209,88,0.04)`)
  - `expense` + catégorie commençant par `SALAIRE*` → bleu (`--color-accent`, fond `rgba(10,132,255,0.04)`)
  - `expense` autre → rouge (`--color-danger`, fond `rgba(255,69,58,0.04)`)
  - fallback (type vide) → neutre gris
  - Bordure gauche 4px colorée + tinted hover + signe `+`/`-` + montant teinté. Attribut `data-tx-kind` exposé pour test e2e.
  - Validé sur mars 2026 Versoix : 148 tx (103 revenue + 32 expense + 13 salary).
- [x] **D.5 Page "Membres à risques"** :
  - Backend : `GET /api/members/at-risk?weeks=N` (N clampé 1..12, défaut 2). Réponse `{period, total, members[]}`.
  - Logique : membres actifs non archivés, exclut catégories `OpenGym/Inconnu/Pret` + membres en pause (via `_is_on_pause`, helper inerte tant que Phase 2 pas livrée). Bulk fetch `weekly_trainings` sur les N semaines ISO, total `trainings_count == 0` → inclus. Tri DESC par `weeks_without_session` puis ASC par nom. `weeks_without_session` calculé via `datetime.fromisocalendar(year, week, 1)` (999 si jamais aucune saisie).
  - Frontend : nouvelle page `/at-risk` (`AtRiskMembersPage.js`), nouveau lien sidebar `Administration > Membres à risques` (icône `AlertTriangle`). Sélecteur période 1/2/3/4 semaines (défaut 2), recherche client-side, counter avec bordure rouge, badges catégorie colorés, lien "Voir" → `/members?search={name}`.
  - Validation : 115 membres at-risk pour Versoix (W19+W20 2026), tri/filtre/recherche tous OK. Tombe à 66 sur 12 semaines (confirme que le filtre fonctionne).
- [x] Testing e2e iter_83 : 8/8 backend + 7/7 frontend (100% PASS).

## Completed Tasks (Session 2026-05-09 — Cleanup Infra + Fix Option B Paiements) ✅
- [x] **Cleanup Infra** :
  - Drop DB locale `kpibuddy` (27 collections / 5037 docs orphelins post-migration Atlas)
  - Suppression endpoints `GET /api/admin/download-backup` + `GET /api/admin/backup-status` (404 confirmé)
  - Suppression `BACKUP_DOWNLOAD_TOKEN` du `.env`
  - Suppression dumps `/app/backups/db_a_recovery_*` (~3M libérés)
  - Backups Atlas pré-migration conservés (`atlas_pre_apply_20260423_*`, `dump_20260423_*`)
- [x] **Fix Option B Paiements** : PaymentsPage branchée sur `selectedMonth` global du Layout
  - Bug racine identifié (iter_82 RCA) : queryKey `["payments"]` était PRÉFIXE de `["payments","late"]` et `["payments","upcoming"]`. Le `setQueriesData({queryKey:["payments"]}, fn)` dans `patchPaymentInCache`/`removePaymentFromCache` faisait du PREFIX MATCH par défaut → corruption silencieuse du cache des onglets late/upcoming + gel du fetch bulk.
  - Fix : queryKey bulk renommée `["payments","all"]` (sibling, plus parent) + `setQueriesData` utilise `{exact:true}` pour ne patcher QUE le cache bulk
  - `invalidateQueries({queryKey:["payments"]})` (prefix) continue d'invalider les 3 caches enfants → comportement inchangé après mutation
  - Validation e2e screenshot : 5/5 tests PASS (mai/avril/mars 2026 KPIs dynamiques, listes correctes, non-régression Dashboard/Transactions)

## Upcoming Tasks
- (P1) **🆕 Sprint Hardening club_id** — 2-3h dédiées :
  - Audit exhaustif des 43 inserts critiques (catégorisation 🟢 OK / 🟡 Vulnérable conditionnel / 🔴 Aucun club_id explicite)
  - Échantillon 🔴 déjà identifié : `routers/payments.py:372,437`, `routers/coaches.py:209`, `routers/members.py:1175,1205,1231`, `routers/ghl.py:266,282,298,314,348,393`
  - Cas spécial GHL : 5 inserts webhook dérivent club_id du payload (pas du header) → audit flux complet
  - Stratégie par catégorie : 🟢 tester payload sans club_id → Pydantic refuse / 🟡 conditionnel → required / 🔴 pattern défense en profondeur
  - Migration data post-fix : repérer docs existants avec `club_id: null` (comme l'audit 96 docs de semaine dernière)
- (P1) Investigation collection doublon `instructors` ✅ RÉSOLU 2026-05-12 (Option A appliquée)
- (P1) Cleanup data Partenaires : noms combinés "X & Y FirstLast & Lastname" sur les couples DUO
- (P1) Cleanup membre actif sans membership : Teo Succi (id `52004b50…`)
- (P1) Backend GET /api/payments : aligner sur `?month=YYYY-MM` côté serveur (cohérence avec Dashboard/Transactions, actuellement filtre full client-side)
- (P1) Refactor `_is_on_pause` : extraire dans `core/` (DRY — réimplémenté inline dans `routers/onboarding.py`)
- (P2) UX CopyPlanningDialog : label "conservés (pas dans la source)" trompeur quand overwrite=OFF
- (P2) Integration API bsport
- (P2) Integration Revolut Business API + Category mapping
- (P2) Integration API GoHighLevel + Notifications
- (P2) CRON renouvellement token Meta Ads (60 jours)
- (P2) Alertes WhatsApp via Twilio
- (P2) Widget dashboard "Onboardings de la semaine par utilisateur" (top 3)
- (P2) Digest hebdo CRON dimanche : email aux coachs avec membres at_risk + transitions at_risk→engaged

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
