# TRANSFORM - Product Requirements Document

## Overview
Application SaaS de pilotage financier pour clubs de sport. Renommee "TRANSFORM".

## Design System - TRANSFORM (Apple-Inspired) — COMPLETE
### Token File: `/src/tokens/transform-brand.css`
- `--color-bg-primary`: #000000 | `--color-bg-secondary`: #1C1C1E | `--color-bg-tertiary`: #2C2C2E
- `--color-accent`: #0A84FF | `--color-success`: #30D158 | `--color-warning`: #FFD60A | `--color-danger`: #FF453A | `--color-info`: #64D2FF
- Font: Inter + JetBrains Mono | Radius: 16/12/8/20px
- Global classes: tf-card, tf-stat, tf-btn-primary/secondary/danger, tf-input, tf-table, tf-label, tf-badge, tf-dialog, tf-sidebar, tf-tabs

### Audit Checklist
- [x] No hardcoded hex outside transform-brand.css
- [x] All KPI numbers use --font-mono
- [x] All labels UPPERCASE --text-xs
- [x] All buttons match spec
- [x] "TheCoach" appears zero times
- [x] Dark mode default (#000000 body)
- [x] Chart colors use brand series
- [x] 16/16 pages pass visual test

## Architecture
- **Backend**: FastAPI, 16 router files, MongoDB, JWT, Resend
- **Frontend**: React, 18 pages, shadcn/ui, Recharts

## Completed Work
- Full backend refactoring, Duo subscriptions, review charts, attendance, Resend email, sidebar
- **Apple-Inspired UI Redesign (2026-03-12)**: Complete token system, 18+ pages, 0 hardcoded colors

## Backlog
- **P0**: Bsport API (blocked)
- **P1**: CSV export, KPI-salary link
- **P2**: WhatsApp, coach dashboard, data migration, auto-renewals

## Testing: iterations 16-18, all 100% pass
