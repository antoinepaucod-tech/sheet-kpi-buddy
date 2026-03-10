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
- `monthly_kpis` - KPIs par mois (~60 champs, compatible Supabase)
- `accounting_transactions` - Transactions comptables CRUD
- `accounting_categories` - Catégories (LOYER, SALAIRES, COACHING, etc.)
- `excluded_recurring_expenses` - Transactions exclues (dépenses + revenus)
- `recurring_transactions` - Templates de transactions récurrentes
- `club_settings` - Paramètres du club (nom, objectifs KPI)

## Fonctionnalités Implémentées (2026-03)

### Authentification JWT
- [x] Page de connexion/inscription (/auth)
- [x] Onglets Connexion/Inscription avec formulaire adaptatif
- [x] JWT token stocké dans localStorage (7 jours)
- [x] Protection des routes (redirection vers /auth si non connecté)
- [x] Nom du club affiché dans topbar et sidebar
- [x] Bouton de déconnexion dans sidebar

### Dashboard Mensuel (/)
- [x] 6 KPI cards : Revenus Totaux, Bénéfice Net, Membres Actifs, Churn Rate, CAC, ROAS
- [x] Tendances vs mois précédent avec indicateurs visuels (↑↓)
- [x] Sélecteur de mois (topbar) + navigation prev/next arrows
- [x] Bouton "Modifier" → EditKPIModal
- [x] Bouton "PDF" → Télécharger le rapport PDF mensuel
- [x] Section "Objectifs du mois" avec 6 progress bars dynamiques
- [x] Click sur graphique → sélectionne ce mois
- [x] 5 onglets : REVENUS, ACQUISITION, MEMBRES, MÉTRIQUES, ANNUEL
- [x] Graphiques Recharts : AreaChart, BarChart, LineChart, ComposedChart

### Analyse Multi-Mois (/compare) - NEW
- [x] Sélection de plage de dates (début → fin)
- [x] Raccourcis rapides : 3M, 6M, 12M, Tout
- [x] Métriques agrégées : CA Total, Bénéfice, Dépenses, Marge Nette, Nouveaux Membres, Churn Moyen
- [x] Meilleur mois et Mois le plus faible
- [x] 4 onglets graphiques : Revenus, Membres, Dépenses, KPIs
- [x] Tableau récapitulatif avec colonnes : Mois, Revenus, Dépenses, Profit, Membres, Churn, ROAS
- [x] Ligne de totaux/moyennes en pied de tableau

### Export PDF Rapport Mensuel
- [x] Endpoint GET /api/report/pdf/{month}
- [x] Résumé des KPIs (revenus, profit, membres, churn, CAC, ROAS)
- [x] Détail des dépenses (loyer, salaires, charges, marketing)
- [x] Liste des transactions du mois (15 premières)
- [x] Note mensuelle si présente

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
- [x] Suppression → enregistrement dans exclusions avec type (dépense/revenu)
- [x] Section "Transactions Exclues" avec colonne Type
- [x] Filtrage par type (Dépense/Revenu)
- [x] Export CSV (avec BOM UTF-8 pour Excel)

### Transactions Récurrentes (/recurring)
- [x] Liste des templates récurrents (description, catégorie, montant, jour de récurrence)
- [x] Indicateurs stats (total, actifs, inactifs)
- [x] Modal d'ajout/édition avec tous les champs
- [x] Toggle actif/inactif via bouton Power
- [x] Génération automatique des transactions pour un mois choisi
- [x] Exclusion automatique des templates marqués comme exclus

### Catégories (/categories)
- [x] Liste en 2 colonnes (Dépenses / Revenus)
- [x] Couleur + colonne KPI mappée
- [x] Ajout nouvelle catégorie
- [x] Suppression avec confirmation
- [x] Bouton Recalculer les KPIs

### Paramètres (/settings)
- [x] Nom du club (affiché dans le dashboard)
- [x] 6 objectifs KPI (Churn Rate, CAC, ROAS, Nouveaux membres, Marge, Croissance)
- [x] Sauvegarde avec toast confirmation
- [x] Bouton Recalculer tout

### UX/Design
- [x] Dark mode permanent (#09090B)
- [x] FR/EN switch avec persistance localStorage
- [x] Devise fr-CH (CHF avec séparateurs)
- [x] Toast notifications partout
- [x] data-testid sur tous les éléments interactifs

## Modèle KPI Enrichi (pour migration Supabase)
Le modèle MonthlyKPI contient maintenant ~60 champs pour supporter la migration complète depuis Supabase :
- **Revenue** : total_revenue, general_eft_revenue, pt_revenue, retail_revenue, fast_cash_revenue
- **Members** : pif_members, recurring_general_members, pt_members, total_active_members + exits et churn pour chaque type
- **Funnel** : leads, calls_made, scheduled, show, close, cash_collected, avg_per_sale
- **Organic** : organic_leads, organic_close, organic_cash_collected
- **Trials** : in_trial, trial_ending, converted
- **Expenses** : rent, repairs_maintenance, computer_software, insurance, subscriptions, etc.
- **Metrics** : general_acrm, general_ltv, pt_acrm, pt_ltv, cpl, cpr, ro_ads

## Endpoints API

### Auth
- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `GET /api/auth/me` - Récupérer l'utilisateur courant
- `PUT /api/auth/club-name` - Modifier le nom du club

### KPIs & Reports
- `GET/POST /api/monthly-kpis` - KPIs mensuels
- `GET /api/monthly-kpis/{month}` - KPI d'un mois spécifique
- `POST /api/monthly-kpis/bulk` - Import en masse (migration Supabase)
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
- `GET /api/init` - Vérifie si données existent
- `POST /api/seed` - Charge données démo
- `GET/POST/DELETE /api/categories` - Catégories
- `GET/PUT /api/settings` - Paramètres du club

## Tests
- Backend: 100% (toutes routes, iterations 1-7)
- Frontend: 100% (toutes features vérifiées)
- Itérations: 7 passes complètes

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
