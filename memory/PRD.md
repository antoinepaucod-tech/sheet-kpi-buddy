# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Design System — Apple-Inspired (COMPLETE)
### Source: `/src/tokens/transform-brand.css`
- Colors: #000000 (bg), #1C1C1E (cards), #2C2C2E (inputs), #0A84FF (accent), #30D158/#FFD60A/#FF453A/#64D2FF
- Fonts: Inter (SF Pro fallback) — used for BOTH text AND numbers (tabular-nums)
- Radius: 8/12/16/20px | 6 shadcn overrides (button, dialog, input, tabs, select, badge)

### Typography: Inter tabular-nums (NOT monospace)
- KPI hero: `clamp(18px, 1.4vw, 26px)` responsive + tabular-nums
- Number large: `text-lg (22px)` + bold + tabular-nums
- Labels: UPPERCASE 11px + 0.06em tracking + semibold
- Headers: 28px + bold + -0.02em tracking

### Animations (Apple Motion)
- Page fade-in (0.4s), KPI grid stagger (6 delays), dialog scale-in, skeleton shimmer, card hover border, button press (0.97), sidebar slide, tab fade-in

### Audit: ALL ZEROS
- 0 hardcoded hex, 0 Tailwind colors, 0 text-white/, 0 "TheCoach"

## Completed
- 18 feature modules | Resend email | Backend refactoring
- Apple Design System (colors, tokens, components, animations, Inter tabular-nums)

## Backlog
- **P0**: Bsport API (blocked) | **P1**: CSV export, KPI-salary link | **P2**: WhatsApp, coach dashboard, data migration

## Testing: iterations 16-21, all 100% pass
