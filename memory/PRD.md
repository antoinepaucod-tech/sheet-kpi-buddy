# Sheet KPI Buddy - Product Requirements Document

## Overview
Application SaaS de pilotage financier pour clubs de sport, permettant le suivi des KPIs, la gestion des membres, des transactions, des paiements et des abonnements.

## Core Features

### 1. Authentication & Multi-tenancy
- JWT-based authentication (register/login)
- Data isolation by club_id

### 2. Monthly KPIs Dashboard
- Main dashboard with revenue/expense tracking
- Advanced metrics (churn, CAC, ROAS, profit margin)
- Multi-month comparison view, PDF report generation

### 3. Transaction Management
- CRUD, category mapping, auto-recalculation, bulk import

### 4. Recurring Transactions
- Define recurring expenses/revenues, monthly generation

### 5. Member Management
- Full CRUD, contract tracking, subscription dates
- Member types, renewal workflow, billing cycle
- Review frequency: monthly/quarterly/semi-annually/annually
- **Duo Subscriptions**: 2 members linked, 1 price, auto-partner creation

### 6. Payment System
- Payment schedules, tracking, late payment alerts

### 7. Onboarding & Follow-ups
- 5-Step checklist, follow-up scheduling

### 8. 6 Weeks Challenge
- Fixed/Personal types, configurable check-in goals
- Dual tracking (boolean + counters), personal dates

### 9. Bilans / Suivis
- Multi-frequency reviews with type filtering
- **History Charts**: LineChart evolution (weight, body comp, training freq)
- Auto-schedule next review

### 10. Course KPIs
- Course definition, instructor assignment, attendance tracking
- **Salary expense generation** from courses

### 11. Client KPIs
- Weekly training tracking, engagement levels

### 12. Global Attendance (NEW)
- Grid view: members × weeks
- Editable session counts with color coding
- Totals per member and per week
- Week navigation and year selection

### 13. Coach Management
- Coach CRUD, replacement tracking

### 14. Data Reset
- Reset all transactional data, keep config

### 15. Settings & Configuration
- Club info, KPI targets, subscription types, member types, custom KPI columns

## Technical Architecture

### Backend (FastAPI) - FULLY REFACTORED
```
/app/backend/
├── server.py              # ~210 lines (seed, settings, init only)
├── core/
│   ├── config.py
│   └── security.py
├── models/ (10 files)
├── routers/ (15 files)
│   ├── auth.py, members.py, payments.py, annual_reviews.py
│   ├── followups.py, onboarding.py, settings.py, coaches.py
│   ├── challenges.py, kpis.py, transactions.py, trainings.py
│   ├── courses.py, alerts.py, reports.py
└── tests/
```

### Frontend (React)
```
/app/frontend/src/pages/ (17 files)
├── Dashboard.js, ComparePage.js, MembersPage.js, PaymentsPage.js
├── OnboardingPage.js, AnnualReviewsPage.js, ChallengePage.js
├── CoursesPage.js, CoachesPage.js, ClientKPIPage.js
├── AttendancePage.js (NEW), TransactionsPage.js, RecurringPage.js
├── CategoriesPage.js, SettingsPage.js, SettingsTypesPage.js, AuthPage.js
```

## Backlog

### P1 - High Priority
- [ ] Intégration API Bsport (en attente des infos utilisateur)
- [ ] Email notifications (Resend - en attente clé API)
- [ ] Export member data to CSV

### P2 - Medium Priority
- [ ] Alertes WhatsApp via Twilio (en attente)
- [ ] Interface de migration de données
- [ ] Real-time updates (WebSockets)
- [ ] Automatisation renouvellements

### P3 - Low Priority
- [ ] Mobile app / PWA
- [ ] Multi-currency support

## Testing Status
- Iteration 13: 11/11 backend + 100% frontend ✅
- Iteration 12: 17/17 backend + 100% frontend ✅
- Iteration 11: 18/18 backend + 100% frontend ✅
