# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Design System — Apple-Inspired (COMPLETE)
### Source: `/src/tokens/transform-brand.css`
- Colors: #000000 (bg), #1C1C1E (cards), #2C2C2E (inputs), #0A84FF (accent)
- Fonts: Inter (SF Pro fallback) — tabular-nums for numbers
- CSS Pattern: NEVER use `bg-[var(--color-xxx)]/YY` → use `rgba()` instead

### Dialog Component
- `inset-0 mx-auto my-auto h-fit` for proper centering (NOT translate-y)
- `flex flex-col` with `max-h-[90vh]`
- Form sections auto-scroll via CSS: `[role="dialog"] > .space-y-4 { overflow-y: auto; flex: 1 1 auto; min-height: 0 }`

## Completed
- 18 feature modules | Resend email | Backend refactoring
- Apple Design System (colors, tokens, components, animations, Inter tabular-nums)
- P0 Bug Fix: KPI overflow (clamp + xl breakpoint) — March 12
- P0 Bug Fix: Yellow buttons → blue, broken Tailwind → rgba() — March 12
- P0 Bug Fix: 5 bugs (green→blue, late payments names, dialog overflow, attendance cells, onboarding sort) — March 12
- P0 Bug Fix: Dialog h-fit, Bilans clickable filters, custom specialties, review toggle visible — March 12

## In Progress
- P1: 6 Week Challenge features (check-in hebdo, auto-ajout, emoji badge)
- P2: Renouvellement d'abonnements

## Backlog
- **P0**: Bsport API (blocked — waiting for user info)
- **P1**: CSV export, KPI-salary link
- **P2**: WhatsApp alerts (Twilio), data migration

## Testing: iterations 16-25, all 100% pass
