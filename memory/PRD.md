# Sheet KPI Buddy - PRD

## Problème Résolu
Application SaaS de pilotage financier pour clubs de sport (CrossFit, fitness, tennis). Permet de suivre les KPIs financiers en temps réel : revenus, dépenses, taux de churn, CAC et ROAS.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async) — DB: kpibuddy
- **Frontend**: React + shadcn/ui + Recharts + Tailwind CSS
- **Internationalisation**: Context FR/EN (hook useTranslations)
- **Données**: 12 mois de démo pré-chargées, auto-seed au premier lancement

## Collections MongoDB
- `monthly_kpis` - KPIs par mois (revenus, dépenses, membres, etc.)
- `accounting_transactions` - Transactions comptables CRUD
- `accounting_categories` - Catégories (LOYER, SALAIRES, COACHING, etc.)
- `excluded_recurring_expenses` - Transactions exclues (suppression → exclusion)
- `club_settings` - Paramètres du club (nom, objectifs KPI)

## Fonctionnalités Implémentées (2026-03)

### Dashboard (/)
- [x] 6 KPI cards : Revenus Totaux, Bénéfice Net, Membres Actifs, Churn Rate, CAC, ROAS
- [x] Tendances vs mois précédent avec indicateurs visuels (↑↓)
- [x] Sélecteur de mois (topbar) + navigation prev/next arrows
- [x] Nom du club depuis Paramètres dans le header
- [x] Bouton "Modifier" → EditKPIModal pour new_members, lost_members, etc.
- [x] Section "Objectifs du mois" avec 6 progress bars dynamiques
- [x] Click sur graphique → sélectionne ce mois
- [x] 5 onglets : REVENUS, ACQUISITION, MEMBRES, MÉTRIQUES, ANNUEL
- [x] Graphiques Recharts : AreaChart, BarChart, LineChart, ComposedChart

### Onglet Annuel (/dashboard → ANNUEL)
- [x] CA Annuel, Bénéfice Annuel, Dépenses, Nouveaux membres totaux
- [x] Meilleur mois / Mois le plus faible
- [x] Moyennes annuelles (ROAS, Churn, Marge)
- [x] Graphique Revenus vs Dépenses de l'année

### Transactions (/transactions)
- [x] Tableau CRUD complet avec transactions démo
- [x] Séparation Membres vs Coaching via useCoachMembership hook
- [x] Barre de recherche (description + catégorie)
- [x] Ajout transaction via modal avec formulaire dynamique
- [x] Suppression → enregistrement dans excluded_recurring_expenses + toast
- [x] Section "Transactions Exclues" avec restauration possible
- [x] Filtrage par type (Dépense/Revenu)
- [x] Export CSV (avec BOM UTF-8 pour Excel)
- [x] Sync avec le mois global sélectionné

### Catégories (/categories)
- [x] Liste en 2 colonnes (Dépenses / Revenus)
- [x] Couleur + colonne KPI mappée
- [x] Ajout nouvelle catégorie (nom, type, kpi_column, couleur)
- [x] Suppression avec confirmation + toast
- [x] Bouton Recalculer les KPIs

### Paramètres (/settings)
- [x] Nom du club (affiché dans le dashboard)
- [x] 6 objectifs KPI (Churn Rate, CAC, ROAS, Nouveaux membres, Marge, Croissance)
- [x] Sauvegarde avec toast confirmation
- [x] Bouton Recalculer tout (recalcule depuis transactions avec merge)

### Calculs Métier (backend)
- [x] Churn Rate = lost_members / (total_members + lost_members) * 100
- [x] CAC = marketing_spend / new_members
- [x] ROAS = total_revenue / ad_spend
- [x] Profit Margin = net_profit / total_revenue * 100
- [x] Recalcul KPIs depuis transactions (avec merge, préserve les champs manuels)

### UX/Design
- [x] Dark mode permanent (#09090B)
- [x] FR/EN switch dans topbar
- [x] Devise fr-CH (CHF avec séparateurs)
- [x] Polices Barlow Condensed + IBM Plex Sans + JetBrains Mono
- [x] Toast notifications partout
- [x] data-testid sur tous les éléments interactifs
- [x] Auto-seed au premier chargement

## Endpoints API
- `GET /api/init` - Vérifie si données existent
- `POST /api/seed` - Charge 12 mois de démo
- `GET/POST /api/monthly-kpis` - KPIs mensuels
- `GET /api/monthly-kpis/{month}` - KPI d'un mois spécifique
- `POST /api/monthly-kpis/{month}/recalculate` - Recalcul depuis transactions
- `POST /api/monthly-kpis/recalculate-all` - Recalcul tous les mois
- `GET/POST/DELETE /api/transactions` - Transactions
- `GET/POST/DELETE /api/categories` - Catégories
- `GET/DELETE /api/excluded` - Exclusions récurrentes
- `GET/PUT /api/settings` - Paramètres du club

## Tests
- Backend: 100% (toutes routes)
- Frontend: 100% (toutes features vérifiées)
- Itérations: 3 passes complètes

## Features v2.0 (2026-03)
- [x] Comparaison N-1 — toggle sur onglet REVENUS, lignes pointillées 2023
- [x] Notes mensuelles — EditKPIModal avec textarea, bandeau jaune sur dashboard
- [x] Import CSV — modal PapaParse, aperçu avant import, bulk POST
- [x] 24 mois de KPIs seedés (2023 + 2024)
- [x] currentYearData — tous les graphiques filtrés sur l'année en cours

## Backlog Prioritaire

### P0
- [ ] Authentification multi-clubs (JWT ou OAuth)
- [ ] Import CSV de transactions depuis Excel/Google Sheets

### P1
- [ ] Mode temps réel via WebSocket ou SSE (polling 30s en place)
- [ ] Export PDF rapport mensuel (actuellement CSV seulement)
- [ ] Notes mensuelles (texte libre par mois)
- [ ] Comparaison N-1 sur les graphiques

### P2
- [ ] Multi-clubs (workspace par club)
- [ ] Alertes email si KPI hors objectif (SendGrid)
- [ ] Tableau de bord public (lien partage lecture seule)
- [ ] Mobile app (PWA)
