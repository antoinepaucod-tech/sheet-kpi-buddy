# TRANSFORM - Product Requirements Document

## Application
SaaS de pilotage financier pour clubs de sport. React + FastAPI + MongoDB.

## Architecture
```
/app/
├── backend/
│   ├── routers/
│   │   ├── annual_reviews.py   # Bilans/suivis, generation auto, alertes
│   │   ├── kpis.py             # KPIs Dashboard, calculs temps reel, details
│   │   ├── members.py          # CRUD membres, DUO, dissociation
│   │   ├── notifications.py    # Emails (Resend)
│   │   ├── payments.py         # Paiements, sync, mark-paid->transaction
│   │   └── courses.py          # Planning cours, types de cours
│   └── models/
│       └── kpi.py              # compute_metrics: CAC=(PUBLICITE+MARKETING)/new
└── frontend/src/
    ├── pages/
    │   ├── Dashboard.js        # KPIs, graphiques, membres
    │   ├── MembersPage.js      # Membres, DUO primary/partner logic
    │   ├── PaymentsPage.js     # Paiements synchronises
    │   ├── AttendancePage.js   # Seances, commence S1 2026
    │   ├── CoursesPage.js      # Planning cours, dropdown categories
    │   ├── OnboardingPage.js   # Taches d'onboarding
    │   └── ClientKPIPage.js    # KPIs clients
    └── components/
        └── KPIDetailedView.js  # Collapsible recurring, sans validation
```

## Regles Metier Cles
- **Source de verite recurents** : `billing_enabled=true` sur fiche membre
- **CAC** = (PUBLICITE + MARKETING) / nouveaux membres
- **Nouveaux membres** : Exclu coachs, HUBFIT, renouvellements
- **Paiement valide -> Revenue** : mark-paid cree une transaction revenue + recalcule KPI
- **DUO Primary** : Edition directe, propagation au partenaire
- **DUO Partner** : Dialogue dissociation -> 2 abonnements individuels
- **Plannings** = tous billing members (inclut coachs et offerts)
- **Paiements** = billing members avec amount > 0

## Etat Actuel (Mars 2026)
- Revenue: 5,062 CHF | Depenses: 2,170 CHF | Net: 2,892 CHF
- Membres actifs: 91-93 | Coachs: 29
- Recurents (hors coachs): 60 membres / 8,645 CHF
- Plannings: 92 | Paiements: 85
- Nouveaux membres: 4
- CAC: 500 CHF

## Taches Completees
- [x] Audit complet et corrections de donnees (exit_date, billing)
- [x] Suppression Jonathan Bret
- [x] Fix KPI member counts historiques (etaient figes a 80)
- [x] Nettoyage KPIs 2027 fantomes
- [x] Nouvelle logique nouveaux membres (exclu coachs/HUBFIT/renouvellements)
- [x] CAC = PUBLICITE + MARKETING
- [x] DUO: Primary=edition directe+propagation, Partner=dissociation
- [x] Sync paiements avec membres (endpoint POST /api/payments/sync-with-members)
- [x] Paiement valide -> transaction revenue -> recalcul KPI
- [x] Dashboard details: toggle repliable, pas de validation
- [x] Categories de cours (dropdown KPI Cours)
- [x] Fix page Seances (annee 2026, S1, navigation)
- [x] Bilans sync avec membres (partis supprimes, actifs actives)
- [x] ABONNEMENT OFFERT category + 7 membres offerts

## Backlog
- (P0) Integration API GoHighLevel + Notifications avancees
- (P1) Suppression page Plannings (/recurring) redondante
- (P2) Alertes WhatsApp via Twilio
- (P2) Interface migration CSV
- (P2) Metriques CPL, CPR, LTV
- (P3) Refactoring MembersPage.js (>1400 lignes)

## Credentials
- Email: test@crossfit.ch | Password: test123
