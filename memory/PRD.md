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
- **Paiements** = tous billing members (inclut offerts 0 CHF avec status auto-paid)
- **Membres partis** : exit_date passee -> billing_enabled=False automatique
- **Membres expires** : subscription_end_date passee -> billing_enabled=False

## Etat Actuel (Mars 2026)
- Revenue: 6,912 CHF | Depenses: 2,417 CHF | Net: 4,495 CHF
- Membres actifs: 93 | Coachs: 29 | Expires: 4 | Partis: 195
- Recurents TOUS (coachs+clients): 84 membres / 17,075 CHF
- Recurents depenses: 9 categories / 500 CHF
- Plannings: 91 | Paiements: 91 (alignes)
- DUO: 40 fiches (20 couples, tous bidirectionnels)
- Offerts: 7 membres avec paiements 0 CHF auto-valides
- Nouveaux membres: 4 | CAC: 500 CHF | Cash entonnoir: 300 CHF

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
- [x] Audit final P0 (19 mars 2026):
  - [x] 11 membres partis billing desactive + Alexandra Dankova
  - [x] 18 couples DUO relies (+ 2 partenaires retrouves: Asma Fathi, Brice Maillard)
  - [x] Paiements 0 CHF crees pour offerts (91=91 aligne)
  - [x] Logique sync/generate payments mise a jour pour inclure offerts
- [x] Corrections 8 bugs (19 mars 2026):
  - [x] Caroline Maerten doublon supprime (GHL auto-tx)
  - [x] SALAIRES COACH migre vers SALAIRES COACHS (10 tx migrees)
  - [x] Recurrences KPI: coachs inclus + depenses categories
  - [x] Entonnoir cash corrige (4762 -> 300 CHF)
  - [x] Bilans compteur 60j corrige (next60Days)
  - [x] Bilans en retard: auto-generate calcule depuis contract_signed_date, avance jusqu'a periode courante (11 en retard visibles)
  - [x] Page /recurring: toutes recurrences (billing+templates+categories), 93 items
  - [x] Creation transaction: option is_recurring + creation template auto
- [x] Skip bilan (19 mars 2026):
  - [x] Bouton Skip + raison optionnelle sur bilans en retard/a venir/cette semaine
  - [x] Auto-planification du prochain bilan (date + frequence)
  - [x] Trace dans activity_logs du membre
- [x] Historique des actions dans fiche membre (19 mars 2026):
  - [x] Collection activity_logs avec member_id, action, description, user_name
  - [x] Endpoint GET /api/members/{id}/activity-log
  - [x] Modal Historique accessible depuis icone horloge sur chaque membre
  - [x] Actions logguees: bilan_skipped, bilan_completed, member_created, member_updated
- [x] Frequences bilans: hebdomadaire/mensuel/trimestriel/semestriel/annuel (default=mensuel)

## Corrections 7 Bugs Utilisateur (19 mars 2026 - Session 2)
- [x] Creneaux horaires CoursesPage: 1h -> 15 min (06:00, 06:15, 06:30... 21:00)
- [x] Bouton Skip bilans: window.prompt -> Dialog modal avec raison + confirmation
- [x] Client name dans mark-paid: champ client_name ajoute a la transaction creee
- [x] SALAIRES COACHS 0 CHF: 20 transactions nettoyees + garde dans generate_salary_expenses et generate_monthly_transactions
- [x] Donnees de test: aucune restante (Adrien Testa = vrai coach)
- [x] Budget mensuel: verifie fonctionnel (42 categories, donnees correctes)
- [x] UX Recurrences: texte explicatif ajoute dans la section Validation Mensuelle

## Backlog
- (P0) Integration Revolut Business API (synchronisation depenses)
- (P0) Mapping categories Revolut <-> TRANSFORM
- (P0) Integration API GoHighLevel + Notifications avancees
- (P2) Alertes WhatsApp via Twilio
- (P2) Interface migration CSV
- (P2) Metriques CPL, CPR, LTV
- (P3) Refactoring MembersPage.js (>1500 lignes)

## Credentials
- Email: test@crossfit.ch | Password: test123
