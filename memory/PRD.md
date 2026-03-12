# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Design System — Apple-Inspired (COMPLETE)
### Source: `/src/tokens/transform-brand.css`
- Colors: #000000 (bg), #1C1C1E (cards), #2C2C2E (inputs), #0A84FF (accent), #30D158 (success), #FFD60A (warning), #FF453A (danger)
- Fonts: Inter (SF Pro fallback) + JetBrains Mono (SF Mono fallback)
- Radius: 8/12/16/20px
- 6 shadcn components overrides (button, dialog, input, tabs, select, badge)

### Animations (NEW 2026-03-12)
- Page fade-in (0.4s cubic-bezier)
- KPI grid stagger (0.06s delays)
- Dialog scale-in (0.25s)
- Skeleton shimmer loader
- Card hover (border-color transition 0.25s)
- Button press (scale 0.97)
- Sidebar item slide (translateX 2px)

### Typography (NEW 2026-03-12)
- Tabular numbers: `font-feature-settings: "tnum" 1, "zero" 1`
- Number classes: tf-number-hero (48px), tf-number-large (34px), tf-number-medium (22px), tf-number-small (13px)
- All with `-0.02em` letter-spacing + slashed-zero

### Audit: ALL ZEROS
- 0 hardcoded hex, 0 Tailwind colors, 0 text-white/XX, 0 old brand refs

## Completed
- 18 feature modules (auth, dashboard, members, payments, transactions, etc.)
- Resend email integration
- Apple Design System complete (colors, tokens, components, animations, typography)

## Backlog
- **P0**: Bsport API (blocked on user info)
- **P1**: CSV export, KPI-salary link
- **P2**: WhatsApp, coach dashboard, data migration, auto-renewals

## Testing: iterations 16-20, all 100% pass
