# White-Label-Theming (frontend#18)

## Entscheidung
Branding (Logo, Name, Dokumenttitel, Favicon, Markenfarben) kommt aus typisierten TS-Themes in `src/theme/`.
Ausgewählt wird per `VITE_THEME` (`window.__ENV__` via `env-config.js`/`envsubst`, lokal `import.meta.env`).
Ein Image kann so ohne Rebuild für verschiedene Hochschulen gebrandet werden.

## Ablauf
`docker-entrypoint.sh` (envsubst) → `env-config.js` → `main.ts`:
`resolveTheme(env.THEME)` → `applyTheme()` (schreibt `--color-*` auf `:root`, setzt `document.title` + Favicon) → `app.mount()`.
Unbekannter/leerer Name → `default` + `console.warn`. Templates lesen Logo/Name über `useTheme()` (Wert ändert sich zur Laufzeit nicht).

## Token-Rollen
- **Themebar** (`THEME_COLOR_KEYS`): `primary*`, `primary-soft`, `primary-faint`, `primary-action(-hover)`, `brand-accent(-soft)`, `brand-indicator` (Sidebar-Aktivmarker), `bg-soft`, `surface-tint|page|dark`. Nur in `src/theme/themes/*`, nicht in `colors.css`.
- **Konstant** (`src/styles/colors.css`): Semantik (`success`, `warning`, `danger`, `info`, `status-*`), Text, Border, `on-dark`, `destructive(-soft)`.
- Rollennamen statt Farbnamen (`primarySoft` statt `lightGreen` …); Guards in `tests/unit/styles/colors.spec.ts` verhindern alte Namen.

## Neues Theme anlegen
1. `src/theme/themes/<id>.ts` mit `Theme` anlegen (alle 16 Farbschlüssel, Logo unter `src/theme/assets/`, Favicon unter `public/themes/<id>/`).
2. In `src/theme/index.ts` in `THEMES` registrieren.
3. `npm run test` — Struktur- und Kontrast-Guards (WCAG ≥ 4,5 für Weiß auf `primary`, `primary-deep`, `primary-action`) müssen grün sein.

## Nicht-Ziele
Laufzeit-API/`theme.json`, Theme-Switcher, Mandantenverwaltung, Backend-Speicherung, Layout-Umbau, Änderung semantischer Farben.
`t3-demo` ist ein Demo-Theme und **kein** offizielles DHBW-Corporate-Design.
