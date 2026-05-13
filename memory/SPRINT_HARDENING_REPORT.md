# 🛡️ Sprint Hardening `club_id` — Rapport Final Consolidé

**Date de clôture** : 2026-05-13
**Périmètre** : Application TRANSFORM SaaS Multi-Club (Atlas `transform.iocnr7b.mongodb.net/club_management`)
**Cible architecturale** : Garantir l'injection systématique du `club_id` sur toutes les écritures critiques (défense en profondeur), avec auth Bearer obligatoire et logs structurés en cas de fallback.

---

## 1️⃣ Inserts patchés (26 au total)

| Module | Sous-bloc | Inserts | Endpoints concernés |
|---|---|---|---|
| **GHL** | 🔴 CRITIQUE | 5 | `routers/ghl.py:266,282,298,314,348` — webhooks `lead_created`, `opportunity_updated`, `appointment_created`, `note_added`, `tag_applied` |
| **GHL** | 🔴 Suite | 5 | `routers/ghl.py:393` + 4 inserts internes au flux `/sync` (monthly_kpis, ghl_syncs, ghl_sales) |
| **GHL** | 🟡 | 0 | (couvert par les sous-blocs 🔴 — pas d'insert résiduel) |
| **activity_logs** | Hot-fix | 8 | 8 call-sites migrés vers `core/activity_log.py` (members create/update/delete/archive/restore + onboarding skip + payments cancel + renewals) |
| **Endpoints internes** | Bloc 2 | 8 | `routers/payments.py:372,437` ; `routers/coaches.py:209` ; `routers/members.py:1175,1205,1231` ; `routers/courses.py:generate-salary-expenses` ; `routers/annual_reviews.py:auto-generate` |
| **TOTAL** | | **26** | — |

**Pattern uniforme appliqué** :
```python
@router.post(...)
async def endpoint(
    ...,
    club_id: Optional[str] = Depends(get_club_id),
    current_user: dict = Depends(get_current_user),
):
    resolved_club_id = resolve_club_id_or_fallback(
        club_id=club_id, current_user=current_user, endpoint="...",
    )
    doc = model.model_dump()
    doc["club_id"] = resolved_club_id  # défense en profondeur après dump
    await db.collection.insert_one(doc)
```

---

## 2️⃣ Auth Bearer ajoutée (13 endpoints)

12 routeurs ont désormais `Depends(get_current_user)` :
- `routers/members.py`
- `routers/payments.py`
- `routers/ghl.py`
- `routers/coaches.py`
- `routers/admin.py`
- `routers/kpis.py`
- `routers/franchise.py`
- `routers/annual_reviews.py`
- `routers/onboarding.py`
- `routers/clubs.py`
- `routers/meta.py`
- `routers/auth.py`

48 occurrences `Depends(get_current_user)` ou `resolve_club_id_or_fallback` dans `routers/`.

---

## 3️⃣ Helpers réutilisables créés

### `core/club_id_guard.py`
- `resolve_club_id_or_fallback(club_id, current_user, endpoint)` → `str`
- Cascade : `explicit (header X-Club-Id) → fallback DEFAULT_CLUB_ID Versoix`
- Log JSON structuré `MISSING_CLUB_ID` si fallback utilisé (event, endpoint, user_id, user_email, timestamp, fallback_used)
- Utilisé dans : `members.py`, `payments.py`, `ghl.py`, `coaches.py`, `kpis.py`

### `core/activity_log.py`
- `log_activity(db, member_id, action, club_id, details, current_user)` → ID
- Cascade `club_id` : `explicit → member.club_id (DB lookup) → current_user → DEFAULT`
- Tronque safely si `member_id` introuvable (log warning, garde club_id du user)
- Utilisé dans : `members.py`, `annual_reviews.py`, `onboarding.py`

---

## 4️⃣ Tests créés

### Tests pytest unitaires (`/app/backend/tests/`)
- `test_activity_log.py` : **6 tests** (cascade `explicit > member > user > fallback`, member introuvable, club_id absent partout, idempotency, log warning structuré, helper inerte si member archivé)
- `test_g1_g4_f1_iter87.py` : **14 tests** backend (G1+G4+F1 — anomalies prod)

### Tests E2E (testing_agent_v3_fork)
- ~30 tests e2e cumulés sur les itérations 80→87 (1 × 401 unauthorized + 1 × 200 OK par endpoint patché)
- Iter_87 (dernier) : **100% PASS** (14/14 backend + tous les flows frontend)

---

## 5️⃣ Bugs collatéraux fixés pendant le Sprint

| Bug | Description | Fichier |
|---|---|---|
| **PaymentSchedule import** | `from models.members import PaymentSchedule` cassait au boot (mauvais chemin) | `routers/payments.py` (fixé) |
| **Zero-overwrite `/sync`** | `/api/ghl/sync` écrasait `monthly_kpis` à 0 quand GHL retournait 0 opportunités | `routers/ghl.py` (garde-fou `GHL_SYNC_ZERO_OVERWRITE_PREVENTED` ajouté) |
| **Data restoration 2026-01 Versoix** | 13 champs `monthly_kpis` 2026-01 écrasés à 0 lors d'un test `/sync` → restaurés depuis backup `atlas_pre_apply_20260423` | Cible : `monthly_kpis` |
| **`club_id` manquant `generate-salary-expenses`** | `POST /api/courses/generate-salary-expenses/{year}/{month}` ne propageait pas `club_id` | `routers/courses.py` (validation 400 + injection explicite) |
| **`cabassot & bolle` HYBRID DUO ambigu** | Cas légitime mais flag d'ambiguïté Sprint B → laissé intact | (non-touché, doc historique) |

---

## 6️⃣ Migration data — F.3 Apply (2026-05-13)

**29 docs orphelins (club_id = null) migrés vers Versoix** (`0a327bf5-c759-49eb-87e4-551913f78bdb`) :

| Collection | Avant | Migrés | Après | Détails |
|---|---|---|---|---|
| `activity_logs` | 6 | **6** (dont 2 via preuve forensique) | 0 | Adrianna Zapata (archive/restore), Audrey Bernard (onboarding_skipped), Luath & Tom Marsden (payments_cancelled), 2 logs du member 065aac07 (hard-deleté post-création, preuve `member_created` antérieur club=Versoix) |
| `member_renewals` | 3 | **3** | 0 | Alexandra Dankova (1), Adrienne Polli (2) |
| `annual_reviews` | 20 | **20** | 0 | Tous générés par `annual-reviews/auto-generate` du 2026-04-22 (avant Bloc 2) + 1 par renouvellement manuel du 2026-03-23 |
| **TOTAL** | **29** | **29** | **0** | ✅ |

**Champ d'audit** : `club_id_migrated_at: 2026-05-13T13:13:10.423481+00:00` ajouté sur les 29 docs migrés (permet rollback ciblé si nécessaire).

**Vérification post-apply complète** (15 collections critiques) :
| Collection | Total | Orphelins | Status |
|---|---|---|---|
| accounting_transactions | 3732 | 0 | ✅ |
| payments | 241 | 0 | ✅ |
| coaches | 7 | 0 | ✅ |
| coach_replacements | 2 | 0 | ✅ |
| customer_members | 332 | 0 | ✅ |
| member_renewals | 4 | 0 | ✅ |
| weekly_trainings | 533 | 0 | ✅ |
| course_kpis | 239 | 0 | ✅ |
| activity_logs | 250 | 0 | ✅ |
| monthly_kpis | 37 | 0 | ✅ |
| annual_reviews | 220 | 0 | ✅ |
| challenge_participants | 1 | 0 | ✅ |
| ghl_sales | 1 | 0 | ✅ |
| ghl_syncs | 2 | 0 | ✅ |
| payment_schedules | 95 | 0 | ✅ |
| **TOTAL** | **5 706** | **0** | ✅ |

---

## 7️⃣ Backlog enrichi (P2)

Nouveaux items détectés pendant le Sprint et à traiter ultérieurement :

- **Audit `billing_enabled=true` sans `payment_schedules`** : repérer les membres avec billing actif mais sans échéancier (potentiel résidu du fix import `PaymentSchedule`). Aggregation MongoDB fournie dans `PRD.md`.
- **Audit historique `monthly_kpis`** : croiser avec le backup `atlas_pre_apply_20260423_*` pour détecter d'éventuels autres écrasements zéro silencieux passés (avant le garde-fou `GHL_SYNC_ZERO_OVERWRITE_PREVENTED`).
- **Cleanup data Partenaires** : noms combinés "X & Y FirstLast & Lastname" sur les couples DUO Partenaire (cosmétique).
- **Refactor `_is_on_pause`** : extraire dans `core/` pour DRY (re-implémenté inline dans `routers/onboarding.py`).

---

## 8️⃣ État final de la base

- **5 706 docs** sur 15 collections critiques
- **0 orphelin `club_id`** (delta = -29 depuis baseline initiale du Sprint)
- **0 anomalie cross-club** détectée (mono-club Versoix actuellement actif)
- **3 clubs additionnels** présents mais inactifs : Servette, Grand-Saconnex, Lausanne

---

## 9️⃣ Architecture défense en profondeur établie

**Pattern uniforme sur 26 endpoints d'écriture critiques** :

1. ✅ **Auth obligatoire** : `Depends(get_current_user)` sur tous les endpoints (sauf `/auth/login`, `/auth/register`, `/init`, `/health`)
2. ✅ **Helper `resolve_club_id_or_fallback`** : cascade `explicit > current_user > Versoix` + log JSON structuré
3. ✅ **Injection explicite** : `doc["club_id"] = club_id` **APRÈS** `model_dump()` (résistant aux modèles Pydantic incomplets)
4. ✅ **Helper `log_activity` centralisé** : cascade `explicit > member.club_id (DB lookup) > current_user > DEFAULT`
5. ✅ **ESLint guard TanStack Query v5** : règle `no-restricted-syntax` empêche les `invalidateQueries(['key'])` positionnel déprécié (CRA build fail + CLI script `yarn lint:rq`)
6. ✅ **Protection zero-overwrite `/sync`** : refuse d'écraser des KPIs non-nuls par des 0 venant de GHL
7. ✅ **Garde-fous Sprint A** : aucun DELETE, dry-run obligatoire avant `--apply`, cible DB affichée, confirmation interactive, champ d'audit `club_id_migrated_at`

---

## 📦 Annexes — Fichiers livrés

- `core/club_id_guard.py` (nouveau)
- `core/activity_log.py` (nouveau)
- `tests/test_activity_log.py` (nouveau, 6 tests)
- `tests/test_g1_g4_f1_iter87.py` (nouveau, 14 tests)
- `scripts/audit_f1_orphans_baseline.py` (nouveau, audit 15 collections)
- `scripts/migrate_orphan_club_id.py` (nouveau, dry-run + apply avec confirmation)
- `scripts/audit_f1_payments.py`, `audit_f1_passe2.py`, `audit_g1_g4_coach.py` (audits anomalies prod F1/G1/G4)
- `pytest.ini` (asyncio_mode=auto)
- 12 routeurs patchés (auth + club_id_guard + log_activity)

## 🎯 Bilan

**Sprint Hardening clos** : 26 inserts protégés, 13 endpoints sécurisés, 29 orphelins migrés, 0 anomalie résiduelle. Pattern défensif uniforme appliqué — toute nouvelle écriture de doc devra suivre ce pattern (vérifiable par le testing_agent en non-régression).

**Date de clôture** : 2026-05-13 13:13 UTC
