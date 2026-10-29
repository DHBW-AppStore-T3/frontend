# Themes

Das Theming-System steuert Farben, Logos, Favicon, Seitentitel und das Login-/Dashboard-Hintergrundbild. Alle Theme-Dateien liegen in `src/theme/`.

## Funktionsweise

Beim App-Start liest `bootstrap.tsx` die Umgebungsvariable `VITE_THEME` und ruft `resolveTheme()` auf. Diese gibt das passende `Theme`-Objekt zurück — bei fehlendem oder unbekanntem Wert immer `t3`. `applyTheme()` schreibt dann alle Farbkanäle als CSS-Variablen auf das `<html>`-Element und setzt Titel und Favicon.

Im Container wird `VITE_THEME` über `env-config.js` und `envsubst` zur Laufzeit gesetzt (nicht zur Build-Zeit).

## Neues Theme anlegen

1. `src/theme/themes/t3.ts` nach `src/theme/themes/<id>.ts` kopieren.
2. `id`, `brand`, `logo`, `favicon` und alle Farbwerte anpassen.
   - Logos und Hintergrundbild nach `src/theme/assets/` legen.
   - Favicon nach `public/themes/<id>/favicon.png`.
3. Das neue Theme in `THEMES` in `src/theme/index.ts` registrieren.
4. Lokal testen:
   ```bash
   VITE_THEME=<id> npm run dev
   # PowerShell: $env:VITE_THEME='<id>'; npm run dev
   ```
5. Qualitätscheck:
   ```bash
   npm run lint
   npx tsc -b --noEmit
   npm run test
   npm run build
   ```

## Theme-Vertrag (`src/theme/types.ts`)

Jedes Theme muss das `Theme`-Interface erfüllen:

```ts
interface Theme {
  id: string
  brand: { name: string; tagline: string; documentTitle: string }
  logo: { src: string; alt: string; height: number; offsetX: number; offsetY: number }
  authLogo?: { src: string; alt: string; height: number }  // Fallback: logo
  loginBackground?: string                                  // Wird auf Login und Dashboard gezeigt
  favicon: string                                           // Pfad relativ zu public/
  colors: Record<ThemeColorKey, Rgb>                        // Alle Schlüssel aus THEME_COLOR_KEYS
}
```

`Rgb` ist ein String mit drei Leerzeichen-getrennten Dezimalwerten, z. B. `"226 0 26"`. Tailwind nutzt diese Kanäle via `rgb(var(--color-primary) / <alpha>)`.

## Farbschlüssel

Alle Schlüssel aus `THEME_COLOR_KEYS` müssen im `colors`-Objekt gesetzt sein. Kategorien:

| Kategorie | Schlüssel (Auswahl) |
|---|---|
| Primärfarben | `primary`, `primary-dark`, `primary-light`, `primary-deep`, `primary-darkest`, `primary-soft`, `primary-faint`, `primary-action`, `primary-action-hover`, `primary-hover`, `primary-active`, `primary-subtle` |
| Brand-Akzent | `brand-accent`, `brand-accent-soft`, `brand-indicator` |
| Oberflächen | `bg-soft`, `surface-tint`, `surface-page`, `surface-dark`, `surface-muted`, `surface`, `surface-elevated` |
| Ränder | `border-subtle`, `border`, `border-strong`, `focus` |
| Text | `text-strong`, `text-heading`, `text-muted`, `text-faint`, `text-primary`, `text-secondary`, `text-on-primary` |
| Auth-Bereich | `auth-accent`, `auth-accent-hover`, `auth-muted`, `auth-surface`, `auth-heading`, `auth-fold`, `auth-card-*`, … |
| Workspace | `workspace-shadow`, `workspace-fold` |
| Semantisch | `success`, `success-hover`, `success-tint`, `warning`, `warning-tint`, `error`, `danger`, `danger-tint`, `info`, `info-tint` |
| Status-Punkte | `status-green`, `status-yellow`, `status-orange`, `status-slate` |
| Sonstige | `destructive`, `destructive-soft`, `on-dark`, `background` |

Produkticon-Markenfarben (App-Kacheln) stehen separat in `src/styles/colors.css` und gehören nicht ins Theme-Objekt.

## Beispiel: Hochschul-Theme

```ts
import { t3Theme } from './t3'
import logo from '../assets/campus-logo.png'

export const campusTheme: Theme = {
  id: 'campus',
  brand: { name: 'Campus', tagline: 'AppStore', documentTitle: 'Campus AppStore' },
  logo: { src: logo, alt: 'Campus AppStore', height: 36, offsetX: 0, offsetY: 0 },
  favicon: '/themes/campus/favicon.png',
  colors: {
    ...t3Theme.colors,           // alle Werte erben
    primary: '0 85 140',         // Hochschulblau überschreiben
    'primary-dark': '0 65 110',
    'primary-action': '0 85 140',
    'primary-action-hover': '0 65 110',
  },
}
```

Dann in `src/theme/index.ts`:

```ts
import { campusTheme } from './themes/campus'

export const THEMES: Record<string, Theme> = {
  [t3Theme.id]: t3Theme,
  [campusTheme.id]: campusTheme,
}
```

Es sind keine View-Änderungen nötig.
