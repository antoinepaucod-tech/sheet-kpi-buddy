# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Design System — Apple-Inspired (COMPLETE)
- Colors: #000000 (bg), #1C1C1E (cards), #0A84FF (accent)
- Fonts: Inter tabular-nums
- Dialog: `inset-0 mx-auto my-auto h-fit`, max-h-[90vh], flex flex-col

## Completed (All iterations 16-30 pass 100%)
- 18 feature modules | Resend email | Backend refactoring
- Apple Design System (colors, tokens, components, animations)
- P0-P2 bugs and features (dialog sizing, bilans, challenges, renewals)
- **P0: Integration GoHighLevel (GHL) - 2026-03-13 - COMPLETE**
  - Sync GHL pipelines avec filtre de dates (start_date, end_date)
  - "Nouveaux Leads" = total pipeline opportunities (pas juste le stage)
  - Sync met a jour les KPIs du mois selectionne (param `month`)
  - Entonnoir de vente dans Details lie aux donnees GHL (Leads, Planifies, Show, Close)
  - Champ editable "Appels passes" (calls_made)
  - Confirmation de vente (subscription type + cash collected)
  - PIF Churn % supprime du detail des membres

## Key API Endpoints (GHL)
- `POST /api/ghl/sync?start_date=&end_date=&month=` - Sync with date filter + target month
- `GET /api/ghl/last-sync` - Last successful sync
- `POST /api/ghl/confirm-sale` - Confirm sale
- `GET /api/ghl/sales/{month}` - Sales for month
- `PATCH /api/ghl/calls-made` - Update calls_made

## Backlog
- **P0**: Calcul automatique CPL/CPR/LTV (attente du 2eme SaaS utilisateur)
- **P0**: Explication du workflow complet de l'application
- **P1**: Corriger erreurs visuelles restantes du tableau de bord
- **P1**: Lier KPIs cours aux salaires pour depenses automatiques
- **P2**: WhatsApp alerts (Twilio), data migration

## 3rd Party Integrations
- Resend: Integre et fonctionnel
- GoHighLevel: Integre et fonctionnel (PIT token, date filtering, KPI linking)
- Twilio: Installe mais non configure

## Testing: iterations 16-30, all 100% pass
