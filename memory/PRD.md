# Sheet KPI Buddy - Product Requirements Document

## Overview
Application SaaS de pilotage financier pour clubs de sport.

## Core Features

### 1. Authentication & Multi-tenancy
- JWT-based authentication, data isolation by club_id

### 2. Monthly KPIs Dashboard
- Revenue/expense tracking, advanced metrics, PDF reports, multi-month comparison

### 3. Transaction Management
- CRUD, categories, auto-recalculation, bulk import, recurring transactions

### 4. Member Management
- Full CRUD, subscription dates, member types, billing cycle, renewal workflow
- **Duo Subscriptions**: 2 members linked, 1 price, auto-partner creation
- Review frequency: monthly/quarterly/semi-annually/annually

### 5. Payment System
- Schedules, tracking, alerts, **email reminders via Resend**

### 6. Onboarding & Follow-ups
- 5-Step checklist, follow-up scheduling

### 7. 6 Weeks Challenge
- Fixed/Personal types, configurable check-in goals, dual tracking

### 8. Bilans / Suivis
- Multi-frequency reviews, type filtering, **history charts**, auto-scheduling
- **Email reminders for upcoming reviews**

### 9. Course KPIs
- Course definition, instructor assignment, attendance, salary expense generation

### 10. Client KPIs
- Weekly training tracking, engagement levels

### 11. Global Attendance
- Grid view: members × weeks, editable session counts, color coding, totals

### 12. Coach Management
- Coach CRUD, replacement tracking

### 13. Email Notifications (Resend)
- Payment reminders, review reminders, follow-up reminders
- Custom email sending, bulk notifications
- Notification logs, HTML templates with club branding
- Note: Requires verified domain for production use

### 14. Data Reset
- Reset transactional data, keep config

### 15. Settings & Configuration
- Club info, KPI targets, subscription/member types, custom KPI columns

### 16. Sidebar Navigation
- 6 grouped sections: Pilotage, Membres, Activité, Programmes, Comptabilité, Configuration
- Collapsible sidebar

## Technical Architecture

### Backend (FastAPI) - 16 router files
```
/app/backend/routers/
├── auth.py, members.py, payments.py, annual_reviews.py
├── followups.py, onboarding.py, settings.py, coaches.py
├── challenges.py, kpis.py, transactions.py, trainings.py
├── courses.py, alerts.py, reports.py, notifications.py (NEW)
```

### Frontend (React) - 17 pages
```
/app/frontend/src/pages/
├── Dashboard.js, ComparePage.js, MembersPage.js, PaymentsPage.js
├── OnboardingPage.js, AnnualReviewsPage.js, ChallengePage.js
├── CoursesPage.js, CoachesPage.js, ClientKPIPage.js, AttendancePage.js
├── TransactionsPage.js, RecurringPage.js, CategoriesPage.js
├── SettingsPage.js, SettingsTypesPage.js, AuthPage.js
```

## Backlog

### P1 - High Priority
- [ ] Intégration API Bsport (en attente agreement formulaire utilisateur)
- [ ] Export member data to CSV
- [ ] Vérifier domaine Resend pour envoi en production

### P2 - Medium Priority
- [ ] Alertes WhatsApp via Twilio (en attente)
- [ ] Interface de migration de données
- [ ] WebSockets temps réel
- [ ] Automatisation renouvellements

### P3 - Low Priority
- [ ] Mobile app / PWA
- [ ] Multi-currency support
- [ ] Dashboard coach personnel

## Testing Status
- Iteration 14: 20/20 backend + 100% frontend ✅ (sidebar + notifications)
- Iteration 13: 11/11 backend + 100% frontend ✅ (attendance)
- Iteration 12: 17/17 backend + 100% frontend ✅ (refactoring + duo + charts)
