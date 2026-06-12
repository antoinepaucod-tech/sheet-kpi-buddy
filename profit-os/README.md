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
**Revenus HT → − OPEX (acquisition incluse) → = EBITDA → − Amortissements → = EBIT → − Impôt → = Résultat net.** EBITDA et résultat net sont affichés comme deux KPIs séparés (l'EBITDA sert aux valorisations d'acquisition). **Break-even en membres** = ⌈(OPEX + amortissements + acquisition − revenus annexes HT) / ARPU HT⌉, graphes d'évolution Recharts, **dashboard consolidé groupe** = agrégation exacte des 4 clubs (sommes monétaires, impôt par club puis sommé, ratios recalculés depuis les sommes).

### Simulateur
Sliders sur tous les drivers (membres, ARPU, durée, acquisition, OPEX), comparaison **scénario vs réel** (mois au choix), sauvegarde / rechargement de scénarios (`profit_scenarios`, jsonb). Un scénario démo « Versoix +20% membres » est seedé.

## Base de données

Migrations dans `supabase/migrations/` (déjà appliquées au projet) :

- `profit_club_settings` — durée moyenne d'abonnement, ARPU défaut (TTC), valeur + durée d'amortissement machines, taux TVA / charges sociales / impôt, par club
- `profit_monthly_entries` — une ligne par club et par mois (acquisition / opex / revenus), `UNIQUE(club_id, month)`
- `profit_scenarios` — scénarios du simulateur en jsonb
- `profit_members` — rôles applicatifs (owner / member / viewer)

**RLS** : aucune sous-requête récursive dans les policies — tout passe par des fonctions `SECURITY DEFINER` (`my_profit_role()`, `profit_clubs()`) avec `search_path` épinglé, `EXECUTE` accordé à `authenticated` uniquement (révoqué pour `public` et `anon`). La liste des clubs est exposée via `profit_clubs()` (RPC) pour ne pas toucher aux policies existantes de la table partagée `clubs`.

## Validation

- `node scripts/calc.test.mjs` — vérifie offline tous les calculs (CPL/CAC/LTV/payback/amortissement/TVA/charges sociales/EBITDA/EBIT/impôt/break-even/consolidation) contre les valeurs démo seedées. 37/37 ✅
- `node scripts/validate.mjs` — validation end-to-end (auth réelle + RLS + roundtrip scénario) à lancer depuis un environnement avec accès réseau à Supabase.
- RLS validé en SQL par impersonation des 3 rôles : owner voit 4 clubs / écrit, viewer lit tout / ne peut rien écrire, anon ne voit rien.

## Données démo

Club **Hybrid Gym Versoix**, avril + mai 2026 (ARPU démo 179 CHF TTC). Exemple avril : revenus 43 240 TTC → **40 000 HT**, OPEX 30 610 (dont salaires bruts 18 000 + charges sociales 3 060), acquisition 5 500 → **EBITDA 3 890** → amortissement 3 000 → EBIT 890 → impôt 14 % = 124.60 → **résultat net 765.40 CHF** (marge 1,9 %). CAC 229.17, LTV HT 4 967.62, LTV:CAC 21,7:1, payback 1,38 mois, break-even 205 membres. Mai : EBITDA 7 835.88, net 4 158.86 CHF.

Voir `DECISIONS.md` pour les choix d'implémentation.
