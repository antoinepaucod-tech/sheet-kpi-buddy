# Sheet KPI Buddy - Product Requirements Document

## Overview
Application SaaS de pilotage financier pour clubs de sport, permettant le suivi des KPIs, la gestion des membres, des transactions et des abonnements.

## Core Features

### 1. Authentication & Multi-tenancy
- **Status**: ✅ Implemented
- JWT-based authentication (register/login)
- Data isolation by club_id
- Club name customization

### 2. Monthly KPIs Dashboard
- **Status**: ✅ Implemented
- Main dashboard with revenue/expense tracking
- Advanced metrics (churn, CAC, ROAS, profit margin)
- Detailed KPI view with 30+ fields (funnel, members by type, expenses)
- Multi-month comparison view (/compare)
- PDF report generation

### 3. Transaction Management
- **Status**: ✅ Implemented
- CRUD for transactions
- Category mapping to KPI columns
- Auto-recalculation of monthly KPIs
- Bulk import support

### 4. Recurring Transactions
- **Status**: ✅ Implemented
- Define recurring expenses/revenues
- Monthly generation with day specification
- Exclusion system (deleted transactions not regenerated)

### 5. Member Management (ExpiringSubscriptions)
- **Status**: ✅ Implemented (Dec 2024)
- Full CRUD for members
- Contract signature date tracking
- Subscription expiration dates
- Member types (Généraux Récurrents, PIF, PT)
- Expiring members filter (30 days)
- Renewal workflow with history
- Frontend page at /members

### 6. 6 Weeks Challenge (SixWeeksChallenge)
- **Status**: ✅ Implemented (Dec 2024)
- Challenge CRUD with start/end dates
- Participant management
- Weekly check-ins (week1-week6)
- Progress tracking per participant
- Frontend page at /challenge

### 7. Course KPIs (KPICourses)
- **Status**: ✅ Implemented (Dec 2024)
- Course definition by day/time slot
- Instructor assignment
- Weekly attendance tracking (week1-week5)
- Automatic attendance rate calculation
- Monthly expenses per course
- Summary statistics by month
- Frontend page at /courses

### 8. Client KPIs (KPIClient)
- **Status**: ✅ Implemented (Dec 2024)
- Weekly training tracking per member
- Engagement levels (Excellent/Bon/Moyen/Faible)
- Training summary with averages
- Historical chart
- Quick entry for recent weeks
- Frontend page at /clients

### 9. Instructor Management
- **Status**: ✅ Implemented (Dec 2024)
- CRUD for instructors
- Hourly rate tracking
- Active/inactive status

## Technical Architecture

### Backend (FastAPI)
```
/app/backend/
├── server.py              # Main routes (~1074 lines, refactored)
├── core/
│   ├── config.py          # Database & constants
│   └── security.py        # JWT & password handling
├── models/
│   ├── auth.py           # User models
│   ├── kpi.py            # MonthlyKPI, ClubSettings
│   ├── transactions.py   # Transaction, Category, Recurring
│   ├── members.py        # CustomerMember, WeeklyTraining
│   ├── challenges.py     # SixWeeksChallenge, ChallengeParticipant
│   └── courses.py        # CourseKPI, Instructor
└── tests/
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── Dashboard.jsx        # Main KPI dashboard
│   ├── ComparePage.jsx      # Multi-month comparison
│   ├── MembersPage.js       # Member management
│   ├── ChallengePage.js     # 6 weeks challenge
│   ├── CoursesPage.js       # Course KPIs
│   ├── ClientKPIPage.js     # Client engagement
│   ├── TransactionsPage.jsx
│   ├── RecurringPage.jsx
│   └── ...
├── contexts/
│   ├── AuthContext.js
│   └── LanguageContext.js
└── components/ui/           # shadcn components
```

### Database (MongoDB)
Collections:
- `users` - User accounts
- `monthly_kpis` - Monthly financial data
- `accounting_transactions` - Individual transactions
- `accounting_categories` - Category definitions
- `recurring_transactions` - Recurring definitions
- `excluded_recurring_expenses` - Exclusion list
- `customer_members` - Member profiles
- `member_renewals` - Renewal history
- `weekly_trainings` - Training records
- `six_weeks_challenges` - Challenge definitions
- `challenge_participants` - Challenge enrollment
- `course_kpis` - Course attendance data
- `instructors` - Instructor profiles
- `club_settings` - Club configuration

## API Endpoints Summary

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/club-name

### KPIs
- GET/POST /api/monthly-kpis
- POST /api/monthly-kpis/bulk
- GET /api/report/pdf/{month}

### Members
- GET/POST /api/members
- GET /api/members/expiring
- POST /api/members/{id}/renew
- GET /api/members/{id}/renewals

### Challenges
- GET/POST /api/challenges
- POST /api/challenges/{id}/participants
- PUT /api/challenges/{id}/participants/{pid}

### Courses
- GET/POST /api/courses
- GET /api/courses/summary/{year}/{month}
- GET/POST /api/instructors

### Trainings
- GET/POST /api/trainings
- GET /api/trainings/summary/{member_id}

## Backlog

### P1 - High Priority
- [ ] Data import wizard for migrating existing data
- [ ] Automatic subscription renewal reminders

### P2 - Medium Priority
- [ ] Real-time updates with WebSockets
- [ ] User/admin management interface
- [ ] Advanced reporting (custom date ranges)
- [ ] Email notifications for expiring subscriptions

### P3 - Low Priority
- [ ] Mobile app / PWA
- [ ] Integration with booking systems (bsport, hubfit)
- [ ] Multi-currency support

## Changelog

### December 2024
- ✅ Implemented 4 major features: Members, Challenges, Courses, Client KPIs
- ✅ Refactored backend: split 1938-line monolith into modular structure
- ✅ Added QueryClientProvider to App.js
- ✅ Testing: 100% pass rate (22/22 backend tests)
