# Theming-Guide: Ein neues Theme hinzufügen

Ziel: Ein neues Theme (z. B. eine weitere Hochschule) soll mit **einer Datei, ein paar Assets und einer Zeile Registrierung** hinzugefügt
werden können, ohne dass eine View geändert werden muss.

Dieser Guide beschreibt den Stand des Branches `demo/mannheim-theme` (Referenz-Implementierung: `mannheim`, Basis: `t3`).
Auf `main` ist das System noch kleiner (nur 16 Farb-Tokens, Themes `default` und `t3-demo`, siehe Abschnitt 9).

Verifiziert gegen: `src/theme/*`, `src/styles/*`, `tailwind.config.js`, `src/layouts/*`, `src/views/LoginView.vue`,
`tests/unit/theme|styles/*` und `docs/themes.md` auf dem Branch.

## 1. Funktionsweise

```
VITE_THEME → src/env.ts → resolveTheme(id) → applyTheme(theme) → app.mount()
```

- `applyTheme()` schreibt jeden Eintrag aus `theme.colors` als `--color-<key>` auf `:root`. Die optionalen `theme.styles` landen als
  `--theme-<key>`. Außerdem setzt es `document.title` und das Favicon.
- [tailwind.config.js](../tailwind.config.js) mappt die `--color-*`-Variablen auf Tailwind-Klassen
  (`--color-primary-dark` → `bg-primaryDark`, `text-primaryDark`, …). Werte stehen als Kanal-Tripel **`'R G B'`** (nicht Hex, nicht `rgb()`),
  damit Alpha-Modifier wie `bg-primary/20` funktionieren.
- Layouts und Views lesen Logo, Name und Hintergrundbild über `useTheme()`. Das Theme wird einmal beim Boot gesetzt und ändert sich zur
  Laufzeit nicht. Es gibt keinen Theme-Switcher.
- Ohne `VITE_THEME` gilt `t3`. Unbekannte IDs fallen ebenfalls auf `t3` zurück (mit `console.warn`). Es gibt keine Alias-Namen
  (`default`, `six7`, `t3-demo` sind entfernt, ein Test prüft das).

## 2. Checkliste

| # | Was | Wo |
|---|-----|----|
| 1 | Theme-Datei (Kopie von `t3.ts`) | `src/theme/themes/<id>.ts` |
| 2 | Logo (Sidebar und Login) | `src/theme/assets/<id>-logo.png` |
| 3 | Optional: Hintergrundbild (Login + Dashboard) | `src/theme/assets/<id>-<name>.jpg\|png` |
| 4 | Favicon | `public/themes/<id>/favicon.png` |
| 5 | Registrierung | `src/theme/index.ts` → `THEMES` |
| 6 | Prüfen | `npm run lint`, `npx vue-tsc -b --noEmit`, `npm run test`, `npm run build` |
| 7 | Aktivieren | `VITE_THEME=<id>` |

Es müssen keine Views, Layouts oder CSS-Dateien angepasst werden.

## 3. Das `Theme`-Objekt (`src/theme/types.ts`)

```ts
export const meinTheme: Theme = {
  id: 'mein-theme',
  brand: { name, tagline, documentTitle, institution? },
  logo: { src, alt, height, offsetX, offsetY },
  authLogo: { src, alt, height },       // optional
  loginBackground,                       // optional
  favicon: '/themes/mein-theme/favicon.png',
  styles: { 'dashboard-scrim', 'dashboard-position' },   // optional
  colors: { ...t3Theme.colors, 'primary': '…', /* Überschreibungen */ },
}
```

### 3.1 Branding-Felder

| Feld | Wirkung | Verwendet in |
|------|---------|--------------|
| `id` | Wert von `VITE_THEME`, muss dem Schlüssel in `THEMES` entsprechen | `resolveTheme`, Test `themes.spec.ts` |
| `brand.name` | Name der Marke. `aria-label` des Login-Logos | `AuthLayout.vue` |
| `brand.tagline` | Untertitel neben dem Login-Logo | `AuthLayout.vue` |
| `brand.documentTitle` | Browser-Tab-Titel | `applyTheme()` |
| `brand.institution` | Optional. Name in den Login-Texten ("Mit {institution} anmelden", "Der {institution} AppStore …"). Fehlt er, wird `DHBW` genommen | `LoginView.vue` |
| `logo` | Hauptlogo: Sidebar. `height`, `offsetX`, `offsetY` in px justieren die Position | `AppSidebar.vue` |
| `authLogo` | Optional. Logo für die Login-Seite. Fehlt es, wird `logo` benutzt | `AuthLayout.vue` |
| `loginBackground` | Optional. Dekoratives Bild für die Login-Seite **und** den Dashboard-Kopf | `AuthLayout.vue`, `AppLayout.vue` |
| `favicon` | Pfad unter `public/`, mit führendem `/` | `applyTheme()` |
| `styles['dashboard-scrim']` | Optional. CSS-Hintergrund (Verlauf), der über das Dashboard-Bild gelegt wird, damit Text lesbar bleibt | `workspace.css` |
| `styles['dashboard-position']` | Optional. `background-position` des Dashboard-Bildes (z. B. `center 58%`) | `workspace.css` |

Hinweise:
- Logos und Hintergrundbilder werden per `import` aus `src/theme/assets/` geladen (Vite hasht sie). Nur das Favicon liegt unter `public/`.
- Das Logo wird auf Login-Seite und teilweise in der Sidebar als **CSS-Maske** (`--logo-mask-url`, `sidebar-brand-mark`) gerendert
  und mit der Primärfarbe eingefärbt. Das Logo sollte deshalb eine **einfarbige Form auf transparentem Hintergrund** sein. Mehrfarbige Logos erscheinen
  als einfarbige Silhouette.
- `styles` ist komplett optional. Fehlt ein Wert, greift das Standard-Aussehen aus `workspace.css`.

## 4. Farb-Tokens (`theme.colors`)

`THEME_COLOR_KEYS` enthält ca. 70 Schlüssel. **Alle sind Pflicht** (der Test `themes.spec.ts` vergleicht die Schlüsselmenge exakt und prüft das
Format `'R G B'`, jeder Kanal ≤ 255). Der einfachste Weg ist deshalb, `t3Theme.colors` zu spreaden und nur das Abweichende zu überschreiben
(so macht es `mannheim.ts`).

### 4.1 Marke / Primärfarbe (am wichtigsten)

| Schlüssel | Tailwind | Rolle |
|-----------|----------|-------|
| `primary` | `primary` | Hauptfarbe: Logo-Maske, aktive Nav-Einträge, Links, Buttons, Mesh-/Verlaufsflächen. **Weiß muss darauf lesbar sein** |
| `primary-dark` | `primaryDark` | Dunklere Variante (Hover) |
| `primary-light` | `primaryLight` | Hellere Variante |
| `primary-deep` | `primaryDeep` | Sehr dunkel. **Weiß muss darauf lesbar sein** |
| `primary-darkest` | `primaryDarkest` | Dunkelster Ton |
| `primary-soft` | `primarySoft` | Weiche Markenfläche / Border |
| `primary-faint` | `primaryFaint` | Sehr helle Markenfläche |
| `primary-action` | `primaryAction` | Primäre Aktions-Buttons. **Weiß muss darauf lesbar sein** |
| `primary-action-hover` | `primaryActionHover` | Hover von `primary-action` |
| `primary-hover`, `primary-active`, `primary-subtle` | `primaryHover`, `primaryActive`, `primarySubtle` | Zustands-Varianten (Hover, gedrückt, dezent). In der Praxis auf `primary-dark`, `primary-deep`, `primary-faint` setzen |
| `focus` | `focus` | Fokus-Ring |
| `brand-accent`, `brand-accent-soft` | `brandAccent`, `brandAccentSoft` | Zweitfarbe/Akzent und deren helle Fläche |
| `brand-indicator` | `brandIndicator` | Marker des aktiven Menüpunkts (Altbestand) |

### 4.2 Flächen, Text, Border

| Schlüssel | Rolle |
|-----------|-------|
| `bg-soft`, `background`, `surface-page` | Seitenhintergrund (alle drei im selben Ton halten) |
| `surface`, `surface-elevated` | Karten, erhöhte Flächen (meist Weiß) |
| `surface-tint`, `surface-muted` | Leicht getönte bzw. gedämpfte Flächen (Hover, Tabellenköpfe) |
| `surface-dark` | Dunkle Fläche (z. B. Dropdown) |
| `text-heading`, `text-strong`, `text-muted`, `text-faint` | Textstufen von stark bis blass |
| `text-primary`, `text-secondary`, `text-on-primary` | Semantische Text-Rollen (`text-on-primary` = Text auf `primary`, i. d. R. Weiß) |
| `border-subtle`, `border`, `border-strong` | Rahmenstärken |
| `on-dark` | Text/Symbole auf dunklen Flächen (Weiß). Dient auch als Basis für transparente Weißflächen |

### 4.3 Login-Seite (`auth-*`)

Die Login-Seite hat eine eigene, feste Komposition (`src/theme/auth.css`). Nur ihre Farben sind themebar:

`auth-accent`, `auth-accent-hover`, `auth-heading`, `auth-muted`, `auth-surface`, `auth-fold`, `auth-mobile-fold`, `auth-divider`,
`auth-feature-icon`, `auth-language-border`, `auth-language-text`, `auth-language-selected`, `auth-language-hover`,
`auth-connector-border`, `auth-connector-line`, `auth-card-border`, `auth-card-surface`, `auth-card-text`, `auth-card-shadow`, `auth-status-ring`.

Faustregel: `auth-accent` = Primärfarbe (ggf. etwas dunkler), `auth-accent-hover` dunkler, `auth-language-selected`/`-hover` helle
Primärtöne, `auth-status-ring` mittlerer Primärton, der Rest sind Neutraltöne mit leichtem Farbstich der Marke.

### 4.4 Workspace (App-Bereich)

| Schlüssel | Rolle |
|-----------|-------|
| `workspace-shadow` | Schattenfarbe der Karten (`workspace.css`) |
| `workspace-fold` | Farbe der diagonalen Hintergrund-"Falte" im App-Bereich |

### 4.5 Semantik und Status

`success`, `success-hover`, `success-tint`, `warning`, `warning-tint`, `danger`, `danger-tint`, `error`, `info`, `info-tint`,
`destructive`, `destructive-soft`, `status-green`, `status-yellow`, `status-orange`, `status-slate`.

Diese sind **technisch Theme-Tokens**, sollten aber in der Regel von `t3` geerbt und nicht verändert werden, damit Erfolg/Warnung/Fehler
überall gleich aussehen. Der Spread `...t3Theme.colors` erledigt das automatisch.

### 4.6 Tokens, die (noch) kaum benutzt werden

Folgende Schlüssel sind Pflicht, werden aber in den Vue-Dateien aktuell nicht oder nur selten als Tailwind-Klasse benutzt (Stand Branch):
`text-on-primary`, `surface-elevated`, `border-strong`, `text-primary`, `text-secondary`, `primary-hover`, `primary-active`,
`primary-subtle`, `background`, `surface`, `error`, `brand-indicator`, `surface-dark`, `surface-page`, `primary-light`, `primary-darkest`.
Sie sind Teil des Vertrags (neue Views dürfen sie nutzen), trotzdem konsistent pflegen.

## 5. Nicht themebar (global)

| Datei | Inhalt |
|-------|--------|
| `src/styles/tokens.css` | Radien, Schatten, Abstände, Schriftgrößen/-gewichte, `--font-family-sans`. Gilt für alle Themes. Eine eigene Schrift pro Theme ist **nicht** vorgesehen |
| `src/styles/fonts.css` | Schriftart-Einbindung (`Auth Inter`) |
| `src/styles/colors.css` | Nur Produkt-Icon-Farben (`--color-logo-orange`, `-cloud`, `-r`, `-postgres`) |
| `src/theme/auth.css`, `src/theme/workspace.css` | Geometrie und Layout von Login bzw. Workspace (Größen, Radien, Verläufe). Die Farben kommen aus den Tokens |

Die Tests verbieten außerdem willkürliche Werte: `rounded-[…]`, `shadow-[…]` (außer tokenisierte Glows) und Inline-`border-radius`/`box-shadow`
in `.vue`-Dateien, außerdem Tailwind-Standardfarben im Config (`tests/unit/styles/*.spec.ts`).

## 6. Schritt für Schritt

1. **Assets**: Logo (einfarbig, transparent) nach `src/theme/assets/`, optional Hintergrundbild, Favicon nach `public/themes/<id>/favicon.png`.
2. **Theme-Datei**: `src/theme/themes/<id>.ts` anlegen (Vorlage `mannheim.ts`):
   ```ts
   import type { Theme } from '../types'
   import { t3Theme } from './t3'
   import logo from '../assets/<id>-logo.png'

   export const meinTheme: Theme = {
     id: 'mein-theme',
     brand: { name: 'Hochschule X', tagline: 'AppStore', documentTitle: 'Hochschule X AppStore', institution: 'HS X' },
     logo: { src: logo, alt: 'Hochschule X', height: 36, offsetX: 0, offsetY: 6 },
     authLogo: { src: logo, alt: 'Hochschule X', height: 72 },
     favicon: '/themes/mein-theme/favicon.png',
     colors: { ...t3Theme.colors, 'primary': '0 85 140', /* … */ },
   }
   ```
3. **Farben überschreiben**: mindestens Marke (4.1), Flächen/Text (4.2) und Login (4.3). Immer als Gruppe ändern: Wer `primary` ändert, muss
   `primary-dark/-deep/-darkest/-soft/-faint/-action(-hover)/-hover/-active/-subtle`, `focus` und `auth-accent*` mitziehen, sonst bleiben
   T3-Rot-Reste sichtbar.
4. **Registrieren** in `src/theme/index.ts`: Import und Eintrag in `THEMES`.
5. **Starten**: `$env:VITE_THEME='mein-theme'; npm run dev` (PowerShell) bzw. `VITE_THEME=mein-theme npm run dev`.
6. **Visuell prüfen**: `/login`, `/dashboard` (Hintergrundbild + Scrim), Apps, App-Detail, Deployments, User, Sidebar ein-/ausgeklappt,
   aktiver Menüpunkt, deutsch/englisch (Login-Texte mit `institution`).
7. **Tests**: `npm run test` — `themes.spec.ts` (Vertrag, Format), `contrast.spec.ts` (Weiß auf `primary`, `primary-deep`, `primary-action` ≥ 4,5),
   `colors.spec.ts`, `tokens.spec.ts`.
8. **Container**: `VITE_THEME=<id>` setzen. `docker-entrypoint.sh` ersetzt per `envsubst` den Platzhalter in `public/env-config.js`.
   Ein Image genügt für alle Themes. Laut `claude_docs/HANDOVER.md` reicht das `deployment`-Repo die Variable in den Compose-Dateien noch nicht durch.

## 7. Bekannte Stellen außerhalb des Theme-Systems

1. **`index.html`**: `<title>App Store</title>` und das Favicon (auf dem Branch `/themes/t3/favicon.png`) sind der Zustand vor dem Boot. `applyTheme()`
   überschreibt beides, ein kurzes Flackern ist möglich.
2. **Texte in `src/i18n/locales/{de,en}.ts`**: Nur die Login-Texte nutzen `{institution}`. Andere Markennamen im Text sind nicht angebunden.
3. **Projektbezogene Links/Namen** (GitHub-Links in `HelpView.vue`, Git-User in `AddAppsView.vue`/i18n) gehören zum Projekt, nicht zum Theme.
4. **Tailwind-Standardfarben** in Views (z. B. `text-blue-700`, `emerald-*`) bleiben in allen Themes gleich.
5. **Schriftart und Layoutmaße** sind pro Theme nicht änderbar (Abschnitt 5).

## 8. Fehlerbilder

| Symptom | Ursache |
|---------|---------|
| `Unknown theme "…"`, es erscheint T3 | `id` nicht in `THEMES` registriert oder Tippfehler in `VITE_THEME` |
| Test `themes.spec.ts` rot (Schlüssel) | Ein Pflicht-Token fehlt, am besten `...t3Theme.colors` spreaden |
| Farben schwarz/kaputt | Wert nicht als `'R G B'` (Hex oder `rgb()` statt `'0 47 86'`) |
| Test `contrast.spec.ts` rot | `primary`, `primary-deep` oder `primary-action` zu hell für weißen Text |
| Rote T3-Reste sichtbar | Primär-Gruppe, `focus` oder `auth-*` nicht mitgeändert |
| Logo wird zur Silhouette | Gewolltes Verhalten: Maske in Primärfarbe. Einfarbiges Logo verwenden |
| Dashboard-Text schlecht lesbar | `styles['dashboard-scrim']` setzen (Verlauf von `bg-soft` auf transparent) |
| Logo in der Sidebar verschoben | `logo.height/offsetX/offsetY` anpassen |
| Favicon bleibt alt | Pfad nicht unter `public/` oder `/` am Anfang fehlt; Browser-Cache leeren |

## 9. Unterschied zu `main`

| | `main` | Branch `demo/mannheim-theme` |
|---|---|---|
| Themes | `default` (SIX7), `t3-demo` | `t3` (Standard), `mannheim` |
| Farb-Tokens | 16 | ca. 70 (inkl. `auth-*`, `workspace-*`, Semantik, Text, Border) |
| Zusatzfelder | – | `loginBackground`, `brand.institution`, `styles` |
| Globale Design-Tokens | – | `tokens.css` (Radius, Schatten, Abstände, Typografie) |
| Layouts | Sidebar/Header in `AppLayout.vue` | `AppSidebar`, `AppHeader`, `SidebarNavigation`, Styles in `auth.css`/`workspace.css` |
| Fallback bei unbekannter ID | `default` | `t3` |

## 10. Betroffene Dateien

Stand: Branch `demo/mannheim-theme`. Grundlage der Liste ist der Diff `47ba24c` (T3-Redesign, Basis) bis zur Spitze des Branches
sowie eine Textsuche nach `--color-`, `--theme-` und `useTheme`.

### 10.1 Was für ein neues Theme angelegt oder geändert werden muss

Am Beispiel Mannheim. Mehr braucht ein weiteres Theme nicht:

| Datei | Änderung |
|-------|----------|
| `src/theme/themes/<id>.ts` | **neu**, das Theme (Farben, Branding, Logo-Angaben) |
| `src/theme/index.ts` | Import und Eintrag in `THEMES` |
| `src/theme/assets/<id>-*.png\|jpg` | **neu**, Logo und optional Hintergrundbild |
| `public/themes/<id>/favicon.png` | **neu**, Favicon |

### 10.2 Was beim Ausbau für Mannheim einmalig am System geändert wurde

Gilt seitdem für alle Themes, muss für weitere Themes nicht wiederholt werden:

| Datei | Änderung |
|-------|----------|
| `src/theme/types.ts` | `brand.institution` und `styles` im Typ `Theme` ergänzt |
| `src/theme/applyTheme.ts` | schreibt `theme.styles` als `--theme-*` auf `:root` |
| `src/theme/workspace.css` | Dashboard-Scrim und -Position über `--theme-dashboard-scrim` und `--theme-dashboard-position` |
| `src/views/LoginView.vue` | liest `brand.institution` (Fallback `DHBW`) |
| `src/i18n/locales/de.ts`, `en.ts` | Login-Texte mit Platzhalter `{institution}` |
| `tests/unit/theme/applyTheme.spec.ts` | Test für `styles` |

### 10.3 Dateien, die die Variablen definieren oder nutzen

| Rolle | Dateien |
|-------|---------|
| Definition und Vertrag | `src/theme/types.ts` (`THEME_COLOR_KEYS`, `THEME_STYLE_KEYS`), `src/theme/themes/*.ts`, `src/theme/applyTheme.ts`, `src/theme/useTheme.ts` |
| Mapping auf Tailwind | `tailwind.config.js` (jede `--color-*` hat einen Tailwind-Namen) |
| Konstante Variablen | `src/styles/colors.css` (nur Produkt-Icon-Farben), `src/styles/tokens.css` (Radius, Schatten, Abstände, Typografie), `src/styles/fonts.css` |
| CSS mit Theme-Variablen | `src/theme/auth.css` (Login), `src/theme/workspace.css` (App-Bereich) |
| Layouts und Komponenten | `src/layouts/AppLayout.vue`, `AuthLayout.vue`, `SidebarNavigation.vue`, `src/components/ui/AppLogo.vue`, `src/components/ui/Toast.vue` |
| Views mit direkten `--color-*`-Zugriffen | `AppsView`, `CoursesView`, `DashboardView`, `DeploymentDetailView`, `HelpView`, `LoginView`, `UserView` |
| Branding-Zugriff über `useTheme()` | `AuthLayout.vue`, `AppLayout.vue` und weitere Layouts/Views (Logo, Name, Hintergrundbild, `institution`) |
| Vor-Boot-Fallback | `index.html` (Titel und Favicon, werden von `applyTheme()` überschrieben) |
| Env-Weitergabe | `src/env.ts`, `public/env-config.js`, `docker-entrypoint.sh` (`VITE_THEME`) |
| Absicherung | `tests/unit/theme/*.spec.ts`, `tests/unit/styles/*.spec.ts`, `tests/unit/layouts/branding.spec.ts`, `tests/unit/env.spec.ts` |

Zusätzlich greifen alle `.vue`-Dateien mit Tailwind-Klassen wie `bg-primary` oder `text-textMuted` indirekt auf dieselben Variablen zu.
Sie müssen für ein neues Theme nicht angefasst werden. Die Anzahl dieser Dateien wurde nicht gezählt.

Der Guide ist bis zum Merge des Branches nach `main` nur dort gültig. Auf `main` gelten bis dahin nur die Abschnitte 1, 3 (ohne Zusatzfelder) und 8
sinngemäß mit den 16 Tokens aus `src/theme/types.ts`.
