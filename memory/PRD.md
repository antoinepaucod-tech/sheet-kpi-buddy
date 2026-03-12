# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Design System — Apple-Inspired (COMPLETE)
### Source: `/src/tokens/transform-brand.css`
- Colors: #000000 (bg), #1C1C1E (cards), #2C2C2E (inputs), #0A84FF (accent), #30D158/#FFD60A/#FF453A/#64D2FF
- Fonts: Inter (SF Pro fallback) — used for BOTH text AND numbers (tabular-nums)
- Radius: 8/12/16/20px | 6 shadcn overrides (button, dialog, input, tabs, select, badge)

### Typography: Inter tabular-nums (NOT monospace)
- KPI value: `clamp(14px, 1.1vw, 20px)` responsive + tabular-nums
- Number large: `clamp(14px, 1.1vw, 20px)` + bold + tabular-nums

### CSS Pattern Rules
- NEVER use Tailwind `bg-[var(--color-xxx)]/YY` or `border-[var(--color-xxx)]/YY` — opacity modifiers don't work with CSS variables
- ALWAYS use explicit `rgba()` values: `bg-[rgba(10,132,255,0.08)]`, `border-[rgba(48,209,88,0.15)]`
- Colors ref: accent=10,132,255 | success=48,209,88 | warning=255,214,10 | danger=255,69,58 | info=100,210,255

### Dialog Component
- Uses `inset-0 mx-auto my-[5vh]` for proper centering (NOT translate-y which conflicts with animations)
- `flex flex-col` with `max-h-[90vh] overflow-hidden`
- Form sections auto-scroll via CSS: `[role="dialog"] > .space-y-4 { overflow-y: auto; flex: 1 1 auto; min-height: 0 }`

## Completed
- 18 feature modules | Resend email | Backend refactoring
- Apple Design System (colors, tokens, components, animations, Inter tabular-nums)
- P0 Bug Fix: KPI overflow on dashboard (clamp + xl breakpoint) — March 12, 2026
- P0 Bug Fix: Yellow buttons → blue accent, broken Tailwind patterns → rgba() across ALL pages — March 12, 2026
- P0 Bug Fix: 5 bugs (green colors → blue, late payments names, dialog overflow, attendance cells, onboarding sort) — March 12, 2026

## Backlog
- **P0**: Bsport API (blocked — waiting for user info)
- **P1**: CSV export, KPI-salary link
- **P2**: WhatsApp alerts (Twilio), coach dashboard, data migration, subscription renewal automation

## Testing: iterations 16-24, all pass
