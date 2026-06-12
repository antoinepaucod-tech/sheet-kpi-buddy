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
Calculs auto : **CPL** = pub / leads · **CAC** = (pub + agence + vidéo) / nouveaux membres · **LTV** = ARPU × durée moyenne d'abonnement (paramétrable par club, défaut 30 mois) · **LTV:CAC** · **Payback** = CAC / ARPU (mois).

### OPEX (saisie mensuelle par club)
Staff, loyer, nettoyage, assurances, énergie, divers + **amortissement machines** : valeur d'achat / durée (réglages du club) → charge mensuelle lissée injectée automatiquement dans l'OPEX (jamais en cash).

### Revenus (saisie mensuelle par club)
Membres actifs × ARPU (défaut club, surchargeable par mois) + annexes : personal training, boutique, drop-in.

### Outputs
P&L mensuel par club (revenus / OPEX / acquisition / résultat net / marge nette), **break-even en membres** = ⌈(OPEX + acquisition − revenus annexes) / ARPU⌉, graphes d'évolution Recharts, **dashboard consolidé groupe** = agrégation exacte des 4 clubs (sommes monétaires, ratios recalculés depuis les sommes).

### Simulateur
Sliders sur tous les drivers (membres, ARPU, durée, acquisition, OPEX), comparaison **scénario vs réel** (mois au choix), sauvegarde / rechargement de scénarios (`profit_scenarios`, jsonb). Un scénario démo « Versoix +20% membres » est seedé.

## Base de données

Migrations dans `supabase/migrations/` (déjà appliquées au projet) :

- `profit_club_settings` — durée moyenne d'abonnement, ARPU défaut, valeur + durée d'amortissement machines, par club
- `profit_monthly_entries` — une ligne par club et par mois (acquisition / opex / revenus), `UNIQUE(club_id, month)`
- `profit_scenarios` — scénarios du simulateur en jsonb
- `profit_members` — rôles applicatifs (owner / member / viewer)

**RLS** : aucune sous-requête récursive dans les policies — tout passe par des fonctions `SECURITY DEFINER` (`my_profit_role()`, `profit_clubs()`) avec `search_path` épinglé, `EXECUTE` accordé à `authenticated` uniquement (révoqué pour `public` et `anon`). La liste des clubs est exposée via `profit_clubs()` (RPC) pour ne pas toucher aux policies existantes de la table partagée `clubs`.

## Validation

- `node scripts/calc.test.mjs` — vérifie offline tous les calculs (CPL/CAC/LTV/payback/amortissement/P&L/break-even/consolidation) contre les valeurs démo seedées. 21/21 ✅
- `node scripts/validate.mjs` — validation end-to-end (auth réelle + RLS + roundtrip scénario) à lancer depuis un environnement avec accès réseau à Supabase.
- RLS validé en SQL par impersonation des 3 rôles : owner voit 4 clubs / écrit, viewer lit tout / ne peut rien écrire, anon ne voit rien.

## Données démo

Club **Hybrid Gym Versoix**, avril + mai 2026. Exemple avril : revenus 39 040 CHF, OPEX 30 550 CHF (dont 3 000 d'amortissement lissé : 180 000 / 60 mois), acquisition 5 500 CHF → résultat net **2 990 CHF** (marge 7,7 %), CAC 229.17, LTV 4 770, LTV:CAC 20,8:1, break-even 192 membres.

Voir `DECISIONS.md` pour les choix d'implémentation.
