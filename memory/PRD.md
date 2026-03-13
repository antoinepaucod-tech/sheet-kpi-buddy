# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Completed (All iterations 16-30 pass 100%)
- Apple Design System + 18 feature modules + Resend email
- All P0-P2 bugs and features (dialog sizing, bilans, challenges, renewals)
- **P0: Integration GoHighLevel (GHL) - 2026-03-13 - COMPLETE**
  - Sync GHL pipelines avec filtre de dates (start_date, end_date)
  - "Nouveaux Leads" = total pipeline opportunities
  - Auto-switch du mois apres sync (end_date month)
  - Dialog auto-ouvert pour confirmer les ventes non confirmees
  - Confirmation de vente cree: membre, ajout au 6 Week Challenge, onboarding=false
  - Cash -> fast_cash_revenue -> total_revenue (visible dans header)
  - Champ editable "Appels passes" (calls_made)
  - PIF Churn % supprime du detail des membres

## Key API Endpoints (GHL)
- `POST /api/ghl/sync?start_date=&end_date=` - Sync with date filter, auto-updates KPI (end_date month)
- `POST /api/ghl/confirm-sale` - Creates member + challenge + updates revenue
- `GET /api/ghl/last-sync` / `GET /api/ghl/sales/{month}` / `PATCH /api/ghl/calls-made`

## Confirm Sale Flow
1. Sync GHL -> finds "Showed Sold" opportunities
2. Auto-opens dialog for unconfirmed sales
3. User selects subscription type + cash amount
4. Backend creates: customer_member (membership, onboarding=False)
5. If "6 Week Challenge": auto-adds to active challenge
6. Updates KPI: cash_collected, fast_cash_revenue, total_revenue, new_members

## Backlog
- **P0**: Calcul automatique CPL/CPR/LTV (attente du 2eme SaaS utilisateur)
- **P0**: Explication du workflow complet de l'application
- **P1**: Corriger erreurs visuelles restantes du tableau de bord
- **P1**: Lier KPIs cours aux salaires pour depenses automatiques
- **P2**: WhatsApp alerts (Twilio), data migration

## 3rd Party Integrations
- Resend: Integre et fonctionnel
- GoHighLevel: Integre et fonctionnel (PIT token, full pipeline sync + member creation)
- Twilio: Installe mais non configure
