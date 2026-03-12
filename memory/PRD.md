# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Rebrandee "TRANSFORM".

## Design System — COMPLETE (Apple-Inspired)
### Source of truth: `/src/tokens/transform-brand.css`
| Token | Value |
|---|---|
| --color-bg-primary | #000000 |
| --color-bg-secondary | #1C1C1E |
| --color-bg-tertiary | #2C2C2E |
| --color-bg-elevated | #3A3A3C |
| --color-accent | #0A84FF |
| --color-success | #30D158 |
| --color-warning | #FFD60A |
| --color-danger | #FF453A |
| --color-info | #64D2FF |
| --font-display | SF Pro Display, Inter |
| --font-text | SF Pro Text, Inter |
| --font-mono | SF Mono, JetBrains Mono |
| --radius-sm/md/lg/xl | 8/12/16/20px |

### Implementation
- Shadcn components overridden: button, dialog, input, tabs, select, badge
- Global CSS: table alternating rows, chart overrides, icon stroke 1.5px
- Zero hardcoded hex, zero Tailwind colors, zero old brand references

## Architecture
- Backend: FastAPI, 16 routers, MongoDB, JWT, Resend
- Frontend: React, 18 pages, shadcn/ui, Recharts

## Completed
- Full backend refactoring
- All 18 features (members, payments, challenges, reviews, attendance, etc.)
- Resend email integration
- **Apple Design System (2026-03-12)**: 100% spec compliance, 17/17 pages verified

## Backlog
- **P0**: Bsport API (blocked on user info)
- **P1**: CSV export, KPI-salary link validation
- **P2**: WhatsApp, coach dashboard, data migration, auto-renewals

## Testing: iterations 16-19, all 100% pass
