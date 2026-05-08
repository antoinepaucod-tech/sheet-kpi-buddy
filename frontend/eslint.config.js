/**
 * ESLint flat config (ESLint 9+).
 *
 * Purpose: lock in TanStack Query v5 syntax across the codebase.
 *
 * The deprecated positional form `invalidateQueries(['key'])` is silently a
 * no-op in v5 (the first arg must be a filter object). Reference incident:
 * Sprint B Lot 2 (Feb 2026) — UI required F5 because legacy positional calls
 * were not refetching. After the v5 sweep (40 calls migrated), this rule
 * prevents the regression from reappearing.
 *
 * Run via:   yarn lint:rq    (see package.json scripts)
 * Also enforced at CRA build time via eslintConfig in package.json.
 */

module.exports = [
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='invalidateQueries'][arguments.0.type='ArrayExpression']",
          message:
            "TanStack Query v5: positional invalidateQueries(['key']) is deprecated and silently no-op. Use invalidateQueries({ queryKey: ['key'] }) instead.",
        },
        {
          selector:
            "CallExpression[callee.property.name='refetchQueries'][arguments.0.type='ArrayExpression']",
          message:
            "TanStack Query v5: positional refetchQueries(['key']) is deprecated. Use refetchQueries({ queryKey: ['key'] }) instead.",
        },
        {
          selector:
            "CallExpression[callee.property.name='cancelQueries'][arguments.0.type='ArrayExpression']",
          message:
            "TanStack Query v5: positional cancelQueries(['key']) is deprecated. Use cancelQueries({ queryKey: ['key'] }) instead.",
        },
      ],
    },
  },
];
