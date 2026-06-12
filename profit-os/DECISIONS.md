# DECISIONS.md — Profit OS

Décisions prises en autonomie pendant le build (consigne : ne jamais bloquer, décider, logger).

## Données & périmètre

1. **« Les 4 clubs »** : la table `clubs` contient en réalité **7 lignes**. Les 4 clubs du groupe sont ceux de l'organisation `30400627-1288-4011-bc72-267b8f46b80c` (Hybrid Gym Versoix, La Servette, Grand-Saconnex, Lausanne) ; les 3 autres (WL Club, FitFactory Lausanne, doublon « La Servette, Genève ») sont des données de test d'autres organisations. Le filtre est implémenté dans la fonction `profit_clubs()` (org id en dur, commenté dans la migration) plutôt que dans le client.
2. **Repo** : la consigne disait « nouveau repo profit-os/ », mais la session est scopée au repo `sheet-kpi-buddy`. L'app vit donc dans le dossier **`profit-os/`** de ce repo, sur la branche `claude/profit-os-build-1j3g9s`, totalement autonome (package.json propre).
3. **Users de test** : les 3 comptes du pattern Tasks OS (`antoine.owner` / `coach1.member` / `coach2.viewer` @test.local, mdp `Test1234!`) **existaient déjà** dans auth.users — réutilisés tels quels (mot de passe vérifié par hash), mappés vers les rôles Profit OS via la nouvelle table `profit_members`.
4. **`.env` committé** : il ne contient que l'URL du projet et la clé **anon** (publique par design, déjà committée ailleurs dans le repo). Aucune service role key dans le repo.

## Modèle de données

5. **Amortissement machines** : paramétré au niveau du **club** (`profit_club_settings.equipment_value` + `equipment_amort_months`, défaut 60 mois) car c'est une propriété de l'actif, pas du mois. La charge lissée (valeur / durée) est injectée automatiquement dans l'OPEX de chaque mois. Un champ `equipment_amort_override` par mois permet de surcharger (utilisé aussi par le simulateur). Jamais traité en cash.
6. **ARPU** : défaut par club dans les settings (`default_arpu`, seedé à 159 CHF), surchargeable par mois (`profit_monthly_entries.arpu`, NULL = défaut club).
7. **`month`** : type `date` avec contrainte « premier jour du mois » + `UNIQUE(club_id, month)` → un upsert idempotent par club/mois.
8. **Rôles applicatifs** : table dédiée `profit_members` (owner / member / viewer) plutôt que de réutiliser les rôles Tasks OS (scopés par board, non transposables). owner = gestion des membres, member = écriture, viewer = lecture seule (UI désactivée + RLS).

## Formules

9. **CPL** = dépenses publicitaires / leads (pub seule). **CAC** = (pub + agence + vidéo) / nouveaux membres (coût d'acquisition complet). C'est l'interprétation standard ; les deux dénominateurs sont protégés contre la division par zéro (affichage « — »).
10. **LTV** = ARPU mensuel × durée moyenne d'abonnement (paramétrable par club, défaut 30 mois). **Payback** = CAC / ARPU, en mois.
11. **Break-even** = ⌈(OPEX total + acquisition − revenus annexes) / ARPU⌉ : nombre de membres dont les abonnements couvrent tous les coûts du mois nets des revenus annexes.
12. **Consolidation groupe** : sommes exactes des montants (revenus, OPEX, acquisition, net) ; les ratios (CAC, CPL, marge, LTV:CAC, payback, break-even) sont **recalculés à partir des sommes** (ARPU blended = revenus abonnements / membres actifs, durée pondérée par membres actifs) — jamais de moyenne de ratios.

## Sécurité

13. **RLS sans récursion** : toutes les policies passent par `my_profit_role()` (SECURITY DEFINER, `search_path` épinglé, sans argument → impossible de lire le rôle d'un autre user). EXECUTE accordé à `authenticated` uniquement, révoqué pour `public`/`anon`.
14. **Table `clubs` non modifiée** : pour ne pas toucher aux policies existantes des autres apps, la liste des 4 clubs est exposée via la RPC `profit_clubs()` (SECURITY DEFINER, filtrée par org + appartenance Profit OS).
15. **Advisors Supabase** : après la première passe, 3 warnings concernaient Profit OS (search_path mutable sur le trigger, fonctions SECURITY DEFINER exposées) → corrigés dans la migration `profit_os_hardening`. Les warnings restants du projet préexistent à ce build.

## Frontend

16. **JavaScript (JSX) plutôt que TypeScript** : cohérent avec le reste du repo, build plus simple, la logique métier est centralisée et testée dans `src/lib/calc.js` (21 assertions offline).
17. **PWA manuelle** (manifest + service worker network-first qui ne cache jamais les appels Supabase) plutôt que vite-plugin-pwa : moins de dépendances, suffisant pour l'install mobile + safe-area.
18. **Brand** : fond `#09090B`, accent `#F97316`, Bebas Neue (titres), DM Sans (body), **Inter + `tabular-nums` sur toutes les valeurs numériques** via la classe utilitaire `.num` appliquée à chaque chiffre affiché (KPI, tableaux, tooltips, inputs).
19. **Simulateur** : porte son propre ARPU + durée (sliders) pour fonctionner sans données réelles ; « Partir du réel » précharge le mois sélectionné, la comparaison scénario vs réel affiche les écarts signés colorés. Les scénarios sont sauvegardés en jsonb avec leur `base_month`.
20. **Validation réseau** : le conteneur de build n'a pas d'accès réseau direct à Supabase (« Host not in allowlist ») — la validation E2E (auth + RLS + roundtrip scénario) a donc été faite **en SQL par impersonation de rôles** via MCP (mêmes garanties), et `scripts/validate.mjs` reste fourni pour la rejouer depuis un environnement avec réseau. Les calculs sont validés offline par `scripts/calc.test.mjs`.
