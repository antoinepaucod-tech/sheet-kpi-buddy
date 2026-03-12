# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Design System — Apple-Inspired (COMPLETE)
- Colors: #000000 (bg), #1C1C1E (cards), #0A84FF (accent)
- Fonts: Inter tabular-nums
- CSS: NEVER use `bg-[var(--color-xxx)]/YY` → use `rgba()` instead
- Dialog: `inset-0 mx-auto my-auto h-fit`, max-h-[90vh], flex flex-col

## Completed
- 18 feature modules | Resend email | Backend refactoring
- Apple Design System
- P0: KPI overflow, yellow→blue, green→blue, dialog overflow, attendance cells, onboarding sort
- P0: Dialog h-fit, Bilans clickable filters, custom specialties, review toggle visible
- P1: 6 Week Challenge features — March 12:
  - Check-in goal selector (1x-5x/sem buttons)
  - Training-based check-ins from Saisie Séances (backend enrichment)
  - Auto-add to active challenge on member creation with "challenge" subscription
  - 🔥 emoji badge for challenge members in list
  - Check-in detail modal shows "via Saisie Séances" source

## In Progress
- P2: Renouvellement/modification d'abonnements

## Backlog
- **P0**: Bsport API (blocked — waiting for user info)
- **P1**: CSV export, KPI-salary link
- **P2**: WhatsApp alerts (Twilio), data migration

## Testing: iterations 16-26, all 100% pass
