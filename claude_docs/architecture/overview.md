# Frontend — Überblick

Vue 3 SPA (Composition API, `<script setup>`), TypeScript, Vite,
Tailwind CSS. Läuft in Prod als `frontend-prod`, gebaut über
`vue-tsc -b && vite build`, ausgeliefert von nginx im eigenen Image.

## Struktur (`src/`)

- **`api/`** — ein `*.api.ts` pro Ressource (`app.api.ts`,
  `deployment.api.ts`, `course.api.ts`, `credentials.api.ts`,
  `openstack-resources.api.ts`, `quotas.api.ts`, `task.api.ts`,
  `user.api.ts`), plus `axios.ts`/`_request.ts` für den gemeinsamen
  HTTP-Client-Aufbau.
- **`stores/`** — Pinia-Stores, gespiegelt zu den API-Modulen:
  `app.store.ts`, `deployment.store.ts` (größter Store — Live-Status
  während eines Deploys), `auth.store.ts`, `course.store.ts`,
  `openstack-credentials.store.ts`, `toast.store.ts`.
- **`views/`**, **`components/`**, **`layouts/`** — Standard-Vue-Aufbau.
- **`composables/`** — geteilte reaktive Logik außerhalb von Stores.
- **`i18n/`** — `vue-i18n`, mehrsprachige UI.
- **`router/`** — `vue-router`.

## Auth

`oidc-client-ts` (nicht `keycloak-js`) für den OIDC-Flow gegen
Keycloak — `auth.store.ts` hält den Token-Zustand,
`auth.api.ts`/`_request.ts` hängen ihn an ausgehende Requests.

## Sicherheitsrelevante Dependencies

`dompurify` (sanitized HTML, z. B. für gerenderte Markdown-Inhalte aus
`marked`), `js-yaml` (Parsing von YAML-Konfiguration, vermutlich
App-Manifeste). Beide waren Ziel bekannter CVEs beim ersten
tatsächlichen CI-Security-Lauf (siehe `claude_docs/log/2026-W38.md`) —
bei Änderungen an diesen Libraries den `npm audit`-Stand im
`🔒 Security`-CI-Job prüfen.

Details: `state.md` (Pinia im Detail), `api-client.md` (Fehlerbehandlung),
`routing.md`.
