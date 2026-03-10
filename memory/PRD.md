# Sheet KPI Buddy - PRD

## Problème Résolu
Application SaaS de pilotage financier pour clubs de sport (CrossFit, fitness, tennis). Permet de suivre les KPIs financiers en temps réel : revenus, dépenses, taux de churn, CAC et ROAS.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async)
- **Frontend**: React + shadcn/ui + Recharts + Tailwind CSS
- **Internationalisation**: Context FR/EN (hook useTranslations)
- **Données**: 12 mois de démo pré-chargées, auto-seed au premier lancement

## Collections MongoDB (DB: kpibuddy)
- `monthly_kpis` - KPIs par mois (revenus, dépenses, membres, etc.)
- `accounting_transactions` - Transactions comptables CRUD
- `accounting_categories` - Catégories (LOYER, SALAIRES, COACHING, etc.)
- `excluded_recurring_expenses` - Transactions exclues (suppression → exclusion)

## Fonctionnalités Implémentées (2026-03)

### Dashboard (/dashboard)
- [x] 6 KPI cards : Revenus Totaux, Bénéfice Net, Membres Actifs, Churn Rate, CAC, ROAS
- [x] Tendances vs mois précédent avec indicateurs visuels (↑↓)
- [x] Sélecteur de mois (topbar) synchronisant tous les KPI
- [x] 4 onglets : REVENUS, ACQUISITION, MEMBRES, MÉTRIQUES
- [x] Graphiques Recharts : AreaChart, BarChart, LineChart, ComposedChart
- [x] ReferenceLine sur le mois sélectionné dans les graphiques

### Transactions (/transactions)
- [x] Tableau CRUD complet (date, description, catégorie, type, montant)
- [x] Séparation Membres vs Coaching via useCoachMembership hook
- [x] Ajout transaction via modal avec formulaire dynamique (catégories depuis DB)
- [x] Suppression → enregistrement dans excluded_recurring_expenses
- [x] Section "Transactions Exclues" avec restauration possible
- [x] Filtrage par type (Dépense/Revenu)

### Calculs Métier (backend)
- [x] Churn Rate = lost_members / (total_members + lost_members) * 100
- [x] CAC = marketing_spend / new_members
- [x] ROAS = total_revenue / ad_spend
- [x] Profit Margin = net_profit / total_revenue * 100

### UX
- [x] Dark mode (Obsidian #09090B) permanent
- [x] FR/EN switch dans topbar
- [x] Formatage fr-CH pour les devises (CHF)
- [x] Polices Barlow Condensed (titres) + IBM Plex Sans (corps)
- [x] data-testid sur tous les éléments interactifs

## Endpoints API
- `GET /api/init` - Vérifie si données existent
- `POST /api/seed` - Charge 12 mois de démo
- `GET/POST /api/monthly-kpis` - KPIs mensuels
- `GET/POST/DELETE /api/transactions` - Transactions
- `GET /api/categories` - Catégories
- `GET/DELETE /api/excluded` - Exclusions

## Backlog Prioritaire

### P0 (Critique)
- [ ] Authentification multi-clubs (JWT ou Supabase Auth)
- [ ] Import CSV transactions depuis Excel/Google Sheets

### P1 (Important)
- [ ] Mise à jour automatique des monthly_kpis depuis les transactions (recalcul)
- [ ] Mode temps réel via WebSocket ou SSE
- [ ] Export PDF/Excel du rapport mensuel

### P2 (Nice to have)
- [ ] Multi-clubs (workspace par club)
- [ ] Alertes email si churn > seuil
- [ ] Comparaison N-1 sur les graphiques
- [ ] Page Catégories avec gestion CRUD
- [ ] Objectifs/targets par KPI avec gauge charts

## Taux de réussite des tests
- Backend: 100% (12/12)
- Frontend: 90% (bug critique SelectItem value='' corrigé)
