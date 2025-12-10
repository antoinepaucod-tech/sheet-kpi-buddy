# 🎨 CHARTE GRAPHIQUE - STYLE PROFESSIONNEL MINIMALISTE

> **Copiez ce document dans "Custom Knowledge" (Settings → Manage Knowledge) de vos projets Lovable pour maintenir une cohérence visuelle.**

---

## PHILOSOPHIE DE DESIGN

- **Style** : Minimaliste professionnel monochrome
- **Approche** : Élégance par la simplicité, contraste noir/blanc avec accents colorés fonctionnels
- **Tonalité** : Professionnelle, épurée, moderne

---

## PALETTE DE COULEURS (HSL)

### Mode Clair

```
Background: 0 0% 100% (blanc pur)
Foreground: 0 0% 10% (noir profond)
Card: 0 0% 96% (gris très clair)
Card-foreground: 0 0% 10%
Popover: 0 0% 100%
Popover-foreground: 0 0% 10%
Primary: 0 0% 15% (noir charbon)
Primary-foreground: 0 0% 98%
Primary-glow: 0 0% 25%
Secondary: 0 0% 96% (gris clair)
Secondary-foreground: 0 0% 10%
Muted: 0 0% 96%
Muted-foreground: 0 0% 45%
Accent: 0 0% 15%
Accent-foreground: 0 0% 98%
Border: 0 0% 85%
Input: 0 0% 85%
Ring: 0 0% 15%
```

### Mode Sombre

```
Background: 0 0% 7% (noir profond)
Foreground: 0 0% 95% (blanc cassé)
Card: 0 0% 10%
Card-foreground: 0 0% 95%
Popover: 0 0% 10%
Popover-foreground: 0 0% 95%
Primary: 0 0% 95%
Primary-foreground: 0 0% 10%
Primary-glow: 0 0% 80%
Secondary: 0 0% 15%
Secondary-foreground: 0 0% 95%
Muted: 0 0% 15%
Muted-foreground: 0 0% 60%
Accent: 0 0% 95%
Accent-foreground: 0 0% 10%
Border: 0 0% 18%
Input: 0 0% 18%
Ring: 0 0% 80%
```

### Couleurs Sémantiques (identiques light/dark)

```
Success: 142 71% 45% (vert)
Success-foreground: 0 0% 100%
Warning: 38 92% 50% (orange)
Warning-foreground: 0 0% 100% (light) / 0 0% 10% (dark)
Destructive: 0 84% 60% (rouge)
Destructive-foreground: 0 0% 100%
```

### Couleurs Graphiques

```
Chart-1: 0 0% 20% (light) / 0 0% 80% (dark) - données primaires
Chart-2: 0 0% 35% (light) / 0 0% 60% (dark) - données secondaires
Chart-3: 142 71% 45% - vert (positif/succès)
Chart-4: 38 92% 50% - orange (attention/warning)
Chart-5: 346 77% 50% - rose (alerte/destructive)
```

---

## TYPOGRAPHIE

### Police Principale : Inter

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

### Configuration CSS

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-feature-settings: "rlig" 1, "calt" 1;
  letter-spacing: -0.011em;
}
```

### Styles Typographiques

| Style | Weight | Letter-spacing | Usage |
|-------|--------|----------------|-------|
| Corps | 400 | -0.011em | Texte courant |
| Heading | 500 | -0.015em | Sous-titres, labels importants |
| Display | 600 | -0.02em | Titres principaux, métriques |

### Classes Utilitaires

```css
.text-display {
  font-weight: 600;
  letter-spacing: -0.02em;
}

.text-heading {
  font-weight: 500;
  letter-spacing: -0.015em;
}
```

---

## COMPOSANTS UI

### Border Radius

```
Base (--radius): 0.5rem (8px)
lg: var(--radius) = 0.5rem
md: calc(var(--radius) - 2px) = 0.375rem
sm: calc(var(--radius) - 4px) = 0.25rem
```

### Ombres

```css
/* Mode Clair */
--shadow: 0 4px 6px -1px rgb(0 0 0 / 0.15), 0 2px 4px -2px rgb(0 0 0 / 0.12), 0 1px 3px 0 rgb(0 0 0 / 0.08);
--shadow-md: 0 10px 15px -3px rgb(0 0 0 / 0.15), 0 4px 6px -4px rgb(0 0 0 / 0.12);

/* Mode Sombre */
--shadow: 0 2px 4px -1px rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3);
```

### Effets Visuels

```css
/* Effet de lueur subtile */
.glow-effect {
  box-shadow: 0 0 30px hsla(var(--foreground), 0.1);
}

/* Dégradés */
.gradient-primary {
  background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)));
}

.gradient-secondary {
  background: linear-gradient(135deg, hsl(var(--secondary)), hsl(var(--primary)));
}

.gradient-success {
  background: linear-gradient(135deg, hsl(var(--success)), hsl(var(--accent)));
}
```

---

## ANIMATIONS

### Fade In

```css
.animate-fade-in {
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Accordion

```css
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

.animate-accordion-down { animation: accordion-down 0.2s ease-out; }
.animate-accordion-up { animation: accordion-up 0.2s ease-out; }
```

---

## PATTERNS DE DESIGN

### Cards
- Fond : `bg-card`
- Bordures : `border border-border` (subtiles)
- Hover : légère élévation avec `shadow-md`
- Padding : `p-4` ou `p-6`

### Boutons
- **Primary** : `bg-primary text-primary-foreground` (fond noir, texte blanc)
- **Secondary** : `bg-secondary text-secondary-foreground` (fond gris clair)
- **Destructive** : `bg-destructive text-destructive-foreground`
- **Ghost** : Transparent avec hover `bg-muted`

### Tableaux
- Headers : `bg-muted text-muted-foreground`
- Lignes : alternance subtile avec `hover:bg-muted/50`
- Bordures : `border-b border-border`

### Badges
- Arrondis : `rounded-full` ou `rounded-md`
- Couleurs sémantiques : success/warning/destructive selon contexte
- Taille : `text-xs` avec `px-2 py-1`

### Inputs
- Bordures : `border-input`
- Focus : `ring-2 ring-ring ring-offset-2`
- Placeholder : `text-muted-foreground`

---

## RÈGLES IMPORTANTES

### ✅ À FAIRE

1. **Toujours** utiliser les tokens sémantiques (`bg-background`, `text-foreground`, etc.)
2. **Toutes les couleurs** définies en HSL
3. **Support dark mode** obligatoire via classe `.dark`
4. **Responsive** : mobile-first, breakpoints Tailwind standards
5. Utiliser les classes utilitaires définies (`text-display`, `text-heading`)

### ❌ À ÉVITER

1. **Jamais** de couleurs directes (`bg-white`, `text-black`, `bg-gray-100`)
2. **Jamais** de valeurs RGB ou HEX dans le code
3. **Jamais** d'inline styles pour les couleurs
4. **Jamais** de polices autres qu'Inter sans validation

---

## CONFIGURATION TAILWIND

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

---

## UTILISATION

1. Copiez le contenu de ce fichier
2. Dans votre projet Lovable, allez dans **Settings → Manage Knowledge**
3. Collez ce contenu comme instruction personnalisée
4. L'IA appliquera automatiquement cette charte graphique à vos nouveaux composants

---

*Dernière mise à jour : Décembre 2024*
