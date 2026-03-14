# TRANSFORM - Product Requirements Document

## Overview
SaaS de pilotage financier pour clubs de sport. Marque "TRANSFORM".

## Completed (All iterations 16-31 pass 100%)
- Apple Design System + 18 feature modules + Resend email
- All P0-P2 bugs and features
- **P0: Integration GoHighLevel (GHL) - COMPLETE**
  - Sync GHL pipelines avec filtre de dates + auto-switch mois
  - Confirmation de vente: cree membre + 6 Week Challenge + onboarding
  - Email/phone du contact GHL transferes au membre
  - Cash -> fast_cash_revenue -> total_revenue (visible partout)
  - Active_members + PIF_members mis a jour lors du sync
  - Auto-dialog pour ventes non confirmees apres sync
  - Deduplication membres par nom
  - CSS overflow fixe sur Cash Collecte (text-base + truncate)
  - PIF Churn supprime du detail des membres

## Confirm Sale Flow
1. GHL Sync -> detecte "Showed Sold" opportunities
2. Auto-ouvre dialog avec nom + email + phone + GHL value
3. User choisit subscription type + cash
4. Backend: cree membre (email+phone GHL) si pas de doublon
5. Si "6 Week Challenge": auto-ajout au challenge actif
6. Met a jour: cash_collected, fast_cash_revenue, total_revenue, active_members, new_members

## Backlog
- **P0**: Calcul automatique CPL/CPR/LTV (attente du 2eme SaaS)
- **P0**: Explication du workflow complet
- **P1**: Corriger erreurs visuelles restantes du dashboard
- **P1**: Lier KPIs cours aux salaires
- **P2**: WhatsApp alerts (Twilio), data migration
