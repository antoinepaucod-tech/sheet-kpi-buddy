# TRANSFORM - Product Requirements Document

## Overview
Application SaaS de pilotage financier pour clubs de sport. Anciennement "Sheet KPI Buddy" / "TheCoach", renommee "TRANSFORM".

## Core Features (18 modules)
1. **Authentication** - JWT, multi-tenancy (club_id isolation)
2. **KPIs Dashboard** - Revenue/expense, advanced metrics, PDF export, comparison
3. **Transactions** - CRUD, categories, auto-recalc, bulk, recurring
4. **Members** - CRUD, subscriptions, billing, Duo, review frequency
5. **Payments** - Schedules, tracking, alerts, email reminders
6. **Onboarding** - 5-step checklist, follow-ups
7. **6 Weeks Challenge** - Fixed/Personal types, check-in goals
8. **Bilans / Suivis** - Multi-frequency, history charts, email reminders
9. **Course KPIs** - Attendance, instructors, salary generation
10. **Client KPIs** - Weekly training, engagement
11. **Global Attendance** - Grid view, editable, color-coded
12. **Coach Management** - CRUD, hourly rates, replacements
13. **Messagerie & Notifications** - Resend emails, templates, logs, compose, bulk
14. **Data Reset** - Reset transactional data, keep config
15. **Settings** - Club info, KPI targets, types, columns
16. **Sidebar Navigation** - 7 grouped sections, collapsible

## Architecture
- **Backend**: FastAPI, 16 router files, modular architecture
- **Frontend**: React, 18 pages, shadcn/ui, Recharts, TanStack Query
- **Database**: MongoDB
- **Email**: Resend (domain: thecoachswitzerland.ch)

## Design System - TRANSFORM (Apple-Inspired)
### Colors
- `--color-bg-primary`: #000000 (body/page)
- `--color-bg-secondary`: #1C1C1E (cards/surfaces)
- `--color-bg-tertiary`: #2C2C2E (inputs/elevated)
- `--color-bg-elevated`: #3A3A3C
- `--color-accent`: #0A84FF (Transform signature blue)
- `--color-success`: #30D158
- `--color-warning`: #FFD60A
- `--color-danger`: #FF453A
- `--color-info`: #64D2FF

### Typography
- Display/Headings: Inter (SF Pro fallback)
- Body: Inter
- Data/KPIs: JetBrains Mono (SF Mono fallback)
- Headings: letter-spacing -0.02em
- Labels: UPPERCASE, 11px, letter-spacing 0.06em

### Radius
- Cards: 16px (`--radius-lg`)
- Buttons/Inputs: 12px (`--radius-md`)
- Tags/Badges: 8px (`--radius-sm`)
- Modals: 20px (`--radius-xl`)

### Component Classes (tf-*)
- `tf-card`, `tf-stat`, `tf-stat-label`, `tf-stat-value`
- `tf-btn-primary`, `tf-btn-secondary`, `tf-btn-danger`
- `tf-input`, `tf-select`, `tf-dialog`
- `tf-table`, `tf-label`, `tf-badge`
- `tf-sidebar`, `tf-sidebar-item`
- `tf-tabs-list`, `tf-tabs-trigger`
- `tf-page-header`, `tf-page-subtitle`

### Chart Colors (Recharts)
- Primary: #0A84FF (blue)
- Secondary: #30D158 (green)
- Tertiary: #FFD60A (yellow)
- Danger: #FF453A (red)

## Completed Work
- Full backend refactoring into modular APIRouters
- Duo subscriptions, review history charts, global attendance
- Resend email integration & inbox
- Sidebar reorganization
- **TRANSFORM Apple-Inspired UI Redesign (completed 2026-03-12)**:
  - Created `/src/tokens/transform-brand.css` with all CSS custom properties
  - Created global component classes (tf-*) in index.css
  - Applied Apple dark mode palette to ALL 18+ pages
  - Blue accent (#0A84FF) replacing all rose/red accents
  - Font Inter + JetBrains Mono for data values
  - Cards with 16px radius, inputs with 12px radius
  - Charts with blue/green/yellow color series
  - UPPERCASE labels with 0.06em letter-spacing
  - All branding updated to "Transform"

## Backlog
### P0
- [ ] Integration API Bsport (en attente agreement utilisateur)

### P1
- [ ] Export CSV membres
- [ ] Lier KPIs cours aux salaires (validation)

### P2
- [ ] WhatsApp (Twilio)
- [ ] Dashboard coach personnel
- [ ] Interface migration donnees "Lovable"
- [ ] Auto-renouvellements abonnements

## Testing
- iteration_16: OLD design - 100% pass
- iteration_17: Apple-inspired redesign - 100% pass (CSS vars, colors, all pages verified)
