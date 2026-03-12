# Sheet KPI Buddy - Product Requirements Document

## Overview
Application SaaS de pilotage financier pour clubs de sport, permettant le suivi des KPIs, la gestion des membres, des transactions, des paiements et des abonnements.

## Core Features

### 1. Authentication & Multi-tenancy
- JWT-based authentication (register/login)
- Data isolation by club_id
- Club name customization

### 2. Monthly KPIs Dashboard
- Main dashboard with revenue/expense tracking
- Advanced metrics (churn, CAC, ROAS, profit margin)
- Detailed KPI view with 30+ fields
- Multi-month comparison view (/compare)
- PDF report generation

### 3. Transaction Management
- CRUD for transactions
- Category mapping to KPI columns
- Auto-recalculation of monthly KPIs
- Bulk import support

### 4. Recurring Transactions
- Define recurring expenses/revenues
- Monthly generation with day specification

### 5. Member Management
- Full CRUD for members
- Contract signature date tracking
- Subscription expiration dates
- Member types (Généraux Récurrents, PIF, PT)
- Expiring members filter (30 days)
- Renewal workflow with history
- Billing Cycle Integration (monthly_day, interval_days)
- Review frequency: monthly, quarterly, semi-annually, annually
- **Duo Subscriptions**: 2 members linked, 1 price, auto-partner creation

### 6. Payment System
- Payment Schedules: Define recurring payments per member
- Payment Tracking with status
- Late payment alerts
- Payment Generation

### 7. Onboarding & Follow-ups
- 5-Step Onboarding Checklist
- Follow-up Scheduling (monthly, onboarding, renewal, payment)

### 8. 6 Weeks Challenge
- Challenge types: Fixed dates (group) or Personal (individual start dates)
- Check-in goals: Configurable weekly check-in target (1-7)
- Participant management with personal dates
- Dual tracking: Boolean week completion + Detailed weekly check-in counters
- Progress tracking per participant

### 9. Bilans / Suivis
- Multi-frequency: Monthly, Quarterly, Semi-annual, Annual reviews
- Type-based filtering and color-coded badges
- Weight, nutrition, and training program tracking
- Auto-schedule next review based on frequency
- **History Charts**: LineChart evolution for weight, body composition, training frequency

### 10. Course KPIs
- Course definition by day/time slot
- Instructor/Coach assignment with hourly rates
- 5-Week Attendance Tracking (S1-S5)
- Salary expense generation: Auto-generate coach salary expenses from courses

### 11. Client KPIs
- Weekly training tracking per member
- Engagement levels

### 12. Coach Management
- Coach CRUD with hourly rates
- Replacement tracking
- Integration with Course KPIs

### 13. Data Reset
- Reset all transactional data
- Keep user account, settings, categories, types
- Requires "RESET" confirmation

### 14. Settings & Configuration
- Club info, KPI targets
- Subscription types management
- Member types management
- Custom KPI columns
- Expense categories

## Technical Architecture

### Backend (FastAPI) - FULLY REFACTORED
```
/app/backend/
├── server.py              # ~210 lines (seed, settings, init only)
├── core/
│   ├── config.py          # Database & constants
│   └── security.py        # JWT & password handling
├── models/
│   ├── auth.py
│   ├── kpi.py
│   ├── transactions.py
│   ├── members.py         # + is_duo, duo_partner_id, duo_primary, review_frequency
│   ├── challenges.py      # + challenge_type, checkins_goal, personal dates
│   ├── courses.py
│   ├── payments.py
│   ├── coaches.py
│   ├── subscription_types.py
│   ├── kpi_columns.py
│   └── settings.py
├── routers/
│   ├── auth.py
│   ├── members.py         # + duo auto-partner creation
│   ├── payments.py
│   ├── annual_reviews.py  # + history endpoint + multi-frequency
│   ├── followups.py
│   ├── onboarding.py
│   ├── settings.py        # + reset-data
│   ├── coaches.py
│   ├── challenges.py      # Extracted from server.py
│   ├── kpis.py            # NEW - Extracted from server.py
│   ├── transactions.py    # NEW - Extracted from server.py
│   ├── trainings.py       # NEW - Extracted from server.py
│   ├── courses.py         # NEW - Extracted from server.py
│   ├── alerts.py          # NEW - Extracted from server.py
│   └── reports.py         # NEW - Extracted from server.py
└── tests/
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── Dashboard.js
│   ├── ComparePage.js
│   ├── MembersPage.js        # + duo checkbox, partner fields, DUO badge
│   ├── PaymentsPage.js
│   ├── OnboardingPage.js
│   ├── AnnualReviewsPage.js  # + type filter, history charts (LineChart)
│   ├── ChallengePage.js      # + challenge_type, personal dates
│   ├── CoursesPage.js        # + salary generation button
│   ├── CoachesPage.js
│   ├── ClientKPIPage.js
│   ├── TransactionsPage.js
│   ├── RecurringPage.js
│   ├── CategoriesPage.js
│   ├── SettingsPage.js       # + data reset section
│   ├── SettingsTypesPage.js
│   └── AuthPage.js
├── components/
│   ├── Layout.js             # Updated sidebar labels
│   └── ui/
├── contexts/
└── hooks/
```

## Backlog

### P1 - High Priority
- [ ] Saisie globale des séances (vue tableau de présence)
- [ ] Intégration API Bsport (en attente des infos utilisateur)
- [ ] Email notifications (Resend - en attente clé API)
- [ ] Export member data to CSV

### P2 - Medium Priority
- [ ] Alertes WhatsApp via Twilio (en attente instructions utilisateur)
- [ ] Interface de migration de données
- [ ] Real-time updates with WebSockets
- [ ] Automatisation des renouvellements d'abonnements

### P3 - Low Priority
- [ ] Mobile app / PWA
- [ ] Integration with booking systems
- [ ] Multi-currency support

## Testing Status
- Backend: 17/17 tests passing (iteration_12) ✅
- Frontend: 100% functional ✅
- Test files: /app/test_reports/iteration_12.json (latest)
