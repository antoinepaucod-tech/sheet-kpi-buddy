# Profit OS

App de rentabilité multi-club pour le groupe THE COACH, construite sur le projet Supabase **GROWTH ENGINE** (`tnmpphysbtoezzjfqxcd`). Deux modes : **Simulateur** (scénarios what-if avec sliders) et **Suivi mensuel réel** (saisie par club → P&L automatique). Vue par club + vue consolidée groupe (les 4 clubs de la table `clubs` existante).

## Stack

React 18 · Vite · Tailwind CSS · TanStack React Query · Recharts · i18next (FR-first) · Supabase (auth + Postgres + RLS) · PWA mobile-first (bottom nav, safe-area).

## Démarrage

```bash
cd profit-os
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production dans dist/
```

Le `.env` est fourni (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — clé anon publique par design).

### Comptes de test (mot de passe `Test1234!`)

| Email | Rôle Profit OS | Droits |
|---|---|---|
| `antoine.owner@test.local` | owner | tout, y compris gestion des membres |
| `coach1.member@test.local` | member | lecture + écriture (saisies, scénarios, réglages) |
| `coach2.viewer@test.local` | viewer | lecture seule |

## Modules

### Acquisition (saisie mensuelle par club)
Inputs : dépenses pub, frais d'agence, frais création vidéo, leads générés, nouveaux membres.
Calculs auto : **CPL** = pub / leads · **CAC** = (pub + agence + vidéo) / nouveaux membres · **LTV** = ARPU **HT** × durée moyenne d'abonnement (paramétrable par club, défaut 30 mois) · **LTV:CAC** · **Payback** = CAC / ARPU HT (mois).

### OPEX (saisie mensuelle par club)
**Salaires bruts** (les charges sociales employeur — taux paramétrable, défaut 17 % — sont ajoutées automatiquement et affichées en ligne séparée), loyer, nettoyage, assurances, énergie, divers + **amortissement machines** : valeur d'achat / durée (réglages du club) → charge mensuelle lissée (jamais en cash).

### Revenus (saisie mensuelle par club)
Montants **TTC** : membres actifs × ARPU (défaut club, surchargeable par mois) + annexes (personal training, boutique, drop-in). Le P&L est calculé en **HT** (TTC / 1 + taux TVA, défaut 8.1 %).

### Fiscalité suisse (paramétrable par club dans Réglages)
Taux TVA (défaut 8.1 %) · taux charges sociales employeur (défaut 17 %) · taux d'impôt sur le bénéfice (défaut 14 % Genève, 13.8 % Vaud/Lausanne), appliqué sur l'EBIT uniquement s'il est positif.

### Outputs — structure P&L
**Revenus HT → − OPEX (acquisition incluse) → = EBITDA → − Amortissements → = EBIT → − Intérêts dette → = Résultat avant impôt → − Impôt → = Résultat net.** EBITDA et résultat net sont affichés comme deux KPIs séparés (l'EBITDA sert aux valorisations d'acquisition). **Break-even en membres** = ⌈(OPEX + amortissements + intérêts + acquisition − revenus annexes HT) / ARPU HT⌉, graphes d'évolution Recharts, **dashboard consolidé groupe** = agrégation exacte des 4 clubs (sommes monétaires, impôt par club puis sommé, ratios recalculés depuis les sommes).

### Couche investisseur
- **Churn & croissance** : résiliations mensuelles par club → churn %, croissance nette (nouveaux − résiliations), durée d'abonnement déduite (= 1/churn) affichée à côté de la durée paramétrée, graphe d'évolution membres.
- **Forecast 3-5 ans** (second mode du Simulateur) : hypothèses par club initialisées depuis le réel (croissance membres/mois, churn, ARPU, inflation OPEX %), P&L + EBITDA projetés sur 36/48/60 mois, graphe par club + consolidé groupe, synthèse annuelle.
- **Dette** (`profit_financing`, gérée dans Réglages) : annuités constantes — **intérêts dans le P&L** (entre EBIT et impôt), **remboursement du capital dans le cash flow uniquement**, jamais dans le P&L.
- **Cash flow** : résultat net + amortissements (non-cash) − remboursement capital − CAPEX du mois, avec trésorerie cumulée par club (graphe + détail mensuel).
- **CAPEX** (`profit_capex`, géré dans Réglages) : prix d'acquisition, fit-out, machines — alimente automatiquement les amortissements du P&L (montant / durée). **ROI par club** = EBITDA annualisé / investissement total.
- **Investor View** (onglet dédié) : marge EBITDA %, MRR (HT), revenu/membre, revenu/m² (surface paramétrable), taux d'occupation (capacité paramétrable), LTV:CAC, churn — par club et groupe consolidé. **Valorisation** = EBITDA annualisé × multiple paramétrable par club (défaut 5x) ; valorisation groupe = somme des valorisations par club. **Export PDF pitch-ready** brandé Transform OS (fond #09090B, accent #F97316, Bebas Neue embarquée avec fallback offline).

### Simulateur
Sliders sur tous les drivers (membres, ARPU, durée, acquisition, OPEX), comparaison **scénario vs réel** (mois au choix), sauvegarde / rechargement de scénarios (`profit_scenarios`, jsonb). Un scénario démo « Versoix +20% membres » est seedé.

## Base de données

Migrations dans `supabase/migrations/` (déjà appliquées au projet) :

- `profit_club_settings` — durée moyenne d'abonnement, ARPU défaut (TTC), valeur + durée d'amortissement machines, taux TVA / charges sociales / impôt, par club
- `profit_monthly_entries` — une ligne par club et par mois (acquisition / opex / revenus), `UNIQUE(club_id, month)`
- `profit_scenarios` — scénarios du simulateur en jsonb
- `profit_financing` — dette par club (montant, taux, durée, date de début ; annuités constantes)
- `profit_capex` — investissements par club (libellé, montant, date, durée d'amortissement)
- `profit_members` — rôles applicatifs (owner / member / viewer)

**RLS** : aucune sous-requête récursive dans les policies — tout passe par des fonctions `SECURITY DEFINER` (`my_profit_role()`, `profit_clubs()`) avec `search_path` épinglé, `EXECUTE` accordé à `authenticated` uniquement (révoqué pour `public` et `anon`). La liste des clubs est exposée via `profit_clubs()` (RPC) pour ne pas toucher aux policies existantes de la table partagée `clubs`.

## Validation

- `node scripts/calc.test.mjs` — vérifie offline tous les calculs (CPL/CAC/LTV/payback/TVA/charges sociales/EBITDA/EBIT/intérêts/impôt/break-even/churn/échéancier de prêt/amortissements CAPEX/cash flow ≠ P&L/ROI/forecast/métriques investisseur/valorisation/consolidation) contre les valeurs démo seedées. 66/66 ✅
- `node scripts/export-pdf.mjs` — génère le PDF Investor View depuis les seeds (`/tmp/profit-os-investor-view.pdf`) pour validation visuelle.
- `node scripts/validate.mjs` — validation end-to-end (auth réelle + RLS + roundtrip scénario) à lancer depuis un environnement avec accès réseau à Supabase.
- RLS validé en SQL par impersonation des 3 rôles : owner voit 4 clubs / écrit, viewer lit tout / ne peut rien écrire, anon ne voit rien.

## Données démo

Club **Hybrid Gym Versoix**, avril + mai 2026 (ARPU démo 179 CHF TTC). CAPEX : acquisition & fit-out 250 000 (120 mois) + machines 180 000 (60 mois) = 430 000 investis, amortissement mensuel 5 083.33. Dette : prêt 300 000 @ 4.5 % sur 84 mois (mensualité 4 170).

Avril : revenus 43 240 TTC → **40 000 HT**, OPEX 30 610 (dont salaires bruts 18 000 + charges sociales 3 060), acquisition 5 500 → **EBITDA 3 890** → amortissements 5 083.33 → EBIT −1 193.33 → intérêts 1 090.61 → résultat avant impôt −2 283.95 → impôt 0 → **résultat net −2 283.95**. **Cash flow −280.05** (net + 5 083.33 d'amort non-cash − 3 079.43 de capital) ≠ P&L. Churn 3.33 % (durée déduite 30 mois = paramétrée), break-even 224 membres.
Mai : EBITDA 7 835.88, net **+1 439.19**, cash flow **+3 431.54**, trésorerie cumulée +3 151.50, churn 5.7 %. ROI club = EBITDA annualisé 70 355 / 430 000 = **16.4 %**.

Investor View (snapshot mai) : marge EBITDA **17.9 %**, MRR 37 754 HT, revenu/membre 191.80, revenu/m² 67.28 (650 m²), occupation **65.1 %** (228/350), **valorisation 351 776 CHF** (EBITDA annualisé 70 355 × 5).

Voir `DECISIONS.md` pour les choix d'implémentation.
