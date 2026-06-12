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

## Couche fiscale & comptable suisse (complément)

21. **TVA — périmètre** : seuls les **revenus** sont saisis TTC (consigne) et convertis en HT (`TTC / 1.081`) pour le P&L. Les **charges** (OPEX, acquisition) sont considérées saisies **HT**, la TVA amont étant récupérable pour une société assujettie — pas de retraitement côté coûts.
22. **Position de l'acquisition dans le P&L** : les coûts d'acquisition (pub, agence, vidéo) sont des charges opérationnelles → inclus **au-dessus de l'EBITDA** (EBITDA = Revenus HT − OPEX − Acquisition). L'EBITDA n'exclut que les amortissements : Revenus HT → − OPEX → = EBITDA → − Amortissements → = EBIT → − Impôt (si EBIT > 0) → = Résultat net.
23. **KPIs unitaires passés en HT** : LTV = ARPU **HT** × durée, payback = CAC / ARPU **HT**, break-even = ⌈(OPEX + amortissements + acquisition − revenus annexes **HT**) / ARPU **HT**⌉ — cohérent puisque CAC et OPEX sont des coûts HT. À l'équilibre EBIT = 0 donc l'impôt n'affecte pas le break-even. CPL/CAC inchangés.
24. **Taux stockés en pourcents** (8.1 = 8,1 %) dans `profit_club_settings` : `vat_rate` (défaut 8.1), `employer_charges_rate` (défaut 17), `profit_tax_rate` (défaut 14). Cantons : les 3 clubs genevois (Versoix, La Servette, Grand-Saconnex) à 14 %, **Lausanne (VD) à 13.8 %**. Paramétrable par club dans Réglages.
25. **Charges sociales** : le champ staff devient « salaires bruts » ; coût réel = bruts × (1 + taux). Les deux lignes (salaires bruts, charges sociales) apparaissent séparément dans le P&L. Pas de retraitement des données démo existantes : les montants saisis sont réinterprétés comme bruts.
26. **Impôt en consolidation** : appliqué **club par club** (chaque club = entité/canton avec son taux) puis sommé — jamais un taux groupe sur l'EBIT consolidé. Pas de compensation intra-groupe des pertes (un club déficitaire ne réduit pas l'impôt d'un club bénéficiaire) : prudent et conforme à des entités juridiques séparées.
27. **Pas de report de pertes** : l'impôt est calculé mois par mois sur l'EBIT positif du mois, sans carry-forward fiscal — simplification assumée pour un outil de pilotage (pas un outil comptable).
28. **Seeds démo ajustés** : avec la couche fiscale, l'ARPU démo de 159 TTC laissait Versoix à peine à l'équilibre (EBITDA ≈ 5 CHF en avril). ARPU démo porté à **179 TTC** (prix réaliste d'un abonnement suisse TTC) → avril : EBITDA 3 890, net 765 CHF ; mai : EBITDA 7 836, net 4 159 CHF. Démo lisible avec deux mois contrastés.
29. **Simulateur** : porte ses propres taux (TVA, charges, impôt) en sliders — « Partir du réel » les précharge depuis les réglages du club ; les scénarios sauvegardés embarquent les taux dans le jsonb (le scénario démo a été mis à jour).

## Couche investisseur — fondations (complément 2A)

30. **Churn** : `cancellations` ajouté à `profit_monthly_entries`. Churn = résiliations / membres actifs du mois (tels que saisis). Croissance nette = nouveaux − résiliations. Durée déduite = 1/churn, affichée à côté de la durée paramétrée (la LTV continue d'utiliser la durée **paramétrée** — la durée déduite est un indicateur de contrôle, trop volatile sur un seul mois pour piloter la LTV). Seeds : avril 7 résiliations (churn 3.33 % → durée déduite 30 mois = paramétrée), mai 13 (roll-forward cohérent 210 + 31 − 13 = 228 ; durée déduite 17.5 mois, illustre l'écart).
31. **CAPEX source de vérité** : la table `profit_capex` (acquisition, fit-out, machines) alimente automatiquement les amortissements du P&L (montant / durée tant que l'actif est en cours d'amortissement). Les **machines Versoix (180k/60 mois) migrent des réglages club vers `profit_capex`** ; les champs equipment des réglages restent comme mode simple/fallback (additifs). L'override d'amortissement du simulateur remplace le total (contrôle manuel complet).
32. **Dette en annuités constantes** (amortissement français) : mensualité = P × r / (1 − (1+r)^−n), intérêts sur capital restant dû — le standard des prêts bancaires. **Intérêts dans le P&L entre EBIT et impôt** (l'assiette de l'impôt passe de l'EBIT au résultat avant impôt = EBIT − intérêts) ; **remboursement du capital uniquement dans le cash flow**, jamais dans le P&L.
33. **Cash flow** = résultat net + amortissements (non-cash) − remboursement capital − CAPEX décaissé dans le mois. Trésorerie cumulée calculée sur la fenêtre des mois saisis (solde initial 0) ; les flux antérieurs au premier mois saisi (CAPEX janvier, tirage du prêt) sont du financement pré-ouverture, hors fenêtre. Le tirage du prêt n'apparaît pas en entrée de cash (symétrique de l'exclusion du CAPEX de janvier).
34. **Break-even intègre désormais les intérêts** (coût mensuel certain) : ⌈(OPEX + amortissements + intérêts + acquisition − annexes HT) / ARPU HT⌉ — à l'équilibre le résultat avant impôt est nul, donc pas d'impôt.
35. **ROI club** = EBITDA annualisé (somme des 12 derniers mois réels disponibles, extrapolée ×12/n) / total CAPEX investi. Avec 2 mois de démo Versoix : (3 890 + 7 835.88) × 6 / 430 000 = **16.4 %**.
36. **Forecast** : logé dans l'onglet Simulateur comme second mode (« Forecast 3-5 ans ») pour garder 5 onglets dans la bottom nav mobile. Hypothèses par club initialisées depuis le dernier mois réel (membres, ARPU, churn constaté, OPEX, acquisition), modifiables par sliders, horizon 36/48/60 mois. Membres(t+1) = membres(t) + nouveaux − membres(t) × churn. OPEX inflaté en continu ((1+i)^(mois/12)). Amortissements et intérêts projetés depuis les échéanciers réels CAPEX/dette (fin de prêt et fin d'amortissement respectées). Consolidé groupe = somme des projections des 4 clubs. Hypothèses **non persistées** (outil d'exploration ; la sauvegarde de scénarios forecast viendra avec la couche dashboards investisseur).
37. **Saisie des flux investisseur** : financements et CAPEX se gèrent dans Réglages (liste + ajout + suppression par club), pas dans la saisie mensuelle — ce sont des événements ponctuels, pas des données de mois.

## Frontend

16. **JavaScript (JSX) plutôt que TypeScript** : cohérent avec le reste du repo, build plus simple, la logique métier est centralisée et testée dans `src/lib/calc.js` (21 assertions offline).
17. **PWA manuelle** (manifest + service worker network-first qui ne cache jamais les appels Supabase) plutôt que vite-plugin-pwa : moins de dépendances, suffisant pour l'install mobile + safe-area.
18. **Brand** : fond `#09090B`, accent `#F97316`, Bebas Neue (titres), DM Sans (body), **Inter + `tabular-nums` sur toutes les valeurs numériques** via la classe utilitaire `.num` appliquée à chaque chiffre affiché (KPI, tableaux, tooltips, inputs).
19. **Simulateur** : porte son propre ARPU + durée (sliders) pour fonctionner sans données réelles ; « Partir du réel » précharge le mois sélectionné, la comparaison scénario vs réel affiche les écarts signés colorés. Les scénarios sont sauvegardés en jsonb avec leur `base_month`.
20. **Validation réseau** : le conteneur de build n'a pas d'accès réseau direct à Supabase (« Host not in allowlist ») — la validation E2E (auth + RLS + roundtrip scénario) a donc été faite **en SQL par impersonation de rôles** via MCP (mêmes garanties), et `scripts/validate.mjs` reste fourni pour la rejouer depuis un environnement avec réseau. Les calculs sont validés offline par `scripts/calc.test.mjs`.
