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

### 6. Payment System
- Payment Schedules: Define recurring payments per member
- Payment Tracking with status
- Late payment alerts
- Payment Generation

### 7. Onboarding & Follow-ups
- 5-Step Onboarding Checklist
- Follow-up Scheduling (monthly, onboarding, renewal, payment)

### 8. 6 Weeks Challenge (UPDATED March 2025)
- **Challenge types**: Fixed dates (group) or Personal (individual start dates)
- **Check-in goals**: Configurable weekly check-in target (1-7)
- Participant management with personal dates
- **Dual tracking**: Boolean week completion + Detailed weekly check-in counters
- Progress tracking per participant

### 9. Bilans / Suivis (UPDATED March 2025)
- **Multi-frequency**: Monthly, Quarterly, Semi-annual, Annual reviews
- **Type-based filtering** and color-coded badges
- Weight, nutrition, and training program tracking
- Auto-schedule next review based on frequency
- Complete review form with all metrics

### 10. Course KPIs
- Course definition by day/time slot
- Instructor/Coach assignment with hourly rates
- 5-Week Attendance Tracking (S1-S5)
- **Salary expense generation**: Auto-generate coach salary expenses from courses

### 11. Client KPIs
- Weekly training tracking per member
- Engagement levels

### 12. Coach Management
- Coach CRUD with hourly rates
- Replacement tracking
- Integration with Course KPIs

### 13. Data Reset (NEW March 2025)
- Reset all transactional data (members, payments, KPIs, etc.)
- Keep user account, settings, categories, types
- Requires "RESET" confirmation

### 14. Settings & Configuration
- Club info, KPI targets
- Subscription types management
- Member types management
- Custom KPI columns
- Expense categories

## Technical Architecture

### Backend (FastAPI)
```
/app/backend/
├── server.py              # Main routes (KPIs, transactions, courses, etc.)
├── core/
│   ├── config.py          # Database & constants
│   └── security.py        # JWT & password handling
├── models/
│   ├── auth.py
│   ├── kpi.py
│   ├── transactions.py
│   ├── members.py         # + review_frequency
│   ├── challenges.py      # + challenge_type, checkins_goal, personal dates
│   ├── courses.py
│   ├── payments.py
│   ├── coaches.py
│   ├── subscription_types.py
│   ├── kpi_columns.py
│   └── settings.py
├── routers/
│   ├── auth.py
│   ├── members.py
│   ├── payments.py
│   ├── annual_reviews.py  # Multi-frequency reviews
│   ├── followups.py
│   ├── onboarding.py
│   ├── settings.py        # + reset-data endpoint
│   ├── coaches.py
│   └── challenges.py      # NEW - extracted from server.py
└── tests/
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── Dashboard.js
│   ├── ComparePage.js
│   ├── MembersPage.js        # + review_frequency selector
│   ├── PaymentsPage.js
│   ├── OnboardingPage.js
│   ├── AnnualReviewsPage.js  # Renamed "Bilans / Suivis" + type filter
│   ├── ChallengePage.js      # + challenge_type, checkins_goal, personal dates
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

## Changelog

### March 2025 - Session 4 (Current)
- ✅ **Phase 3: 6 Weeks Challenge Enhancement**
  - challenge_type: "fixed" (group dates) or "personal" (individual dates)
  - checkins_goal: configurable 1-7 check-ins per week
  - personal_start_date / personal_end_date per participant
  - week1_checkins...week6_checkins integer counters (0-7)
  - Detailed check-in modal with weekly counters
  - Type badges in challenge list (Date fixe / Personnel)
  - Extracted routes from server.py to routers/challenges.py
  
- ✅ **Phase 4: Reviews/Bilans Enhancement**
  - Renamed "Bilans Annuels" to "Bilans / Suivis"
  - review_type field: monthly, quarterly, semi-annually, annually
  - review_frequency on member model
  - Type filter dropdown in reviews page
  - Color-coded type badges (Mensuel/Trimestriel/Semestriel/Annuel)
  - Auto-schedule next review based on frequency after completion
  - Updated sidebar navigation label
  
- ✅ **Phase 5: Data Reset**
  - POST /api/settings/reset-data with {confirm: "RESET"}
  - Deletes all transactional data while keeping config
  - Settings page "Zone dangereuse" section with confirmation modal
  
- ✅ **Coach Salary Integration**
  - POST /api/courses/generate-salary-expenses/{year}/{month}
  - Calculates coach remuneration from course hours × hourly rate
  - Auto-creates "SALAIRES COACHS" category
  - Generates expense transactions per coach
  - "Générer dépenses salaires coachs" button on Courses page

### March 2025 - Session 3
- ✅ Billing Cycle integration
- ✅ Annual Reviews dashboard
- ✅ Backend refactoring to modular routers
- ✅ Settings/Types configuration
- ✅ UX improvements (member form, onboarding)

### December 2024 - Session 2
- ✅ Payment System
- ✅ Onboarding 5-step checklist
- ✅ Follow-up scheduling
- ✅ Alerts summary

### December 2024 - Session 1
- ✅ Members, Challenges, Courses, Client KPIs
- ✅ Backend modular structure

## Backlog

### P1 - High Priority
- [ ] Finaliser la refactorisation backend (migrer routes restantes de server.py)
- [ ] Email notifications (Resend - en attente clé API)
- [ ] Export member data to CSV

### P2 - Medium Priority
- [ ] Graphiques d'évolution pour l'historique des bilans
- [ ] Alertes WhatsApp via Twilio (en attente instructions utilisateur)
- [ ] Interface de migration de données "Lovable"
- [ ] Real-time updates with WebSockets
- [ ] Automatisation des renouvellements d'abonnements

### P3 - Low Priority
- [ ] Mobile app / PWA
- [ ] Integration with booking systems (bsport, hubfit)
- [ ] Multi-currency support

## Testing Status
- Backend: 18/18 tests passing (Phase 3 & 4) ✅
- Frontend: 100% functional ✅
- Test files: /app/test_reports/iteration_11.json (latest)
