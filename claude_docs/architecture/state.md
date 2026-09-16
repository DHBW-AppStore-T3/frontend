# Pinia-Stores

Ein Store pro Backend-Ressource, gespiegelt zu `api/*.api.ts`. Options-API-Stil
(`defineStore('name', { state, actions, ... })`), nicht die
Composition-API-Store-Variante.

## `deployment.store.ts` — größter und komplexester Store

Hält `DeploymentDraft`-Zustand (App-Auswahl, Release-Tag, Kurs-/
Studenten-Zuordnung) während der Erstellung eines neuen Deployments,
plus den Live-Status laufender Deployments. Importiert `app.store.ts`
und `auth.store.ts` direkt — Store-zu-Store-Abhängigkeit, kein
zentraler Event-Bus. Wer hier etwas ändert, sollte auf Zirkularität
achten, falls `app.store.ts` jemals zurück auf `deployment.store.ts`
verweisen soll.

## Live-Updates während eines Deploys

Kommen per Server-Sent-Events vom Backend (siehe `backend/claude_docs/
architecture/overview.md` für die Gegenseite: Worker → Redis Pub/Sub →
Backend → SSE). Der Store abonniert die SSE-Verbindung und aktualisiert
`DeploymentStatus` reaktiv — kein Polling.

## `auth.store.ts`

Hält den Session-Zustand, der von `composables/useKeycloak.ts`
(wrapped `oidc-client-ts`) verwaltet wird. Wird von praktisch jedem
anderen Store und jedem `*.api.ts`-Modul referenziert, um den
Access-Token an ausgehende Requests zu hängen. Details zum
Token-Handling selbst (In-Memory statt localStorage, warum):
`api-client.md`.
