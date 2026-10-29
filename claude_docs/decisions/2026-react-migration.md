# Migration Vue 3 -> React 19 (Branch `spike/dev`)

**Status:** umgesetzt, nicht gemergt (Evaluierung auf `spike/dev`).

## Entscheidungen
- State: Zustand (statt Pinia); Zugriff ausserhalb von React via `useXStore.getState()`.
- Routing: React Router 7 (Data Router), Guards als `loader` (`src/router/guards.ts`).
- i18n: react-i18next mit `{}`-Interpolation, damit Locale-Dateien unveraendert bleiben.
- Tests: Vitest + React Testing Library; alle Vue-Specs portiert.
- Composables -> Hooks, Keycloak -> Singleton-Service `keycloak.service.ts`.
- Clean Code: pro View reine Logikmodule (`*.ts`, getestet) + Hooks + kleine Komponenten.

## Bewusste Abweichungen
- HTML-Meldungen mit Nutzerdaten werden escaped (`translateHtml`) statt rohem `v-html`.
- Deployment-Stream wird beim Unmount abgebrochen.
- Unbekannte Pfade leiten auf `/` um.
- Plural ueber i18next (`_one`/`_other`).

## Hinweis Docker
Nach der Migration das Dev-Volume erneuern (`docker compose up -V`), sonst fehlen React-Pakete in `/app/node_modules`.
