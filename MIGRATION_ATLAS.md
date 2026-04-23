# Migration MongoDB Atlas — 2026-04-23

## Contexte

Migration de la base de données depuis une instance MongoDB locale (pod Kubernetes Emergent, sans persistance ni backup garantis) vers un cluster MongoDB Atlas managé dédié.

## Sources

| Élément | Avant (local) | Après (Atlas) |
|---|---|---|
| **Driver** | MongoDB 7.x (container) | MongoDB Atlas 8.0.21 |
| **Connection string** | `mongodb://localhost:27017` | `mongodb+srv://club-management-prod:***@transform.iocnr7b.mongodb.net/club_management?retryWrites=true&w=majority&appName=transform` |
| **Database name** | `kpibuddy` | `club_management` |
| **Topology** | Standalone local | ReplicaSetWithPrimary (3 nodes répliqués) |
| **Persistance** | Non garantie (volume /dev/nvme0n10 ext4 du pod) | Persistante + snapshots Atlas |
| **Hôte primary** | `localhost:27017` | `ac-6fulpmf-shard-00-02.iocnr7b.mongodb.net:27017` |

## Procédure exécutée

### Étape 1 — Hardcode config backend

Fichier modifié : `/app/backend/core/config.py`

Les constantes `MONGO_URL` et `DB_NAME` sont désormais **hardcodées dans le code source** et ne sont plus lues depuis `os.environ`. Le `load_dotenv(override=False)` est explicite pour empêcher toute surcharge par l'infra Emergent au redémarrage.

```python
MONGO_URL = "mongodb+srv://club-management-prod:***@transform.iocnr7b.mongodb.net/club_management?retryWrites=true&w=majority&appName=transform"
DB_NAME = "club_management"

# Ancienne config (commentée pour rollback)
# MONGO_URL = os.environ['MONGO_URL']   # mongodb://localhost:27017
# DB_NAME = os.environ['DB_NAME']       # kpibuddy
```

### Étape 2 — Test connexion Atlas

Ping + écriture/lecture/suppression dans `migration_test` → OK.

### Étape 3 — mongorestore

Commande :
```bash
mongorestore \
  --uri="mongodb+srv://club-management-prod:***@transform.iocnr7b.mongodb.net/?retryWrites=true&w=majority&appName=transform" \
  --nsFrom="kpibuddy.*" \
  --nsTo="club_management.*" \
  /app/backups/dump_20260423_105258/
```

**Résultat** : `5037 document(s) restored successfully. 0 document(s) failed to restore.`

### Étape 4 — Validation intégrité (27 collections, 5037 docs)

| Collection | Expected | Atlas | Diff |
|---|---:|---:|---:|
| accounting_categories | 41 | 41 | 0 |
| accounting_transactions | 3488 | 3488 | 0 |
| activity_logs | 222 | 222 | 0 |
| annual_reviews | 220 | 220 | 0 |
| challenge_participants | 1 | 1 | 0 |
| club_settings | 3 | 3 | 0 |
| clubs | 4 | 4 | 0 |
| coaches | 7 | 7 | 0 |
| course_kpis | 59 | 59 | 0 |
| course_types | 9 | 9 | 0 |
| customer_members | 328 | 328 | 0 |
| excluded_recurring_expenses | 0 | 0 | 0 |
| ghl_sales | 1 | 1 | 0 |
| ghl_syncs | 2 | 2 | 0 |
| instructors | 7 | 7 | 0 |
| member_followups | 0 | 0 | 0 |
| member_renewals | 4 | 4 | 0 |
| member_types | 3 | 3 | 0 |
| membership_types | 20 | 20 | 0 |
| monthly_kpis | 34 | 34 | 0 |
| payment_schedules | 94 | 94 | 0 |
| payments | 162 | 162 | 0 |
| recurring_transactions | 0 | 0 | 0 |
| recurring_validations | 0 | 0 | 0 |
| six_weeks_challenges | 1 | 1 | 0 |
| users | 2 | 2 | 0 |
| weekly_trainings | 325 | 325 | 0 |
| **TOTAL** | **5037** | **5037** | **0** |

**Indexes restaurés** : `club_id_1` sur toutes les collections multi-tenant. 0 failure.

### Étape 5 — Validation fonctionnelle endpoints

Après restart du backend pointant sur Atlas, test de 3 endpoints critiques (auth super_admin Antoine) :

| Endpoint | HTTP | Docs retournés |
|---|---|---:|
| `GET /api/members` | 200 ✅ | 328 |
| `GET /api/coaches` | 200 ✅ | 7 |
| `GET /api/payments` | 200 ✅ | 162 |

Login super_admin `antoine.paucod@the-coach.pro` OK → prouve que la collection `users` + bcrypt hashes ont bien été préservés.

## Procédure de rollback

Si un problème bloquant apparaît (perte de perf, auth cassée, incident Atlas) :

1. Éditer `/app/backend/core/config.py` :
   - Commenter les 2 lignes `MONGO_URL` / `DB_NAME` "PRODUCTION ATLAS"
   - Décommenter les 2 lignes "ANCIENNE CONFIG LOCALE"
2. `sudo supervisorctl restart backend`
3. L'app repointe instantanément sur `mongodb://localhost:27017/kpibuddy` (intacte, toujours présente sur le pod au moment de la migration).

**Temps de bascule rollback** : ~10 secondes.

## Backup pré-migration conservé

- ZIP complet : `/app/backups/full_backup_20260423_105258.zip` (724 KB, 27 collections, 5037 docs)
- Dump BSON : `/app/backups/dump_20260423_105258/`
- Export JSON + manifest : `/app/backups/json_20260423_105258/`

Une copie téléchargée en local par l'opérateur (Antoine) via l'endpoint temporaire `GET /api/admin/download-backup?token=***`.

## DB locale `kpibuddy` — conservée pour rollback

La DB `mongodb://localhost:27017/kpibuddy` est **laissée intacte** pour au moins 48h après la migration. Ne pas la supprimer tant que l'opérateur n'a pas validé la stabilité complète de l'app sur Atlas.

Commande pour vérifier qu'elle est toujours là :
```bash
mongosh --quiet mongodb://localhost:27017/kpibuddy --eval 'print("customer_members:", db.customer_members.countDocuments())'
```

## Sécurité & secrets

- Le mot de passe Atlas `club-management-prod` est **hardcodé dans `/app/backend/core/config.py`**.
- Network Access Atlas : `0.0.0.0/0` (à durcir ultérieurement sur IP fixe Emergent).
- Role du user : `readWriteAnyDatabase`.
- Recommandation future : rotation du mot de passe + déplacement vers un secret manager (AWS Secrets Manager, Vault, ou équivalent).

## Points à surveiller (48h post-migration)

- [ ] Latence des requêtes (Atlas vs localhost — potentiellement +20-50ms RTT)
- [ ] Stabilité du scheduler APScheduler (Supabase sync + rollover CRON)
- [ ] Fonctionnement du widget Dashboard Franchise
- [ ] Login / persistance session
- [ ] Absence d'erreurs réseau / DNS dans `/var/log/supervisor/backend.err.log`

## Prochaine étape

- **Sprint B `--apply`** (migration soft delete + archivage HUBFIT) : à exécuter sur la DB Atlas uniquement après 48h de stabilité validée par l'opérateur.
