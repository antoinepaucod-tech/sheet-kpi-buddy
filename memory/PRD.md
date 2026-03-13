# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Design System — Apple-Inspired (COMPLETE)
- Colors: #000000 (bg), #1C1C1E (cards), #0A84FF (accent)
- Fonts: Inter tabular-nums
- Dialog: `inset-0 mx-auto my-auto h-fit`, max-h-[90vh], flex flex-col

## Completed (All iterations 16-29 pass 100%)
- 18 feature modules | Resend email | Backend refactoring
- Apple Design System (colors, tokens, components, animations)
- P0: KPI overflow, color consistency, dialog sizing, attendance cells
- P0: Dialog h-fit, Bilans clickable filters, custom specialties, review toggle
- P1: 6 Week Challenge (training-based check-ins, auto-add, badge, goal selector)
- P2: Renouvellement d'abonnements avec changement de type + auto-add challenge
- **P0: Integration GoHighLevel (GHL) - 2026-03-13 - COMPLETE**
  - Backend: `POST /api/ghl/sync` syncs real GHL pipelines (684 opportunities, 33 showed_sold)
  - Backend: `POST /api/ghl/confirm-sale`, `GET /api/ghl/sales/{month}`, `GET /api/ghl/last-sync`, `GET /api/ghl/sync-history`
  - Frontend: Visual funnel in Dashboard "Acquisition" tab with sync button, total pipeline opps, conversion rates
  - Frontend: Sale confirmation dialog (subscription type dropdown + cash collected input)
  - Pipeline mapping handles emoji-prefixed stage names
  - GHL PIT token: `pit-af35bfcf-cddd-4510-8b60-27492bde1229`

## Architecture
```
/app/backend/
  routers/ghl.py          # GHL sync, sales endpoints
  services/ghl.py         # GHL API integration logic (emoji-aware stage mapping)
  routers/kpis.py         # KPI CRUD + recalculation
  models/kpi.py           # MonthlyKPI with funnel fields
/app/frontend/src/
  components/GHLFunnelSection.js  # GHL funnel visual + sync + sale dialog
  pages/Dashboard.js              # Main dashboard with funnel tab
```

## MongoDB Collections (GHL)
- `ghl_syncs` - Sync history (status, funnel, total_opportunities, pipelines, synced_at)
- `ghl_sales` - Confirmed sales (opportunity_id, subscription_type, cash_collected, month)

## Backlog
- **P0**: Calcul automatique CPL/CPR/LTV (attente du 2eme SaaS utilisateur)
- **P0**: Explication du workflow complet de l'application
- **P1**: Corriger erreurs visuelles restantes du tableau de bord
- **P1**: Lier KPIs cours aux salaires pour depenses automatiques
- **P2**: WhatsApp alerts (Twilio), data migration

## 3rd Party Integrations
- Resend: Integre et fonctionnel
- GoHighLevel: Integre et fonctionnel (PIT token)
- Twilio: Installe mais non configure

## Testing: iterations 16-29, all 100% pass
