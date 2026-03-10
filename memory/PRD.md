# Sheet KPI Buddy - Product Requirements Document

## Overview
Application SaaS de pilotage financier pour clubs de sport, permettant le suivi des KPIs, la gestion des membres, des transactions, des paiements et des abonnements.

## Core Features

### 1. Authentication & Multi-tenancy ✅
- JWT-based authentication (register/login)
- Data isolation by club_id
- Club name customization

### 2. Monthly KPIs Dashboard ✅
- Main dashboard with revenue/expense tracking
- Advanced metrics (churn, CAC, ROAS, profit margin)
- Detailed KPI view with 30+ fields (funnel, members by type, expenses)
- Multi-month comparison view (/compare)
- PDF report generation

### 3. Transaction Management ✅
- CRUD for transactions
- Category mapping to KPI columns
- Auto-recalculation of monthly KPIs
- Bulk import support

### 4. Recurring Transactions ✅
- Define recurring expenses/revenues
- Monthly generation with day specification
- Exclusion system

### 5. Member Management ✅
- Full CRUD for members
- Contract signature date tracking
- Subscription expiration dates
- Member types (Généraux Récurrents, PIF, PT)
- Expiring members filter (30 days)
- Renewal workflow with history
- **Billing Cycle Integration** ✅ (NEW - March 2025):
  - Type: Jour fixe du mois (monthly_day) ou Intervalle jours (interval_days)
  - Valeur: Jour 1-28 ou intervalle en jours (ex: 28)
  - Création automatique du payment_schedule
  - Modification du cycle lors du renouvellement
- **Annual Review (Bilan Annuel)** ✅ (NEW - March 2025):
  - Activable par membre (annual_review_enabled)
  - Planification automatique 1 an après la signature
  - Création d'un nouveau bilan lors du renouvellement
  - Suivi: poids, nutrition, programme d'entraînement

### 6. Payment System ✅ (NEW - Dec 2024)
- **Payment Schedules**: Define recurring payments per member
  - Monthly day (ex: le 15 du mois)
  - Interval days (ex: tous les 28 jours)
  - Payment methods: prélèvement, carte, virement, espèces
- **Payment Tracking**: 
  - Status: En attente, Payé, En retard, Échoué, Annulé
  - Late payment alerts with days overdue
  - Mark as paid with date and reference
- **Payment Generation**: Generate monthly payments from schedules
- **Alerts**: Late payments dashboard with contact info

### 7. Onboarding & Follow-ups ✅ (NEW - Dec 2024)
- **5-Step Onboarding Checklist**:
  - Inscription bsport
  - Inscription Hubfit
  - Consultation nutrition
  - Questionnaire coaching
  - Session d'introduction
- **Progress Tracking**: Visual progress per member (0-100%)
- **Follow-up Scheduling**:
  - Types: mensuel, onboarding, renouvellement, paiement
  - Status: planifié, complété, manqué, reporté
  - Auto-schedule next follow-up on completion
- **Reminders**: Upcoming and missed follow-ups views

### 8. 6 Weeks Challenge ✅
- Challenge CRUD with start/end dates
- Participant management
- Weekly check-ins (week1-week6)
- Progress tracking per participant

### 9. Course KPIs ✅
- Course definition by day/time slot
- Instructor assignment
- **5-Week Attendance Tracking** (S1-S5) - Updated for months with 5 weeks
- Automatic attendance rate calculation
- Monthly expenses per course
- Summary statistics by month

### 10. Client KPIs ✅
- Weekly training tracking per member
- Engagement levels (Excellent/Bon/Moyen/Faible)
- Training summary with averages
- Historical chart

### 11. Alerts Summary ✅ (NEW - Dec 2024)
- Aggregated dashboard showing:
  - Late payments count
  - Missed follow-ups count
  - Expiring subscriptions (30 days)
  - Incomplete onboarding count
  - Upcoming follow-ups count

## Technical Architecture

### Backend (FastAPI)
```
/app/backend/
├── server.py              # Main routes (~1400 lines)
├── core/
│   ├── config.py          # Database & constants
│   └── security.py        # JWT & password handling
├── models/
│   ├── auth.py           # User models
│   ├── kpi.py            # MonthlyKPI, ClubSettings
│   ├── transactions.py   # Transaction, Category, Recurring
│   ├── members.py        # CustomerMember, WeeklyTraining, MemberFollowUp
│   ├── challenges.py     # SixWeeksChallenge, ChallengeParticipant
│   ├── courses.py        # CourseKPI, Instructor
│   └── payments.py       # PaymentSchedule, Payment (NEW)
└── tests/
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── Dashboard.jsx
│   ├── ComparePage.jsx
│   ├── MembersPage.js
│   ├── PaymentsPage.js        (NEW)
│   ├── OnboardingPage.js      (NEW)
│   ├── ChallengePage.js
│   ├── CoursesPage.js         (Updated with S5)
│   ├── ClientKPIPage.js
│   ├── TransactionsPage.jsx
│   ├── RecurringPage.jsx
│   └── ...
├── contexts/
└── components/ui/
```

### Database (MongoDB)
Collections:
- `users`, `monthly_kpis`, `accounting_transactions`, `accounting_categories`
- `recurring_transactions`, `excluded_recurring_expenses`
- `customer_members`, `member_renewals`, `weekly_trainings`
- `six_weeks_challenges`, `challenge_participants`
- `course_kpis`, `instructors`
- `payment_schedules` (NEW)
- `payments` (NEW)
- `member_followups` (NEW)
- `club_settings`

## API Endpoints Summary

### New Endpoints (Dec 2024)
- Payment Schedules: GET/POST/PUT/DELETE `/api/payment-schedules`
- Payments: GET/POST `/api/payments`, POST `/api/payments/{id}/mark-paid`
- Payment Alerts: GET `/api/payments/late`, `/api/payments/upcoming`
- Payment Generation: POST `/api/payments/generate/{year}/{month}`
- Onboarding: GET `/api/onboarding/pending`, PUT `/api/members/{id}/onboarding`
- Follow-ups: GET/POST `/api/followups`, POST `/api/followups/{id}/complete`
- Follow-up Alerts: GET `/api/followups/upcoming`, `/api/followups/missed`
- Alerts Summary: GET `/api/alerts/summary`

## Testing Status
- Backend: 33/33 tests passing ✅
- Frontend: 100% functional ✅
- Test files: `/app/test_reports/iteration_10.json` (latest)

## Backlog

### P0 - Immediate (Refactoring)
- [ ] Split server.py routes into separate router files (/routers/members.py, /routers/payments.py, etc.)

### P1 - High Priority
- [ ] Email notifications (Resend integration ready, needs API key)
- [ ] Auto-send payment reminders
- [ ] Data migration tool from Lovable app
- [ ] Export member data to CSV

### P2 - Medium Priority
- [ ] Real-time updates with WebSockets
- [ ] User/admin management interface
- [ ] Advanced reporting (custom date ranges)

### P3 - Low Priority
- [ ] Mobile app / PWA
- [ ] Integration with booking systems (bsport, hubfit)
- [ ] Multi-currency support

## Changelog

### March 2025 - Session 3
- ✅ Added Billing Cycle integration in member creation/edit form
  - billing_cycle_type: monthly_day or interval_days
  - billing_cycle_value: day of month (1-28) or interval in days
  - Auto-creation of payment_schedule when billing_enabled=true
- ✅ Added billing cycle update option in renewal modal
  - "Modifier le cycle de facturation" toggle
  - Update amount, method, cycle type and value during renewal
- ✅ Added Annual Review (Bilan Annuel) system
  - annual_review_enabled toggle in member form
  - Auto-schedule review 1 year from contract date
  - New review created on each renewal
  - Tracks weight, nutrition, program adjustments

### December 2024 - Session 2
- ✅ Added Payment System with schedules (28-day intervals & monthly)
- ✅ Added Onboarding 5-step checklist with progress tracking
- ✅ Added Follow-up scheduling system with 4 types
- ✅ Added Alerts summary endpoint
- ✅ Updated Courses page with S5 column for 5-week months
- ✅ Added Resend email integration (ready for API key)

### December 2024 - Session 1
- ✅ Implemented 4 major features: Members, Challenges, Courses, Client KPIs
- ✅ Refactored backend: split monolith into modular structure
- ✅ Added QueryClientProvider to App.js
