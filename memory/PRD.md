# Sheet KPI Buddy - PRD

## Problème Résolu
Application SaaS de pilotage financier pour clubs de sport (CrossFit, fitness, tennis). Permet de suivre les KPIs financiers en temps réel : revenus, dépenses, taux de churn, CAC et ROAS.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async) — DB: kpibuddy
- **Frontend**: React + shadcn/ui + Recharts + Tailwind CSS
- **Auth**: JWT (7 jours) avec bcrypt pour les mots de passe
- **Internationalisation**: Context FR/EN (~180 clés de traduction)
- **Données**: 24 mois de démo pré-chargées (2023-2024), auto-seed au premier lancement

## Collections MongoDB
- `users` - Comptes utilisateurs (email, club_name, hashed_password)
- `monthly_kpis` - KPIs par mois (revenus, dépenses, membres, etc.)
- `accounting_transactions` - Transactions comptables CRUD
- `accounting_categories` - Catégories (LOYER, SALAIRES, COACHING, etc.)
- `excluded_recurring_expenses` - Transactions exclues (dépenses + revenus)
- `recurring_transactions` - Templates de transactions récurrentes
- `club_settings` - Paramètres du club (nom, objectifs KPI)

## Fonctionnalités Implémentées (2026-03)

### Authentification JWT (NEW)
- [x] Page de connexion/inscription (/auth)
- [x] Onglets Connexion/Inscription avec formulaire adaptatif
- [x] JWT token stocké dans localStorage (7 jours)
- [x] Protection des routes (redirection vers /auth si non connecté)
- [x] Nom du club affiché dans topbar et sidebar
- [x] Bouton de déconnexion dans sidebar
- [x] Endpoint PUT /api/auth/club-name pour modifier le nom

### Dashboard (/)
- [x] 6 KPI cards : Revenus Totaux, Bénéfice Net, Membres Actifs, Churn Rate, CAC, ROAS
- [x] Tendances vs mois précédent avec indicateurs visuels (↑↓)
- [x] Sélecteur de mois (topbar) + navigation prev/next arrows
- [x] Nom du club depuis Paramètres dans le header
- [x] Bouton "Modifier" → EditKPIModal pour new_members, lost_members, etc.
- [x] **Bouton "PDF" → Télécharger le rapport PDF mensuel** (NEW)
- [x] Section "Objectifs du mois" avec 6 progress bars dynamiques
- [x] Click sur graphique → sélectionne ce mois
- [x] 5 onglets : REVENUS, ACQUISITION, MEMBRES, MÉTRIQUES, ANNUEL
- [x] Graphiques Recharts : AreaChart, BarChart, LineChart, ComposedChart

### Export PDF Rapport Mensuel (NEW)
- [x] Endpoint GET /api/report/pdf/{month}
- [x] Résumé des KPIs (revenus, profit, membres, churn, CAC, ROAS)
- [x] Détail des dépenses (loyer, salaires, charges, marketing)
- [x] Liste des transactions du mois (15 premières)
- [x] Note mensuelle si présente
- [x] Footer avec date de génération

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
- [x] **Section "Transactions Exclues" avec colonne Type (Revenu/Dépense)** (NEW)
- [x] Filtrage par type (Dépense/Revenu)
- [x] Export CSV (avec BOM UTF-8 pour Excel)
- [x] Sync avec le mois global sélectionné

### Transactions Récurrentes (/recurring)
- [x] Liste des templates récurrents (description, catégorie, montant, jour de récurrence)
- [x] Indicateurs stats (total, actifs, inactifs)
- [x] Modal d'ajout/édition avec tous les champs (type, catégorie, description, montant, jour 1-28)
- [x] Toggle actif/inactif via bouton Power avec feedback toast
- [x] Génération automatique des transactions pour un mois choisi (via modal année/mois)
- [x] Exclusion automatique des templates marqués comme exclus
- [x] Suppression avec confirmation

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
- [x] FR/EN switch dans topbar avec persistance localStorage
- [x] Devise fr-CH (CHF avec séparateurs)
- [x] Polices Barlow Condensed + IBM Plex Sans + JetBrains Mono
- [x] Toast notifications partout
- [x] data-testid sur tous les éléments interactifs
- [x] Auto-seed au premier chargement

## Endpoints API
### Auth
- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `GET /api/auth/me` - Récupérer l'utilisateur courant
- `PUT /api/auth/club-name` - Modifier le nom du club

### KPIs & Reports
- `GET /api/init` - Vérifie si données existent
- `POST /api/seed` - Charge 24 mois de démo
- `GET/POST /api/monthly-kpis` - KPIs mensuels
- `GET /api/monthly-kpis/{month}` - KPI d'un mois spécifique
- `POST /api/monthly-kpis/{month}/recalculate` - Recalcul depuis transactions
- `POST /api/monthly-kpis/recalculate-all` - Recalcul tous les mois
- `GET /api/report/pdf/{month}` - Générer rapport PDF

### Transactions
- `GET/POST/DELETE /api/transactions` - Transactions
- `POST /api/transactions/bulk` - Import en masse
- `GET/DELETE /api/excluded` - Exclusions récurrentes

### Recurring
- `GET/POST/PUT/DELETE /api/recurring-transactions` - Templates récurrents
- `POST /api/recurring-transactions/generate/{year}/{month}` - Génération mensuelle

### Other
- `GET/POST/DELETE /api/categories` - Catégories
- `GET/PUT /api/settings` - Paramètres du club

## Tests
- Backend: 100% (toutes routes, iterations 1-6)
- Frontend: 100% (toutes features vérifiées)
- Itérations: 6 passes complètes

## Backlog Prioritaire

### P1
- [ ] Mode temps réel via WebSocket ou SSE
- [ ] Multi-clubs (workspace par club avec isolation des données)
- [ ] Export rapport annuel PDF

### P2
- [ ] Alertes email si KPI hors objectif (SendGrid)
- [ ] Tableau de bord public (lien partage lecture seule)
- [ ] Mobile app (PWA)
- [ ] Notifications automatiques si transaction récurrente non générée
