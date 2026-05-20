# 🛡️ Audit isolation multi-tenant `club_id` — Backend

**Audit date** : 2026-05-20T08:27:50.670265+00:00
**Scope** : `routers, services, core, scripts` (tests exclus)

## 1. Executive summary

Sur **510 call sites MongoDB** scannés via AST statique : **🔴 10 catastrophiques** (delete/update_many cross-club), **🟠 91 fuites read** (find/aggregate sans scope), **🟡 228 moyens** (find_one/delete_one/update_one sans scope), **🟢 94 safe**, **⚪ 87 hors scope** (scripts manuels). Effort cumulé patch estimé : **~1745 min** (~29h05).

## 2. Métriques globales

| Criticité | Count |
|---|---|
| 🟡 MOYEN_DOC_WRONG | 228 |
| 🟢 SAFE | 94 |
| 🟠 FUITE_READ | 91 |
| ⚪ OUT_OF_SCOPE | 87 |
| 🔴 CATASTROPHIQUE_CROSS_CLUB | 10 |

| Opération | Count |
|---|---|
| `find_one` | 186 |
| `find` | 162 |
| `update_one` | 84 |
| `delete_many` | 23 |
| `count_documents` | 23 |
| `delete_one` | 16 |
| `aggregate` | 9 |
| `update_many` | 6 |
| `distinct` | 1 |

### Top 5 fichiers les plus exposés (🔴+🟠+🟡)

| Fichier | Call sites à risque |
|---|---|
| `routers/members.py` | 65 |
| `routers/payments.py` | 35 |
| `routers/annual_reviews.py` | 33 |
| `routers/transactions.py` | 29 |
| `routers/challenges.py` | 22 |

## 3. 🔴 CATASTROPHIQUE_CROSS_CLUB (priorité 1)

| Fichier:ligne | Coll | Op | Endpoint | club_id Depends ? | filter |
|---|---|---|---|---|---|
| `routers/challenges.py:118` | `challenge_participants` | `delete_many` | DELETE /{challenge_id} | ❌ | dict_without_club_id |
| `routers/courses.py:168` | `course_kpis` | `update_many` | PUT /course-types/{type_id} | ✅ | dict_without_club_id |
| `routers/courses.py:532` | `accounting_transactions` | `delete_many` | POST /courses/generate-salary-expenses/{year}/{month} | ✅ | dict_without_club_id |
| `routers/members.py:878` | `payments` | `update_many` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:897` | `annual_reviews` | `delete_many` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:971` | `payments` | `update_many` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:1008` | `payments` | `update_many` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:1341` | `payments` | `update_many` | POST /{member_id}/renew | ✅ | dict_without_club_id |
| `routers/payments.py:119` | `payment_schedules` | `delete_many` | POST /payments/sync-with-members | ✅ | empty_dict |
| `routers/payments.py:145` | `payments` | `delete_many` | POST /payments/sync-with-members | ✅ | dict_without_club_id |

## 3. 🟠 FUITE_READ (priorité 2)

| Fichier:ligne | Coll | Op | Endpoint | club_id Depends ? | filter |
|---|---|---|---|---|---|
| `core/config.py:94` | `customer_members` | `find` | get_archived_member_ids | ❌ | variable:q_unconfirmed |
| `core/config.py:103` | `coaches` | `find` | get_archived_coach_ids | ❌ | variable:q_unconfirmed |
| `core/member_categorization.py:121` | `customer_members` | `find` | get_active_members_by_category | ❌ | variable:query_unconfirmed |
| `core/member_categorization.py:125` | `membership_types` | `find` | get_active_members_by_category | ❌ | variable:types_query_unconfirmed |
| `routers/alerts.py:62` | `payments` | `count_documents` | GET /alerts/summary | ❌ | dict_without_club_id |
| `routers/alerts.py:66` | `member_followups` | `count_documents` | GET /alerts/summary | ❌ | dict_without_club_id |
| `routers/alerts.py:71` | `customer_members` | `find` | GET /alerts/summary | ❌ | call:exclude_archived |
| `routers/alerts.py:84` | `customer_members` | `count_documents` | GET /alerts/summary | ❌ | call:exclude_archived |
| `routers/alerts.py:89` | `member_followups` | `count_documents` | GET /alerts/summary | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:60` | `annual_reviews` | `find` | GET  | ✅ | variable:query_unconfirmed |
| `routers/annual_reviews.py:90` | `annual_reviews` | `find` | GET /upcoming | ✅ | variable:q_unconfirmed |
| `routers/annual_reviews.py:235` | `weekly_trainings` | `find` | GET /member-summary/{member_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:246` | `payment_schedules` | `find` | GET /member-summary/{member_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:250` | `payments` | `find` | GET /member-summary/{member_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:258` | `annual_reviews` | `find` | GET /member-summary/{member_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:294` | `annual_reviews` | `find` | GET /history/{member_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:362` | `customer_members` | `find` | POST /auto-generate | ✅ | call:exclude_archived |
| `routers/challenges.py:27` | `six_weeks_challenges` | `find` | GET  | ✅ | variable:query_unconfirmed |
| `routers/challenges.py:36` | `challenge_participants` | `find` | GET /{challenge_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:54` | `weekly_trainings` | `find` | GET /{challenge_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:223` | `customer_members` | `find` | POST /auto-generate-bilans | ✅ | call:exclude_archived |
| `routers/challenges.py:230` | `six_weeks_challenges` | `find` | POST /auto-generate-bilans | ✅ | dict_without_club_id |
| `routers/challenges.py:232` | `challenge_participants` | `find` | POST /auto-generate-bilans | ✅ | dict_without_club_id |
| `routers/clubs.py:16` | `clubs` | `find` | GET  | ❌ | dict_without_club_id |
| `routers/clubs.py:19` | `clubs` | `find` | GET  | ❌ | dict_without_club_id |
| `routers/coaches.py:31` | `coaches` | `find` | GET  | ✅ | variable:query_unconfirmed |
| `routers/coaches.py:148` | `course_kpis` | `find` | GET /{coach_id}/stats | ❌ | variable:query_unconfirmed |
| `routers/coaches.py:182` | `coach_replacements` | `find` | GET /replacements/ | ❌ | variable:query_unconfirmed |
| `routers/courses.py:118` | `course_kpis` | `find` | GET /courses | ✅ | variable:query_unconfirmed |
| `routers/courses.py:482` | `coaches` | `find` | POST /courses/generate-salary-expenses/{year}/{month} | ✅ | call:exclude_archived |
| `routers/followups.py:43` | `member_followups` | `find` | GET  | ✅ | variable:query_unconfirmed |
| `routers/franchise.py:24` | `clubs` | `find` | GET /dashboard | ❌ | dict_without_club_id |
| `routers/franchise.py:43` | `customer_members` | `find` | GET /dashboard | ❌ | dict_without_club_id |
| `routers/franchise.py:141` | `clubs` | `find` | GET /trends | ❌ | dict_without_club_id |
| `routers/franchise.py:150` | `monthly_kpis` | `find` | GET /trends | ❌ | dict_without_club_id |
| `routers/franchise.py:203` | `clubs` | `find` | GET /ad-budgets | ❌ | dict_without_club_id |
| `routers/ghl.py:119` | `customer_members` | `count_documents` | POST /sync | ✅ | dict_without_club_id |
| `routers/ghl.py:120` | `customer_members` | `count_documents` | POST /sync | ✅ | dict_without_club_id |
| `routers/ghl.py:124` | `customer_members` | `count_documents` | POST /sync | ✅ | dict_without_club_id |
| `routers/ghl.py:447` | `ghl_sales` | `find` | GET /sales/{month} | ❌ | dict_without_club_id |
| `routers/kpis.py:32` | `customer_members` | `aggregate` | GET  | ✅ | variable:exit_pipeline_unconfirmed |
| `routers/kpis.py:215` | `customer_members` | `find` | GET /{month}/details | ✅ | variable:bm_q_unconfirmed |
| `routers/kpis.py:299` | `customer_members` | `find` | GET /{month}/details | ✅ | call:exclude_archived |
| `routers/kpis.py:311` | `customer_members` | `find` | GET /{month}/details | ✅ | dict_without_club_id |
| `routers/kpis.py:425` | `customer_members` | `find` | recalculate_month | ❌ | call:exclude_archived |
| `routers/kpis.py:437` | `customer_members` | `find` | recalculate_month | ❌ | dict_without_club_id |
| `routers/kpis.py:452` | `customer_members` | `find` | recalculate_month | ❌ | call:exclude_archived |
| `routers/kpis.py:531` | `customer_members` | `aggregate` | recalculate_month | ❌ | variable:recurring_pipeline_unconfirmed |
| `routers/kpis.py:540` | `accounting_transactions` | `find` | recalculate_month | ❌ | variable:rec_exp_q_unconfirmed |
| `routers/members.py:79` | `customer_members` | `find` | GET  | ✅ | variable:query_unconfirmed |
| `routers/members.py:157` | `customer_members` | `find` | GET /stats | ✅ | variable:query_unconfirmed |
| `routers/members.py:232` | `customer_members` | `distinct` | GET /memberships | ✅ | complex:Constant |
| `routers/members.py:250` | `customer_members` | `find` | GET /expiring | ✅ | variable:query_unconfirmed |
| `routers/members.py:270` | `customer_members` | `find` | _build_categorization_map | ❌ | variable:member_query_unconfirmed |
| `routers/members.py:273` | `membership_types` | `find` | _build_categorization_map | ❌ | variable:types_query_unconfirmed |
| `routers/members.py:429` | `weekly_trainings` | `find` | GET /at-risk | ✅ | dict_without_club_id |
| `routers/members.py:464` | `weekly_trainings` | `aggregate` | GET /at-risk | ✅ | complex:List |
| `routers/members.py:557` | `membership_types` | `find` | GET /{member_id} | ❌ | variable:types_query_unconfirmed |
| `routers/members.py:576` | `weekly_trainings` | `find` | GET /{member_id} | ❌ | dict_without_club_id |
| `routers/members.py:592` | `weekly_trainings` | `find` | GET /{member_id} | ❌ | dict_without_club_id |
| `routers/members.py:1352` | `member_renewals` | `find` | GET /{member_id}/renewals | ❌ | dict_without_club_id |
| `routers/members.py:1413` | `annual_reviews` | `find` | GET /{member_id}/annual-reviews | ❌ | dict_without_club_id |
| `routers/members.py:1420` | `activity_logs` | `find` | GET /{member_id}/activity-log | ❌ | dict_without_club_id |
| `routers/notifications.py:295` | `payments` | `find` | POST /send-bulk | ❌ | dict_without_club_id |
| `routers/notifications.py:321` | `annual_reviews` | `find` | POST /send-bulk | ❌ | dict_without_club_id |
| `routers/notifications.py:359` | `notification_logs` | `find` | GET /logs | ❌ | empty_dict |
| `routers/onboarding.py:32` | `customer_members` | `find` | GET /onboarding/pending | ✅ | call:exclude_archived |
| `routers/onboarding.py:163` | `customer_members` | `find` | GET /onboarding/stats/weekly | ✅ | variable:query_unconfirmed |
| `routers/onboarding.py:220` | `customer_members` | `find` | GET /alerts/summary | ✅ | call:exclude_archived |
| `routers/onboarding.py:234` | `customer_members` | `count_documents` | GET /alerts/summary | ✅ | call:exclude_archived |
| `routers/payments.py:34` | `payment_schedules` | `find` | GET /payment-schedules | ✅ | variable:query_unconfirmed |
| `routers/payments.py:103` | `customer_members` | `find` | POST /payments/sync-with-members | ✅ | call:exclude_archived |
| `routers/payments.py:274` | `payments` | `find` | GET /payments/unified | ✅ | variable:p_query_unconfirmed |
| `routers/payments.py:284` | `customer_members` | `find` | GET /payments/unified | ✅ | dict_without_club_id |
| `routers/payments.py:299` | `accounting_transactions` | `find` | GET /payments/unified | ✅ | variable:at_query_unconfirmed |
| `routers/payments.py:385` | `payments` | `find` | GET /payments | ✅ | variable:query_unconfirmed |
| `routers/payments.py:406` | `customer_members` | `find` | GET /payments | ✅ | dict_without_club_id |
| `routers/payments.py:434` | `payments` | `find` | GET /payments/late | ✅ | variable:q_unconfirmed |
| `routers/payments.py:500` | `payments` | `find` | GET /payments/upcoming | ✅ | variable:q_unconfirmed |
| `routers/payments.py:678` | `customer_members` | `find` | POST /payments/generate/{year}/{month} | ✅ | call:exclude_archived |
| `routers/rollover.py:35` | `customer_members` | `find` | _generate_payments_for_month | ❌ | call:exclude_archived |
| `routers/rollover.py:244` | `clubs` | `find` | run_rollover_all_clubs | ❌ | empty_dict |
| `routers/settings.py:31` | `membership_types` | `find` | GET /membership-types | ✅ | variable:query_unconfirmed |
| `routers/settings.py:87` | `member_types` | `find` | GET /member-types | ✅ | variable:query_unconfirmed |
| `routers/trainings.py:24` | `weekly_trainings` | `find` | GET  | ✅ | variable:query_unconfirmed |
| `routers/trainings.py:58` | `weekly_trainings` | `find` | GET /summary/{member_id} | ❌ | variable:query_unconfirmed |
| `routers/transactions.py:78` | `customer_members` | `count_documents` | _auto_recalculate_kpis | ❌ | dict_without_club_id |
| `routers/transactions.py:119` | `accounting_transactions` | `find` | GET /transactions | ✅ | variable:query_unconfirmed |
| `routers/transactions.py:445` | `customer_members` | `find` | GET /recurring-transactions/all | ✅ | variable:bm_q_unconfirmed |
| `routers/transactions.py:672` | `accounting_transactions` | `aggregate` | GET /transactions/monthly-grid | ✅ | variable:pipeline_unconfirmed |
| `services/billing_audit.py:47` | `membership_types` | `find` | run_billing_audit | ❌ | empty_dict |

## 3. 🟡 MOYEN_DOC_WRONG (priorité 3)

| Fichier:ligne | Coll | Op | Endpoint | club_id Depends ? | filter |
|---|---|---|---|---|---|
| `core/activity_log.py:51` | `customer_members` | `find_one` | log_activity | ❌ | dict_without_club_id |
| `core/club_branding.py:30` | `clubs` | `find_one` | get_club_public_name | ❌ | dict_without_club_id |
| `core/config.py:73` | `customer_members` | `find_one` | check_member_not_archived | ❌ | dict_without_club_id |
| `core/config.py:80` | `customer_members` | `find_one` | get_member_archived_warning | ❌ | dict_without_club_id |
| `core/security.py:45` | `users` | `find_one` | get_current_user | ❌ | dict_without_club_id |
| `routers/alerts.py:42` | `payments` | `update_one` | POST /notifications/send-reminder | ❌ | dict_without_club_id |
| `routers/alerts.py:47` | `member_followups` | `update_one` | POST /notifications/send-reminder | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:67` | `customer_members` | `find_one` | GET  | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:97` | `customer_members` | `find_one` | GET /upcoming | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:165` | `customer_members` | `find_one` | GET /overdue | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:210` | `customer_members` | `find_one` | GET /dashboard-alerts | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:230` | `customer_members` | `find_one` | GET /member-summary/{member_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:298` | `customer_members` | `find_one` | GET /history/{member_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:308` | `annual_reviews` | `find_one` | GET /{review_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:311` | `customer_members` | `find_one` | GET /{review_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:415` | `annual_reviews` | `find_one` | POST /auto-generate | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:425` | `annual_reviews` | `find_one` | POST /auto-generate | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:461` | `customer_members` | `update_one` | POST /auto-generate | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:477` | `annual_reviews` | `find_one` | PUT /{review_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:482` | `annual_reviews` | `update_one` | PUT /{review_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:483` | `annual_reviews` | `find_one` | PUT /{review_id} | ❌ | dict_without_club_id |
| `routers/annual_reviews.py:494` | `annual_reviews` | `find_one` | POST /{review_id}/complete | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:510` | `annual_reviews` | `update_one` | POST /{review_id}/complete | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:522` | `customer_members` | `update_one` | POST /{review_id}/complete | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:552` | `customer_members` | `update_one` | POST /{review_id}/complete | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:557` | `annual_reviews` | `find_one` | POST /{review_id}/complete | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:568` | `annual_reviews` | `find_one` | POST /{review_id}/skip | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:577` | `annual_reviews` | `update_one` | POST /{review_id}/skip | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:599` | `customer_members` | `find_one` | POST /{review_id}/skip | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:621` | `customer_members` | `update_one` | POST /{review_id}/skip | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:626` | `annual_reviews` | `find_one` | POST /{review_id}/skip | ✅ | dict_without_club_id |
| `routers/annual_reviews.py:631` | `annual_reviews` | `delete_one` | DELETE /{review_id} | ❌ | dict_without_club_id |
| `routers/auth.py:16` | `users` | `find_one` | POST /register | ❌ | dict_without_club_id |
| `routers/auth.py:22` | `clubs` | `find_one` | POST /register | ❌ | dict_without_club_id |
| `routers/auth.py:52` | `users` | `find_one` | POST /login | ❌ | dict_without_club_id |
| `routers/auth.py:79` | `users` | `update_one` | PUT /club-name | ❌ | dict_without_club_id |
| `routers/challenges.py:32` | `six_weeks_challenges` | `find_one` | GET /{challenge_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:103` | `six_weeks_challenges` | `find_one` | PUT /{challenge_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:107` | `six_weeks_challenges` | `update_one` | PUT /{challenge_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:110` | `six_weeks_challenges` | `find_one` | PUT /{challenge_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:115` | `six_weeks_challenges` | `delete_one` | DELETE /{challenge_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:129` | `six_weeks_challenges` | `find_one` | POST /{challenge_id}/participants | ✅ | dict_without_club_id |
| `routers/challenges.py:136` | `challenge_participants` | `find_one` | POST /{challenge_id}/participants | ✅ | dict_without_club_id |
| `routers/challenges.py:169` | `customer_members` | `find_one` | POST /{challenge_id}/participants | ✅ | dict_without_club_id |
| `routers/challenges.py:174` | `annual_reviews` | `find_one` | POST /{challenge_id}/participants | ✅ | dict_without_club_id |
| `routers/challenges.py:192` | `customer_members` | `update_one` | POST /{challenge_id}/participants | ✅ | dict_without_club_id |
| `routers/challenges.py:248` | `annual_reviews` | `find_one` | POST /auto-generate-bilans | ✅ | dict_without_club_id |
| `routers/challenges.py:272` | `challenge_participants` | `find_one` | PUT /{challenge_id}/participants/{participant_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:297` | `challenge_participants` | `update_one` | PUT /{challenge_id}/participants/{participant_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:298` | `challenge_participants` | `find_one` | PUT /{challenge_id}/participants/{participant_id} | ❌ | dict_without_club_id |
| `routers/challenges.py:303` | `challenge_participants` | `delete_one` | DELETE /{challenge_id}/participants/{participant_id} | ❌ | dict_without_club_id |
| `routers/clubs.py:34` | `clubs` | `find_one` | POST  | ❌ | dict_without_club_id |
| `routers/clubs.py:44` | `users` | `update_one` | POST  | ❌ | dict_without_club_id |
| `routers/clubs.py:64` | `clubs` | `find_one` | PUT /switch | ❌ | dict_without_club_id |
| `routers/clubs.py:68` | `users` | `update_one` | PUT /switch | ❌ | dict_without_club_id |
| `routers/coaches.py:37` | `coaches` | `find_one` | GET /{coach_id} | ❌ | dict_without_club_id |
| `routers/coaches.py:59` | `coaches` | `find_one` | PUT /{coach_id} | ❌ | dict_without_club_id |
| `routers/coaches.py:78` | `coaches` | `update_one` | PUT /{coach_id} | ❌ | dict_without_club_id |
| `routers/coaches.py:79` | `coaches` | `find_one` | PUT /{coach_id} | ❌ | dict_without_club_id |
| `routers/coaches.py:87` | `coaches` | `find_one` | DELETE /{coach_id} | ❌ | dict_without_club_id |
| `routers/coaches.py:95` | `coaches` | `update_one` | DELETE /{coach_id} | ❌ | dict_without_club_id |
| `routers/coaches.py:104` | `coaches` | `find_one` | POST /{coach_id}/archive | ❌ | dict_without_club_id |
| `routers/coaches.py:114` | `coaches` | `update_one` | POST /{coach_id}/archive | ❌ | dict_without_club_id |
| `routers/coaches.py:115` | `coaches` | `find_one` | POST /{coach_id}/archive | ❌ | dict_without_club_id |
| `routers/coaches.py:120` | `coaches` | `find_one` | POST /{coach_id}/restore | ❌ | dict_without_club_id |
| `routers/coaches.py:126` | `coaches` | `update_one` | POST /{coach_id}/restore | ❌ | dict_without_club_id |
| `routers/coaches.py:130` | `coaches` | `find_one` | POST /{coach_id}/restore | ❌ | dict_without_club_id |
| `routers/coaches.py:136` | `coaches` | `find_one` | GET /{coach_id}/stats | ❌ | dict_without_club_id |
| `routers/coaches.py:186` | `coaches` | `find_one` | GET /replacements/ | ❌ | dict_without_club_id |
| `routers/coaches.py:187` | `coaches` | `find_one` | GET /replacements/ | ❌ | dict_without_club_id |
| `routers/coaches.py:209` | `coaches` | `find_one` | POST /replacements/ | ✅ | dict_without_club_id |
| `routers/courses.py:151` | `course_types` | `find_one` | PUT /course-types/{type_id} | ✅ | dict_without_club_id |
| `routers/courses.py:165` | `course_types` | `update_one` | PUT /course-types/{type_id} | ✅ | dict_without_club_id |
| `routers/courses.py:180` | `course_kpis` | `find_one` | GET /courses/{course_id} | ❌ | dict_without_club_id |
| `routers/courses.py:216` | `course_kpis` | `find_one` | PUT /courses/{course_id} | ❌ | dict_without_club_id |
| `routers/courses.py:228` | `course_kpis` | `update_one` | PUT /courses/{course_id} | ❌ | dict_without_club_id |
| `routers/courses.py:229` | `course_kpis` | `find_one` | PUT /courses/{course_id} | ❌ | dict_without_club_id |
| `routers/courses.py:234` | `course_kpis` | `delete_one` | DELETE /courses/{course_id} | ❌ | dict_without_club_id |
| `routers/courses.py:434` | `course_kpis` | `update_one` | POST /courses/copy-month | ✅ | dict_without_club_id |
| `routers/courses.py:523` | `accounting_categories` | `find_one` | POST /courses/generate-salary-expenses/{year}/{month} | ✅ | dict_without_club_id |
| `routers/followups.py:65` | `customer_members` | `find_one` | GET /upcoming | ✅ | dict_without_club_id |
| `routers/followups.py:88` | `member_followups` | `update_one` | GET /missed | ✅ | dict_without_club_id |
| `routers/followups.py:95` | `customer_members` | `find_one` | GET /missed | ✅ | dict_without_club_id |
| `routers/followups.py:118` | `member_followups` | `find_one` | PUT /{followup_id} | ❌ | dict_without_club_id |
| `routers/followups.py:123` | `member_followups` | `update_one` | PUT /{followup_id} | ❌ | dict_without_club_id |
| `routers/followups.py:124` | `member_followups` | `find_one` | PUT /{followup_id} | ❌ | dict_without_club_id |
| `routers/followups.py:130` | `member_followups` | `find_one` | POST /{followup_id}/complete | ❌ | dict_without_club_id |
| `routers/followups.py:151` | `customer_members` | `update_one` | POST /{followup_id}/complete | ❌ | dict_without_club_id |
| `routers/followups.py:160` | `member_followups` | `update_one` | POST /{followup_id}/complete | ❌ | dict_without_club_id |
| `routers/followups.py:161` | `member_followups` | `find_one` | POST /{followup_id}/complete | ❌ | dict_without_club_id |
| `routers/followups.py:166` | `member_followups` | `delete_one` | DELETE /{followup_id} | ❌ | dict_without_club_id |
| `routers/ghl.py:189` | `ghl_syncs` | `find_one` | GET /last-sync | ❌ | dict_without_club_id |
| `routers/ghl.py:264` | `ghl_sales` | `find_one` | POST /confirm-sale | ✅ | dict_without_club_id |
| `routers/ghl.py:294` | `customer_members` | `find_one` | POST /confirm-sale | ✅ | dict_without_club_id |
| `routers/ghl.py:304` | `customer_members` | `update_one` | POST /confirm-sale | ✅ | dict_without_club_id |
| `routers/ghl.py:369` | `six_weeks_challenges` | `find_one` | POST /confirm-sale | ✅ | dict_without_club_id |
| `routers/ghl.py:371` | `challenge_participants` | `find_one` | POST /confirm-sale | ✅ | dict_without_club_id |
| `routers/ghl.py:404` | `accounting_categories` | `find_one` | POST /confirm-sale | ✅ | dict_without_club_id |
| `routers/ghl.py:419` | `accounting_transactions` | `find_one` | POST /confirm-sale | ✅ | dict_without_club_id |
| `routers/ghl.py:430` | `monthly_kpis` | `find_one` | POST /confirm-sale | ✅ | dict_without_club_id |
| `routers/ghl.py:433` | `monthly_kpis` | `update_one` | POST /confirm-sale | ✅ | dict_without_club_id |
| `routers/marketing.py:84` | `customer_members` | `find_one` | GET /unsubscribe | ❌ | dict_without_club_id |
| `routers/marketing.py:104` | `customer_members` | `update_one` | GET /unsubscribe | ❌ | dict_without_club_id |
| `routers/members.py:306` | `customer_members` | `find_one` | GET /categories | ✅ | dict_without_club_id |
| `routers/members.py:524` | `customer_members` | `find_one` | GET /{member_id} | ❌ | dict_without_club_id |
| `routers/members.py:529` | `customer_members` | `find_one` | GET /{member_id} | ❌ | dict_without_club_id |
| `routers/members.py:637` | `customer_members` | `find_one` | PUT /{member_id}/pause | ❌ | dict_without_club_id |
| `routers/members.py:668` | `customer_members` | `update_one` | PUT /{member_id}/pause | ❌ | dict_without_club_id |
| `routers/members.py:669` | `customer_members` | `find_one` | PUT /{member_id}/pause | ❌ | dict_without_club_id |
| `routers/members.py:678` | `customer_members` | `find_one` | DELETE /{member_id}/pause | ❌ | dict_without_club_id |
| `routers/members.py:681` | `customer_members` | `update_one` | DELETE /{member_id}/pause | ❌ | dict_without_club_id |
| `routers/members.py:782` | `customer_members` | `update_one` | POST  | ✅ | dict_without_club_id |
| `routers/members.py:792` | `six_weeks_challenges` | `find_one` | POST  | ✅ | dict_without_club_id |
| `routers/members.py:795` | `challenge_participants` | `find_one` | POST  | ✅ | dict_without_club_id |
| `routers/members.py:809` | `accounting_categories` | `find_one` | POST  | ✅ | dict_without_club_id |
| `routers/members.py:822` | `accounting_transactions` | `find_one` | POST  | ✅ | dict_without_club_id |
| `routers/members.py:850` | `customer_members` | `find_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:872` | `customer_members` | `update_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:904` | `annual_reviews` | `find_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:930` | `customer_members` | `update_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:960` | `customer_members` | `update_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:965` | `payment_schedules` | `find_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:1025` | `payment_schedules` | `update_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:1038` | `payment_schedules` | `update_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:1054` | `payments` | `find_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:1112` | `customer_members` | `find_one` | PUT /{member_id} | ✅ | dict_without_club_id |
| `routers/members.py:1119` | `customer_members` | `find_one` | POST /{member_id}/dissociate-duo | ❌ | dict_without_club_id |
| `routers/members.py:1135` | `customer_members` | `update_one` | POST /{member_id}/dissociate-duo | ❌ | dict_without_club_id |
| `routers/members.py:1139` | `customer_members` | `update_one` | POST /{member_id}/dissociate-duo | ❌ | dict_without_club_id |
| `routers/members.py:1141` | `customer_members` | `update_one` | POST /{member_id}/dissociate-duo | ❌ | dict_without_club_id |
| `routers/members.py:1157` | `customer_members` | `find_one` | DELETE /{member_id} | ❌ | dict_without_club_id |
| `routers/members.py:1164` | `customer_members` | `update_one` | DELETE /{member_id} | ❌ | dict_without_club_id |
| `routers/members.py:1177` | `customer_members` | `find_one` | POST /{member_id}/archive | ❌ | dict_without_club_id |
| `routers/members.py:1187` | `customer_members` | `update_one` | POST /{member_id}/archive | ❌ | dict_without_club_id |
| `routers/members.py:1195` | `customer_members` | `find_one` | POST /{member_id}/archive | ❌ | dict_without_club_id |
| `routers/members.py:1204` | `customer_members` | `find_one` | POST /{member_id}/restore | ❌ | dict_without_club_id |
| `routers/members.py:1210` | `customer_members` | `update_one` | POST /{member_id}/restore | ❌ | dict_without_club_id |
| `routers/members.py:1221` | `customer_members` | `find_one` | POST /{member_id}/restore | ❌ | dict_without_club_id |
| `routers/members.py:1232` | `customer_members` | `find_one` | POST /{member_id}/renew | ✅ | dict_without_club_id |
| `routers/members.py:1278` | `six_weeks_challenges` | `find_one` | POST /{member_id}/renew | ✅ | dict_without_club_id |
| `routers/members.py:1280` | `challenge_participants` | `find_one` | POST /{member_id}/renew | ✅ | dict_without_club_id |
| `routers/members.py:1323` | `customer_members` | `update_one` | POST /{member_id}/renew | ✅ | dict_without_club_id |
| `routers/members.py:1327` | `payment_schedules` | `find_one` | POST /{member_id}/renew | ✅ | dict_without_club_id |
| `routers/members.py:1338` | `payment_schedules` | `update_one` | POST /{member_id}/renew | ✅ | dict_without_club_id |
| `routers/members.py:1346` | `customer_members` | `find_one` | POST /{member_id}/renew | ✅ | dict_without_club_id |
| `routers/members.py:1365` | `customer_members` | `find_one` | PUT /{member_id}/onboarding | ❌ | dict_without_club_id |
| `routers/members.py:1406` | `customer_members` | `update_one` | PUT /{member_id}/onboarding | ❌ | dict_without_club_id |
| `routers/members.py:1407` | `customer_members` | `find_one` | PUT /{member_id}/onboarding | ❌ | dict_without_club_id |
| `routers/members.py:1570` | `customer_members` | `update_one` | POST /bulk-renewal-reminder | ✅ | dict_without_club_id |
| `routers/notifications.py:154` | `club_settings` | `find_one` | get_club_name | ❌ | dict_without_club_id |
| `routers/notifications.py:179` | `payments` | `update_one` | POST /send-email | ❌ | dict_without_club_id |
| `routers/notifications.py:184` | `member_followups` | `update_one` | POST /send-email | ❌ | dict_without_club_id |
| `routers/notifications.py:205` | `payments` | `find_one` | POST /send-payment-reminder/{payment_id} | ❌ | dict_without_club_id |
| `routers/notifications.py:209` | `customer_members` | `find_one` | POST /send-payment-reminder/{payment_id} | ❌ | dict_without_club_id |
| `routers/notifications.py:223` | `payments` | `update_one` | POST /send-payment-reminder/{payment_id} | ❌ | dict_without_club_id |
| `routers/notifications.py:243` | `annual_reviews` | `find_one` | POST /send-review-reminder/{review_id} | ❌ | dict_without_club_id |
| `routers/notifications.py:247` | `customer_members` | `find_one` | POST /send-review-reminder/{review_id} | ❌ | dict_without_club_id |
| `routers/notifications.py:255` | `settings` | `find_one` | POST /send-review-reminder/{review_id} | ❌ | empty_dict |
| `routers/notifications.py:305` | `customer_members` | `find_one` | POST /send-bulk | ❌ | dict_without_club_id |
| `routers/notifications.py:312` | `payments` | `update_one` | POST /send-bulk | ❌ | dict_without_club_id |
| `routers/notifications.py:333` | `customer_members` | `find_one` | POST /send-bulk | ❌ | dict_without_club_id |
| `routers/onboarding.py:73` | `customer_members` | `find_one` | POST /onboarding/{member_id}/skip | ❌ | dict_without_club_id |
| `routers/onboarding.py:77` | `customer_members` | `update_one` | POST /onboarding/{member_id}/skip | ❌ | dict_without_club_id |
| `routers/payments.py:38` | `customer_members` | `find_one` | GET /payment-schedules | ✅ | dict_without_club_id |
| `routers/payments.py:64` | `payment_schedules` | `find_one` | PUT /payment-schedules/{schedule_id} | ❌ | dict_without_club_id |
| `routers/payments.py:69` | `payment_schedules` | `update_one` | PUT /payment-schedules/{schedule_id} | ❌ | dict_without_club_id |
| `routers/payments.py:70` | `payment_schedules` | `find_one` | PUT /payment-schedules/{schedule_id} | ❌ | dict_without_club_id |
| `routers/payments.py:75` | `payment_schedules` | `delete_one` | DELETE /payment-schedules/{schedule_id} | ❌ | dict_without_club_id |
| `routers/payments.py:395` | `customer_members` | `find_one` | GET /payments | ✅ | dict_without_club_id |
| `routers/payments.py:416` | `payments` | `update_one` | GET /payments | ✅ | dict_without_club_id |
| `routers/payments.py:443` | `customer_members` | `find_one` | GET /payments/late | ✅ | dict_without_club_id |
| `routers/payments.py:470` | `payments` | `update_one` | GET /payments/late | ✅ | dict_without_club_id |
| `routers/payments.py:477` | `payments` | `update_one` | GET /payments/late | ✅ | dict_without_club_id |
| `routers/payments.py:507` | `customer_members` | `find_one` | GET /payments/upcoming | ✅ | dict_without_club_id |
| `routers/payments.py:536` | `payments` | `find_one` | PUT /payments/{payment_id} | ❌ | dict_without_club_id |
| `routers/payments.py:543` | `payments` | `update_one` | PUT /payments/{payment_id} | ❌ | dict_without_club_id |
| `routers/payments.py:544` | `payments` | `find_one` | PUT /payments/{payment_id} | ❌ | dict_without_club_id |
| `routers/payments.py:555` | `payments` | `find_one` | POST /payments/{payment_id}/mark-paid | ✅ | dict_without_club_id |
| `routers/payments.py:569` | `payments` | `update_one` | POST /payments/{payment_id}/mark-paid | ✅ | dict_without_club_id |
| `routers/payments.py:572` | `customer_members` | `find_one` | POST /payments/{payment_id}/mark-paid | ✅ | dict_without_club_id |
| `routers/payments.py:613` | `payments` | `find_one` | POST /payments/{payment_id}/mark-paid | ✅ | dict_without_club_id |
| `routers/payments.py:623` | `payments` | `delete_one` | DELETE /payments/{payment_id} | ❌ | dict_without_club_id |
| `routers/payments.py:632` | `payments` | `find_one` | POST /payments/{payment_id}/revert-to-unpaid | ❌ | dict_without_club_id |
| `routers/payments.py:642` | `payments` | `update_one` | POST /payments/{payment_id}/revert-to-unpaid | ❌ | dict_without_club_id |
| `routers/payments.py:646` | `payments` | `find_one` | POST /payments/{payment_id}/revert-to-unpaid | ❌ | dict_without_club_id |
| `routers/payments.py:700` | `payments` | `find_one` | POST /payments/generate/{year}/{month} | ✅ | dict_without_club_id |
| `routers/reports.py:36` | `club_settings` | `find_one` | GET /report/pdf/{month} | ✅ | complex:BoolOp |
| `routers/rollover.py:50` | `payments` | `find_one` | _generate_payments_for_month | ❌ | dict_without_club_id |
| `routers/settings.py:37` | `membership_types` | `find_one` | GET /membership-types/{type_id} | ❌ | dict_without_club_id |
| `routers/settings.py:60` | `membership_types` | `find_one` | PUT /membership-types/{type_id} | ❌ | dict_without_club_id |
| `routers/settings.py:67` | `membership_types` | `update_one` | PUT /membership-types/{type_id} | ❌ | dict_without_club_id |
| `routers/settings.py:68` | `membership_types` | `find_one` | PUT /membership-types/{type_id} | ❌ | dict_without_club_id |
| `routers/settings.py:73` | `membership_types` | `delete_one` | DELETE /membership-types/{type_id} | ❌ | dict_without_club_id |
| `routers/settings.py:93` | `member_types` | `find_one` | GET /member-types/{type_id} | ❌ | dict_without_club_id |
| `routers/settings.py:116` | `member_types` | `find_one` | PUT /member-types/{type_id} | ❌ | dict_without_club_id |
| `routers/settings.py:123` | `member_types` | `update_one` | PUT /member-types/{type_id} | ❌ | dict_without_club_id |
| `routers/settings.py:124` | `member_types` | `find_one` | PUT /member-types/{type_id} | ❌ | dict_without_club_id |
| `routers/settings.py:129` | `member_types` | `delete_one` | DELETE /member-types/{type_id} | ❌ | dict_without_club_id |
| `routers/trainings.py:29` | `weekly_trainings` | `find_one` | POST  | ✅ | dict_without_club_id |
| `routers/trainings.py:38` | `weekly_trainings` | `update_one` | POST  | ✅ | dict_without_club_id |
| `routers/trainings.py:42` | `weekly_trainings` | `find_one` | POST  | ✅ | dict_without_club_id |
| `routers/transactions.py:128` | `excluded_recurring_expenses` | `find_one` | POST /transactions | ✅ | dict_without_club_id |
| `routers/transactions.py:169` | `recurring_transactions` | `find_one` | POST /transactions | ✅ | dict_without_club_id |
| `routers/transactions.py:209` | `accounting_transactions` | `find_one` | PUT /transactions/{transaction_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:229` | `accounting_transactions` | `update_one` | PUT /transactions/{transaction_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:243` | `recurring_transactions` | `find_one` | PUT /transactions/{transaction_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:255` | `recurring_transactions` | `delete_one` | PUT /transactions/{transaction_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:263` | `accounting_transactions` | `find_one` | PUT /transactions/{transaction_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:274` | `accounting_transactions` | `find_one` | DELETE /transactions/{transaction_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:278` | `recurring_transactions` | `find_one` | DELETE /transactions/{transaction_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:299` | `accounting_transactions` | `delete_one` | DELETE /transactions/{transaction_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:316` | `excluded_recurring_expenses` | `find_one` | POST /transactions/bulk | ✅ | dict_without_club_id |
| `routers/transactions.py:357` | `accounting_categories` | `delete_one` | DELETE /categories/{category_id} | ❌ | dict_without_club_id |
| `routers/transactions.py:366` | `accounting_categories` | `update_one` | PUT /categories/{category_id} | ❌ | dict_without_club_id |
| `routers/transactions.py:371` | `accounting_categories` | `find_one` | PUT /categories/{category_id} | ❌ | dict_without_club_id |
| `routers/transactions.py:390` | `excluded_recurring_expenses` | `find_one` | DELETE /excluded/{excluded_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:413` | `excluded_recurring_expenses` | `delete_one` | DELETE /excluded/{excluded_id} | ✅ | dict_without_club_id |
| `routers/transactions.py:508` | `recurring_transactions` | `find_one` | PUT /recurring-transactions/{rec_id} | ❌ | dict_without_club_id |
| `routers/transactions.py:512` | `recurring_transactions` | `update_one` | PUT /recurring-transactions/{rec_id} | ❌ | dict_without_club_id |
| `routers/transactions.py:513` | `recurring_transactions` | `find_one` | PUT /recurring-transactions/{rec_id} | ❌ | dict_without_club_id |
| `routers/transactions.py:518` | `recurring_transactions` | `delete_one` | DELETE /recurring-transactions/{rec_id} | ❌ | dict_without_club_id |
| `routers/transactions.py:605` | `recurring_validations` | `find_one` | POST /recurring-validations | ✅ | dict_without_club_id |
| `routers/transactions.py:611` | `recurring_transactions` | `find_one` | POST /recurring-validations | ✅ | dict_without_club_id |
| `routers/transactions.py:640` | `recurring_validations` | `delete_one` | DELETE /recurring-validations/{validation_id} | ❌ | dict_without_club_id |
| `routers/transactions.py:741` | `accounting_transactions` | `update_one` | PUT /transactions/update-monthly-amount | ✅ | dict_without_club_id |
| `routers/transactions.py:779` | `accounting_transactions` | `update_one` | PUT /transactions/update-monthly-amount | ✅ | dict_without_club_id |
| `services/meta.py:144` | `monthly_kpis` | `find_one` | sync_meta_ad_spend_to_kpis | ❌ | variable:query_unconfirmed |
| `services/meta.py:146` | `monthly_kpis` | `update_one` | sync_meta_ad_spend_to_kpis | ❌ | variable:query_unconfirmed |

## 4. Recommandations patch (regroupé par fichier)

### `core/activity_log.py` — 🔴0 🟠0 🟡1
- 🟡 L51 `customer_members.find_one` (dict_without_club_id) — endpoint: log_activity

### `core/club_branding.py` — 🔴0 🟠0 🟡1
- 🟡 L30 `clubs.find_one` (dict_without_club_id) — endpoint: get_club_public_name

### `core/config.py` — 🔴0 🟠2 🟡2
- 🟡 L73 `customer_members.find_one` (dict_without_club_id) — endpoint: check_member_not_archived
- 🟡 L80 `customer_members.find_one` (dict_without_club_id) — endpoint: get_member_archived_warning
- 🟠 L94 `customer_members.find` (variable:q_unconfirmed) — endpoint: get_archived_member_ids
- 🟠 L103 `coaches.find` (variable:q_unconfirmed) — endpoint: get_archived_coach_ids

### `core/member_categorization.py` — 🔴0 🟠2 🟡0
- 🟠 L121 `customer_members.find` (variable:query_unconfirmed) — endpoint: get_active_members_by_category
- 🟠 L125 `membership_types.find` (variable:types_query_unconfirmed) — endpoint: get_active_members_by_category

### `core/security.py` — 🔴0 🟠0 🟡1
- 🟡 L45 `users.find_one` (dict_without_club_id) — endpoint: get_current_user

### `routers/alerts.py` — 🔴0 🟠5 🟡2
- 🟠 L62 `payments.count_documents` (dict_without_club_id) — endpoint: GET /alerts/summary
- 🟠 L66 `member_followups.count_documents` (dict_without_club_id) — endpoint: GET /alerts/summary
- 🟠 L84 `customer_members.count_documents` (call:exclude_archived) — endpoint: GET /alerts/summary
- 🟠 L89 `member_followups.count_documents` (dict_without_club_id) — endpoint: GET /alerts/summary
- 🟡 L42 `payments.update_one` (dict_without_club_id) — endpoint: POST /notifications/send-reminder
- 🟠 L71 `customer_members.find` (call:exclude_archived) — endpoint: GET /alerts/summary
- 🟡 L47 `member_followups.update_one` (dict_without_club_id) — endpoint: POST /notifications/send-reminder

### `routers/annual_reviews.py` — 🔴0 🟠8 🟡25
- 🟡 L230 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /member-summary/{member_id}
- 🟡 L298 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /history/{member_id}
- 🟡 L308 `annual_reviews.find_one` (dict_without_club_id) — endpoint: GET /{review_id}
- 🟡 L311 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /{review_id}
- 🟡 L477 `annual_reviews.find_one` (dict_without_club_id) — endpoint: PUT /{review_id}
- 🟡 L482 `annual_reviews.update_one` (dict_without_club_id) — endpoint: PUT /{review_id}
- 🟡 L483 `annual_reviews.find_one` (dict_without_club_id) — endpoint: PUT /{review_id}
- 🟡 L494 `annual_reviews.find_one` (dict_without_club_id) — endpoint: POST /{review_id}/complete
- 🟡 L510 `annual_reviews.update_one` (dict_without_club_id) — endpoint: POST /{review_id}/complete
- 🟡 L522 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{review_id}/complete
- 🟡 L557 `annual_reviews.find_one` (dict_without_club_id) — endpoint: POST /{review_id}/complete
- 🟡 L568 `annual_reviews.find_one` (dict_without_club_id) — endpoint: POST /{review_id}/skip
- 🟡 L577 `annual_reviews.update_one` (dict_without_club_id) — endpoint: POST /{review_id}/skip
- 🟡 L599 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /{review_id}/skip
- 🟡 L621 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{review_id}/skip
- 🟡 L626 `annual_reviews.find_one` (dict_without_club_id) — endpoint: POST /{review_id}/skip
- 🟡 L631 `annual_reviews.delete_one` (dict_without_club_id) — endpoint: DELETE /{review_id}
- 🟡 L67 `customer_members.find_one` (dict_without_club_id) — endpoint: GET 
- 🟡 L97 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /upcoming
- 🟡 L165 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /overdue
- 🟡 L210 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /dashboard-alerts
- 🟡 L415 `annual_reviews.find_one` (dict_without_club_id) — endpoint: POST /auto-generate
- 🟡 L425 `annual_reviews.find_one` (dict_without_club_id) — endpoint: POST /auto-generate
- 🟡 L461 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /auto-generate
- 🟡 L552 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{review_id}/complete
- 🟠 L246 `payment_schedules.find` (dict_without_club_id) — endpoint: GET /member-summary/{member_id}
- 🟠 L362 `customer_members.find` (call:exclude_archived) — endpoint: POST /auto-generate
- 🟠 L60 `annual_reviews.find` (variable:query_unconfirmed) — endpoint: GET 
- 🟠 L90 `annual_reviews.find` (variable:q_unconfirmed) — endpoint: GET /upcoming
- 🟠 L235 `weekly_trainings.find` (dict_without_club_id) — endpoint: GET /member-summary/{member_id}
- 🟠 L250 `payments.find` (dict_without_club_id) — endpoint: GET /member-summary/{member_id}
- 🟠 L258 `annual_reviews.find` (dict_without_club_id) — endpoint: GET /member-summary/{member_id}
- 🟠 L294 `annual_reviews.find` (dict_without_club_id) — endpoint: GET /history/{member_id}

### `routers/auth.py` — 🔴0 🟠0 🟡4
- 🟡 L16 `users.find_one` (dict_without_club_id) — endpoint: POST /register
- 🟡 L22 `clubs.find_one` (dict_without_club_id) — endpoint: POST /register
- 🟡 L52 `users.find_one` (dict_without_club_id) — endpoint: POST /login
- 🟡 L79 `users.update_one` (dict_without_club_id) — endpoint: PUT /club-name

### `routers/challenges.py` — 🔴1 🟠6 🟡15
- 🟡 L32 `six_weeks_challenges.find_one` (dict_without_club_id) — endpoint: GET /{challenge_id}
- 🟡 L103 `six_weeks_challenges.find_one` (dict_without_club_id) — endpoint: PUT /{challenge_id}
- 🟡 L107 `six_weeks_challenges.update_one` (dict_without_club_id) — endpoint: PUT /{challenge_id}
- 🟡 L110 `six_weeks_challenges.find_one` (dict_without_club_id) — endpoint: PUT /{challenge_id}
- 🟡 L115 `six_weeks_challenges.delete_one` (dict_without_club_id) — endpoint: DELETE /{challenge_id}
- 🔴 L118 `challenge_participants.delete_many` (dict_without_club_id) — endpoint: DELETE /{challenge_id}
- 🟡 L129 `six_weeks_challenges.find_one` (dict_without_club_id) — endpoint: POST /{challenge_id}/participants
- 🟡 L136 `challenge_participants.find_one` (dict_without_club_id) — endpoint: POST /{challenge_id}/participants
- 🟡 L169 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /{challenge_id}/participants
- 🟡 L192 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{challenge_id}/participants
- 🟡 L272 `challenge_participants.find_one` (dict_without_club_id) — endpoint: PUT /{challenge_id}/participants/{participant_id}
- 🟡 L297 `challenge_participants.update_one` (dict_without_club_id) — endpoint: PUT /{challenge_id}/participants/{participant_id}
- 🟡 L298 `challenge_participants.find_one` (dict_without_club_id) — endpoint: PUT /{challenge_id}/participants/{participant_id}
- 🟡 L303 `challenge_participants.delete_one` (dict_without_club_id) — endpoint: DELETE /{challenge_id}/participants/{participant_id}
- 🟡 L174 `annual_reviews.find_one` (dict_without_club_id) — endpoint: POST /{challenge_id}/participants
- 🟡 L248 `annual_reviews.find_one` (dict_without_club_id) — endpoint: POST /auto-generate-bilans
- 🟠 L36 `challenge_participants.find` (dict_without_club_id) — endpoint: GET /{challenge_id}
- 🟠 L223 `customer_members.find` (call:exclude_archived) — endpoint: POST /auto-generate-bilans
- 🟠 L230 `six_weeks_challenges.find` (dict_without_club_id) — endpoint: POST /auto-generate-bilans
- 🟠 L232 `challenge_participants.find` (dict_without_club_id) — endpoint: POST /auto-generate-bilans
- 🟠 L27 `six_weeks_challenges.find` (variable:query_unconfirmed) — endpoint: GET 
- 🟠 L54 `weekly_trainings.find` (dict_without_club_id) — endpoint: GET /{challenge_id}

### `routers/clubs.py` — 🔴0 🟠2 🟡4
- 🟡 L34 `clubs.find_one` (dict_without_club_id) — endpoint: POST 
- 🟡 L44 `users.update_one` (dict_without_club_id) — endpoint: POST 
- 🟡 L64 `clubs.find_one` (dict_without_club_id) — endpoint: PUT /switch
- 🟡 L68 `users.update_one` (dict_without_club_id) — endpoint: PUT /switch
- 🟠 L16 `clubs.find` (dict_without_club_id) — endpoint: GET 
- 🟠 L19 `clubs.find` (dict_without_club_id) — endpoint: GET 

### `routers/coaches.py` — 🔴0 🟠3 🟡16
- 🟡 L37 `coaches.find_one` (dict_without_club_id) — endpoint: GET /{coach_id}
- 🟡 L59 `coaches.find_one` (dict_without_club_id) — endpoint: PUT /{coach_id}
- 🟡 L78 `coaches.update_one` (dict_without_club_id) — endpoint: PUT /{coach_id}
- 🟡 L79 `coaches.find_one` (dict_without_club_id) — endpoint: PUT /{coach_id}
- 🟡 L87 `coaches.find_one` (dict_without_club_id) — endpoint: DELETE /{coach_id}
- 🟡 L95 `coaches.update_one` (dict_without_club_id) — endpoint: DELETE /{coach_id}
- 🟡 L104 `coaches.find_one` (dict_without_club_id) — endpoint: POST /{coach_id}/archive
- 🟡 L114 `coaches.update_one` (dict_without_club_id) — endpoint: POST /{coach_id}/archive
- 🟡 L115 `coaches.find_one` (dict_without_club_id) — endpoint: POST /{coach_id}/archive
- 🟡 L120 `coaches.find_one` (dict_without_club_id) — endpoint: POST /{coach_id}/restore
- 🟡 L126 `coaches.update_one` (dict_without_club_id) — endpoint: POST /{coach_id}/restore
- 🟡 L130 `coaches.find_one` (dict_without_club_id) — endpoint: POST /{coach_id}/restore
- 🟡 L136 `coaches.find_one` (dict_without_club_id) — endpoint: GET /{coach_id}/stats
- 🟡 L186 `coaches.find_one` (dict_without_club_id) — endpoint: GET /replacements/
- 🟡 L187 `coaches.find_one` (dict_without_club_id) — endpoint: GET /replacements/
- 🟡 L209 `coaches.find_one` (dict_without_club_id) — endpoint: POST /replacements/
- 🟠 L148 `course_kpis.find` (variable:query_unconfirmed) — endpoint: GET /{coach_id}/stats
- 🟠 L31 `coaches.find` (variable:query_unconfirmed) — endpoint: GET 
- 🟠 L182 `coach_replacements.find` (variable:query_unconfirmed) — endpoint: GET /replacements/

### `routers/courses.py` — 🔴2 🟠2 🟡9
- 🟡 L151 `course_types.find_one` (dict_without_club_id) — endpoint: PUT /course-types/{type_id}
- 🟡 L165 `course_types.update_one` (dict_without_club_id) — endpoint: PUT /course-types/{type_id}
- 🔴 L168 `course_kpis.update_many` (dict_without_club_id) — endpoint: PUT /course-types/{type_id}
- 🟡 L180 `course_kpis.find_one` (dict_without_club_id) — endpoint: GET /courses/{course_id}
- 🟡 L216 `course_kpis.find_one` (dict_without_club_id) — endpoint: PUT /courses/{course_id}
- 🟡 L228 `course_kpis.update_one` (dict_without_club_id) — endpoint: PUT /courses/{course_id}
- 🟡 L229 `course_kpis.find_one` (dict_without_club_id) — endpoint: PUT /courses/{course_id}
- 🟡 L234 `course_kpis.delete_one` (dict_without_club_id) — endpoint: DELETE /courses/{course_id}
- 🟡 L523 `accounting_categories.find_one` (dict_without_club_id) — endpoint: POST /courses/generate-salary-expenses/{year}/{month}
- 🔴 L532 `accounting_transactions.delete_many` (dict_without_club_id) — endpoint: POST /courses/generate-salary-expenses/{year}/{month}
- 🟡 L434 `course_kpis.update_one` (dict_without_club_id) — endpoint: POST /courses/copy-month
- 🟠 L482 `coaches.find` (call:exclude_archived) — endpoint: POST /courses/generate-salary-expenses/{year}/{month}
- 🟠 L118 `course_kpis.find` (variable:query_unconfirmed) — endpoint: GET /courses

### `routers/followups.py` — 🔴0 🟠1 🟡11
- 🟡 L118 `member_followups.find_one` (dict_without_club_id) — endpoint: PUT /{followup_id}
- 🟡 L123 `member_followups.update_one` (dict_without_club_id) — endpoint: PUT /{followup_id}
- 🟡 L124 `member_followups.find_one` (dict_without_club_id) — endpoint: PUT /{followup_id}
- 🟡 L130 `member_followups.find_one` (dict_without_club_id) — endpoint: POST /{followup_id}/complete
- 🟡 L160 `member_followups.update_one` (dict_without_club_id) — endpoint: POST /{followup_id}/complete
- 🟡 L161 `member_followups.find_one` (dict_without_club_id) — endpoint: POST /{followup_id}/complete
- 🟡 L166 `member_followups.delete_one` (dict_without_club_id) — endpoint: DELETE /{followup_id}
- 🟡 L65 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /upcoming
- 🟡 L88 `member_followups.update_one` (dict_without_club_id) — endpoint: GET /missed
- 🟡 L95 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /missed
- 🟡 L151 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{followup_id}/complete
- 🟠 L43 `member_followups.find` (variable:query_unconfirmed) — endpoint: GET 

### `routers/franchise.py` — 🔴0 🟠5 🟡0
- 🟠 L24 `clubs.find` (dict_without_club_id) — endpoint: GET /dashboard
- 🟠 L43 `customer_members.find` (dict_without_club_id) — endpoint: GET /dashboard
- 🟠 L141 `clubs.find` (dict_without_club_id) — endpoint: GET /trends
- 🟠 L203 `clubs.find` (dict_without_club_id) — endpoint: GET /ad-budgets
- 🟠 L150 `monthly_kpis.find` (dict_without_club_id) — endpoint: GET /trends

### `routers/ghl.py` — 🔴0 🟠4 🟡10
- 🟠 L119 `customer_members.count_documents` (dict_without_club_id) — endpoint: POST /sync
- 🟠 L120 `customer_members.count_documents` (dict_without_club_id) — endpoint: POST /sync
- 🟠 L124 `customer_members.count_documents` (dict_without_club_id) — endpoint: POST /sync
- 🟡 L189 `ghl_syncs.find_one` (dict_without_club_id) — endpoint: GET /last-sync
- 🟡 L264 `ghl_sales.find_one` (dict_without_club_id) — endpoint: POST /confirm-sale
- 🟡 L294 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /confirm-sale
- 🟡 L404 `accounting_categories.find_one` (dict_without_club_id) — endpoint: POST /confirm-sale
- 🟡 L419 `accounting_transactions.find_one` (dict_without_club_id) — endpoint: POST /confirm-sale
- 🟡 L430 `monthly_kpis.find_one` (dict_without_club_id) — endpoint: POST /confirm-sale
- 🟡 L304 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /confirm-sale
- 🟡 L369 `six_weeks_challenges.find_one` (dict_without_club_id) — endpoint: POST /confirm-sale
- 🟡 L433 `monthly_kpis.update_one` (dict_without_club_id) — endpoint: POST /confirm-sale
- 🟡 L371 `challenge_participants.find_one` (dict_without_club_id) — endpoint: POST /confirm-sale
- 🟠 L447 `ghl_sales.find` (dict_without_club_id) — endpoint: GET /sales/{month}

### `routers/kpis.py` — 🔴0 🟠9 🟡0
- 🟠 L215 `customer_members.find` (variable:bm_q_unconfirmed) — endpoint: GET /{month}/details
- 🟠 L299 `customer_members.find` (call:exclude_archived) — endpoint: GET /{month}/details
- 🟠 L425 `customer_members.find` (call:exclude_archived) — endpoint: recalculate_month
- 🟠 L452 `customer_members.find` (call:exclude_archived) — endpoint: recalculate_month
- 🟠 L531 `customer_members.aggregate` (variable:recurring_pipeline_unconfirmed) — endpoint: recalculate_month
- 🟠 L540 `accounting_transactions.find` (variable:rec_exp_q_unconfirmed) — endpoint: recalculate_month
- 🟠 L311 `customer_members.find` (dict_without_club_id) — endpoint: GET /{month}/details
- 🟠 L437 `customer_members.find` (dict_without_club_id) — endpoint: recalculate_month
- 🟠 L32 `customer_members.aggregate` (variable:exit_pipeline_unconfirmed) — endpoint: GET 

### `routers/marketing.py` — 🔴0 🟠0 🟡2
- 🟡 L84 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /unsubscribe
- 🟡 L104 `customer_members.update_one` (dict_without_club_id) — endpoint: GET /unsubscribe

### `routers/members.py` — 🔴5 🟠14 🟡46
- 🟠 L232 `customer_members.distinct` (complex:Constant) — endpoint: GET /memberships
- 🟡 L524 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /{member_id}
- 🟡 L637 `customer_members.find_one` (dict_without_club_id) — endpoint: PUT /{member_id}/pause
- 🟡 L668 `customer_members.update_one` (dict_without_club_id) — endpoint: PUT /{member_id}/pause
- 🟡 L669 `customer_members.find_one` (dict_without_club_id) — endpoint: PUT /{member_id}/pause
- 🟡 L678 `customer_members.find_one` (dict_without_club_id) — endpoint: DELETE /{member_id}/pause
- 🟡 L681 `customer_members.update_one` (dict_without_club_id) — endpoint: DELETE /{member_id}/pause
- 🟡 L850 `customer_members.find_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L872 `customer_members.update_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L965 `payment_schedules.find_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L1112 `customer_members.find_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L1119 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/dissociate-duo
- 🟡 L1135 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{member_id}/dissociate-duo
- 🟡 L1157 `customer_members.find_one` (dict_without_club_id) — endpoint: DELETE /{member_id}
- 🟡 L1164 `customer_members.update_one` (dict_without_club_id) — endpoint: DELETE /{member_id}
- 🟡 L1177 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/archive
- 🟡 L1187 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{member_id}/archive
- 🟡 L1195 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/archive
- 🟡 L1204 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/restore
- 🟡 L1210 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{member_id}/restore
- 🟡 L1221 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/restore
- 🟡 L1232 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/renew
- 🟡 L1323 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{member_id}/renew
- 🟡 L1346 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/renew
- 🟡 L1365 `customer_members.find_one` (dict_without_club_id) — endpoint: PUT /{member_id}/onboarding
- 🟡 L1406 `customer_members.update_one` (dict_without_club_id) — endpoint: PUT /{member_id}/onboarding
- 🟡 L1407 `customer_members.find_one` (dict_without_club_id) — endpoint: PUT /{member_id}/onboarding
- 🟡 L529 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /{member_id}
- 🟡 L782 `customer_members.update_one` (dict_without_club_id) — endpoint: POST 
- 🟡 L792 `six_weeks_challenges.find_one` (dict_without_club_id) — endpoint: POST 
- 🟡 L809 `accounting_categories.find_one` (dict_without_club_id) — endpoint: POST 
- 🟡 L822 `accounting_transactions.find_one` (dict_without_club_id) — endpoint: POST 
- 🔴 L878 `payments.update_many` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🔴 L897 `annual_reviews.delete_many` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L904 `annual_reviews.find_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L930 `customer_members.update_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🔴 L971 `payments.update_many` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L1054 `payments.find_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L1139 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{member_id}/dissociate-duo
- 🟡 L1141 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /{member_id}/dissociate-duo
- 🟡 L1278 `six_weeks_challenges.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/renew
- 🟡 L1327 `payment_schedules.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/renew
- 🟠 L157 `customer_members.find` (variable:query_unconfirmed) — endpoint: GET /stats
- 🟠 L250 `customer_members.find` (variable:query_unconfirmed) — endpoint: GET /expiring
- 🟠 L270 `customer_members.find` (variable:member_query_unconfirmed) — endpoint: _build_categorization_map
- 🟠 L273 `membership_types.find` (variable:types_query_unconfirmed) — endpoint: _build_categorization_map
- 🟠 L429 `weekly_trainings.find` (dict_without_club_id) — endpoint: GET /at-risk
- 🟠 L464 `weekly_trainings.aggregate` (complex:List) — endpoint: GET /at-risk
- 🟡 L795 `challenge_participants.find_one` (dict_without_club_id) — endpoint: POST 
- 🟡 L960 `customer_members.update_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L1025 `payment_schedules.update_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L1038 `payment_schedules.update_one` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟡 L1280 `challenge_participants.find_one` (dict_without_club_id) — endpoint: POST /{member_id}/renew
- 🟡 L1338 `payment_schedules.update_one` (dict_without_club_id) — endpoint: POST /{member_id}/renew
- 🔴 L1341 `payments.update_many` (dict_without_club_id) — endpoint: POST /{member_id}/renew
- 🟡 L1570 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /bulk-renewal-reminder
- 🟡 L306 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /categories
- 🟠 L557 `membership_types.find` (variable:types_query_unconfirmed) — endpoint: GET /{member_id}
- 🟠 L79 `customer_members.find` (variable:query_unconfirmed) — endpoint: GET 
- 🟠 L576 `weekly_trainings.find` (dict_without_club_id) — endpoint: GET /{member_id}
- 🔴 L1008 `payments.update_many` (dict_without_club_id) — endpoint: PUT /{member_id}
- 🟠 L1352 `member_renewals.find` (dict_without_club_id) — endpoint: GET /{member_id}/renewals
- 🟠 L1413 `annual_reviews.find` (dict_without_club_id) — endpoint: GET /{member_id}/annual-reviews
- 🟠 L1420 `activity_logs.find` (dict_without_club_id) — endpoint: GET /{member_id}/activity-log
- 🟠 L592 `weekly_trainings.find` (dict_without_club_id) — endpoint: GET /{member_id}

### `routers/notifications.py` — 🔴0 🟠3 🟡12
- 🟡 L154 `club_settings.find_one` (dict_without_club_id) — endpoint: get_club_name
- 🟡 L205 `payments.find_one` (dict_without_club_id) — endpoint: POST /send-payment-reminder/{payment_id}
- 🟡 L209 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /send-payment-reminder/{payment_id}
- 🟡 L223 `payments.update_one` (dict_without_club_id) — endpoint: POST /send-payment-reminder/{payment_id}
- 🟡 L243 `annual_reviews.find_one` (dict_without_club_id) — endpoint: POST /send-review-reminder/{review_id}
- 🟡 L247 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /send-review-reminder/{review_id}
- 🟡 L255 `settings.find_one` (empty_dict) — endpoint: POST /send-review-reminder/{review_id}
- 🟡 L179 `payments.update_one` (dict_without_club_id) — endpoint: POST /send-email
- 🟡 L184 `member_followups.update_one` (dict_without_club_id) — endpoint: POST /send-email
- 🟡 L305 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /send-bulk
- 🟠 L295 `payments.find` (dict_without_club_id) — endpoint: POST /send-bulk
- 🟡 L312 `payments.update_one` (dict_without_club_id) — endpoint: POST /send-bulk
- 🟡 L333 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /send-bulk
- 🟠 L321 `annual_reviews.find` (dict_without_club_id) — endpoint: POST /send-bulk
- 🟠 L359 `notification_logs.find` (empty_dict) — endpoint: GET /logs

### `routers/onboarding.py` — 🔴0 🟠4 🟡2
- 🟡 L73 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /onboarding/{member_id}/skip
- 🟡 L77 `customer_members.update_one` (dict_without_club_id) — endpoint: POST /onboarding/{member_id}/skip
- 🟠 L234 `customer_members.count_documents` (call:exclude_archived) — endpoint: GET /alerts/summary
- 🟠 L32 `customer_members.find` (call:exclude_archived) — endpoint: GET /onboarding/pending
- 🟠 L163 `customer_members.find` (variable:query_unconfirmed) — endpoint: GET /onboarding/stats/weekly
- 🟠 L220 `customer_members.find` (call:exclude_archived) — endpoint: GET /alerts/summary

### `routers/payments.py` — 🔴2 🟠10 🟡23
- 🟡 L64 `payment_schedules.find_one` (dict_without_club_id) — endpoint: PUT /payment-schedules/{schedule_id}
- 🟡 L69 `payment_schedules.update_one` (dict_without_club_id) — endpoint: PUT /payment-schedules/{schedule_id}
- 🟡 L70 `payment_schedules.find_one` (dict_without_club_id) — endpoint: PUT /payment-schedules/{schedule_id}
- 🟡 L75 `payment_schedules.delete_one` (dict_without_club_id) — endpoint: DELETE /payment-schedules/{schedule_id}
- 🟠 L284 `customer_members.find` (dict_without_club_id) — endpoint: GET /payments/unified
- 🟡 L536 `payments.find_one` (dict_without_club_id) — endpoint: PUT /payments/{payment_id}
- 🟡 L543 `payments.update_one` (dict_without_club_id) — endpoint: PUT /payments/{payment_id}
- 🟡 L544 `payments.find_one` (dict_without_club_id) — endpoint: PUT /payments/{payment_id}
- 🟡 L555 `payments.find_one` (dict_without_club_id) — endpoint: POST /payments/{payment_id}/mark-paid
- 🟡 L569 `payments.update_one` (dict_without_club_id) — endpoint: POST /payments/{payment_id}/mark-paid
- 🟡 L572 `customer_members.find_one` (dict_without_club_id) — endpoint: POST /payments/{payment_id}/mark-paid
- 🟡 L613 `payments.find_one` (dict_without_club_id) — endpoint: POST /payments/{payment_id}/mark-paid
- 🟡 L623 `payments.delete_one` (dict_without_club_id) — endpoint: DELETE /payments/{payment_id}
- 🟡 L632 `payments.find_one` (dict_without_club_id) — endpoint: POST /payments/{payment_id}/revert-to-unpaid
- 🟡 L642 `payments.update_one` (dict_without_club_id) — endpoint: POST /payments/{payment_id}/revert-to-unpaid
- 🟡 L646 `payments.find_one` (dict_without_club_id) — endpoint: POST /payments/{payment_id}/revert-to-unpaid
- 🔴 L119 `payment_schedules.delete_many` (empty_dict) — endpoint: POST /payments/sync-with-members
- 🔴 L145 `payments.delete_many` (dict_without_club_id) — endpoint: POST /payments/sync-with-members
- 🟡 L395 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /payments
- 🟡 L443 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /payments/late
- 🟡 L507 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /payments/upcoming
- 🟡 L700 `payments.find_one` (dict_without_club_id) — endpoint: POST /payments/generate/{year}/{month}
- 🟠 L34 `payment_schedules.find` (variable:query_unconfirmed) — endpoint: GET /payment-schedules
- 🟡 L38 `customer_members.find_one` (dict_without_club_id) — endpoint: GET /payment-schedules
- 🟠 L103 `customer_members.find` (call:exclude_archived) — endpoint: POST /payments/sync-with-members
- 🟡 L470 `payments.update_one` (dict_without_club_id) — endpoint: GET /payments/late
- 🟡 L477 `payments.update_one` (dict_without_club_id) — endpoint: GET /payments/late
- 🟠 L678 `customer_members.find` (call:exclude_archived) — endpoint: POST /payments/generate/{year}/{month}
- 🟡 L416 `payments.update_one` (dict_without_club_id) — endpoint: GET /payments
- 🟠 L274 `payments.find` (variable:p_query_unconfirmed) — endpoint: GET /payments/unified
- 🟠 L299 `accounting_transactions.find` (variable:at_query_unconfirmed) — endpoint: GET /payments/unified
- 🟠 L385 `payments.find` (variable:query_unconfirmed) — endpoint: GET /payments
- 🟠 L434 `payments.find` (variable:q_unconfirmed) — endpoint: GET /payments/late
- 🟠 L500 `payments.find` (variable:q_unconfirmed) — endpoint: GET /payments/upcoming
- 🟠 L406 `customer_members.find` (dict_without_club_id) — endpoint: GET /payments

### `routers/reports.py` — 🔴0 🟠0 🟡1
- 🟡 L36 `club_settings.find_one` (complex:BoolOp) — endpoint: GET /report/pdf/{month}

### `routers/rollover.py` — 🔴0 🟠2 🟡1
- 🟡 L50 `payments.find_one` (dict_without_club_id) — endpoint: _generate_payments_for_month
- 🟠 L35 `customer_members.find` (call:exclude_archived) — endpoint: _generate_payments_for_month
- 🟠 L244 `clubs.find` (empty_dict) — endpoint: run_rollover_all_clubs

### `routers/settings.py` — 🔴0 🟠2 🟡10
- 🟡 L37 `membership_types.find_one` (dict_without_club_id) — endpoint: GET /membership-types/{type_id}
- 🟡 L60 `membership_types.find_one` (dict_without_club_id) — endpoint: PUT /membership-types/{type_id}
- 🟡 L67 `membership_types.update_one` (dict_without_club_id) — endpoint: PUT /membership-types/{type_id}
- 🟡 L68 `membership_types.find_one` (dict_without_club_id) — endpoint: PUT /membership-types/{type_id}
- 🟡 L73 `membership_types.delete_one` (dict_without_club_id) — endpoint: DELETE /membership-types/{type_id}
- 🟡 L93 `member_types.find_one` (dict_without_club_id) — endpoint: GET /member-types/{type_id}
- 🟡 L116 `member_types.find_one` (dict_without_club_id) — endpoint: PUT /member-types/{type_id}
- 🟡 L123 `member_types.update_one` (dict_without_club_id) — endpoint: PUT /member-types/{type_id}
- 🟡 L124 `member_types.find_one` (dict_without_club_id) — endpoint: PUT /member-types/{type_id}
- 🟡 L129 `member_types.delete_one` (dict_without_club_id) — endpoint: DELETE /member-types/{type_id}
- 🟠 L31 `membership_types.find` (variable:query_unconfirmed) — endpoint: GET /membership-types
- 🟠 L87 `member_types.find` (variable:query_unconfirmed) — endpoint: GET /member-types

### `routers/trainings.py` — 🔴0 🟠2 🟡3
- 🟡 L29 `weekly_trainings.find_one` (dict_without_club_id) — endpoint: POST 
- 🟡 L38 `weekly_trainings.update_one` (dict_without_club_id) — endpoint: POST 
- 🟡 L42 `weekly_trainings.find_one` (dict_without_club_id) — endpoint: POST 
- 🟠 L24 `weekly_trainings.find` (variable:query_unconfirmed) — endpoint: GET 
- 🟠 L58 `weekly_trainings.find` (variable:query_unconfirmed) — endpoint: GET /summary/{member_id}

### `routers/transactions.py` — 🔴0 🟠4 🟡25
- 🟠 L78 `customer_members.count_documents` (dict_without_club_id) — endpoint: _auto_recalculate_kpis
- 🟡 L128 `excluded_recurring_expenses.find_one` (dict_without_club_id) — endpoint: POST /transactions
- 🟡 L209 `accounting_transactions.find_one` (dict_without_club_id) — endpoint: PUT /transactions/{transaction_id}
- 🟡 L229 `accounting_transactions.update_one` (dict_without_club_id) — endpoint: PUT /transactions/{transaction_id}
- 🟡 L263 `accounting_transactions.find_one` (dict_without_club_id) — endpoint: PUT /transactions/{transaction_id}
- 🟡 L274 `accounting_transactions.find_one` (dict_without_club_id) — endpoint: DELETE /transactions/{transaction_id}
- 🟡 L278 `recurring_transactions.find_one` (dict_without_club_id) — endpoint: DELETE /transactions/{transaction_id}
- 🟡 L299 `accounting_transactions.delete_one` (dict_without_club_id) — endpoint: DELETE /transactions/{transaction_id}
- 🟡 L357 `accounting_categories.delete_one` (dict_without_club_id) — endpoint: DELETE /categories/{category_id}
- 🟡 L366 `accounting_categories.update_one` (dict_without_club_id) — endpoint: PUT /categories/{category_id}
- 🟡 L371 `accounting_categories.find_one` (dict_without_club_id) — endpoint: PUT /categories/{category_id}
- 🟡 L390 `excluded_recurring_expenses.find_one` (dict_without_club_id) — endpoint: DELETE /excluded/{excluded_id}
- 🟡 L413 `excluded_recurring_expenses.delete_one` (dict_without_club_id) — endpoint: DELETE /excluded/{excluded_id}
- 🟡 L508 `recurring_transactions.find_one` (dict_without_club_id) — endpoint: PUT /recurring-transactions/{rec_id}
- 🟡 L512 `recurring_transactions.update_one` (dict_without_club_id) — endpoint: PUT /recurring-transactions/{rec_id}
- 🟡 L513 `recurring_transactions.find_one` (dict_without_club_id) — endpoint: PUT /recurring-transactions/{rec_id}
- 🟡 L518 `recurring_transactions.delete_one` (dict_without_club_id) — endpoint: DELETE /recurring-transactions/{rec_id}
- 🟡 L605 `recurring_validations.find_one` (dict_without_club_id) — endpoint: POST /recurring-validations
- 🟡 L611 `recurring_transactions.find_one` (dict_without_club_id) — endpoint: POST /recurring-validations
- 🟡 L640 `recurring_validations.delete_one` (dict_without_club_id) — endpoint: DELETE /recurring-validations/{validation_id}
- 🟡 L169 `recurring_transactions.find_one` (dict_without_club_id) — endpoint: POST /transactions
- 🟡 L243 `recurring_transactions.find_one` (dict_without_club_id) — endpoint: PUT /transactions/{transaction_id}
- 🟡 L316 `excluded_recurring_expenses.find_one` (dict_without_club_id) — endpoint: POST /transactions/bulk
- 🟡 L741 `accounting_transactions.update_one` (dict_without_club_id) — endpoint: PUT /transactions/update-monthly-amount
- 🟡 L255 `recurring_transactions.delete_one` (dict_without_club_id) — endpoint: PUT /transactions/{transaction_id}
- 🟠 L445 `customer_members.find` (variable:bm_q_unconfirmed) — endpoint: GET /recurring-transactions/all
- 🟠 L672 `accounting_transactions.aggregate` (variable:pipeline_unconfirmed) — endpoint: GET /transactions/monthly-grid
- 🟡 L779 `accounting_transactions.update_one` (dict_without_club_id) — endpoint: PUT /transactions/update-monthly-amount
- 🟠 L119 `accounting_transactions.find` (variable:query_unconfirmed) — endpoint: GET /transactions

### `services/billing_audit.py` — 🔴0 🟠1 🟡0
- 🟠 L47 `membership_types.find` (empty_dict) — endpoint: run_billing_audit

### `services/meta.py` — 🔴0 🟠0 🟡2
- 🟡 L144 `monthly_kpis.find_one` (variable:query_unconfirmed) — endpoint: sync_meta_ad_spend_to_kpis
- 🟡 L146 `monthly_kpis.update_one` (variable:query_unconfirmed) — endpoint: sync_meta_ad_spend_to_kpis

## 5. Effort estimé cumulé

- 🔴 patches : ~15min × 10 = 150min
- 🟠 patches : ~5min × 91 = 455min
- 🟡 patches : ~5min × 228 = 1140min
- **Total** : ~1745min (29h05)

> ⚠️ Effort patches uniquement. Tests régression à ajouter en parallèle (~50% de l'effort patch).