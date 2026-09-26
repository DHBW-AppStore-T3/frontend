# Frontend

Vue 3 SPA für den App Store. Studierende und Dozierende verwalten hier Apps, deployen sie auf OpenStack und sehen ihre Deployments.

## Setup

Dieses Repository wird nicht eigenständig gestartet. Der gesamte Stack — inklusive Frontend — wird über das deployment-Repository hochgefahren. Vollständige Anleitung: [deployment/README.md](https://github.com/DHBW-AppStore-T3/deployment#readme).

Voraussetzung für alle folgenden Befehle: `make dev-up` aus dem `deployment/`-Verzeichnis wurde ausgeführt und der Stack läuft.

## Entwicklung

Alle `make`-Befehle werden aus dem `deployment/`-Verzeichnis des [deployment-Repos](https://github.com/DHBW-AppStore-T3/deployment) ausgeführt — dort liegt das Makefile.

```bash
# in app-store/deployment
make dev-restart-frontend   # Frontend-Container neu starten
make dev-logs-frontend      # Frontend-Logs verfolgen
make shell-frontend         # interaktive Shell im Container
```

Lint, Type-Check und Tests laufen im Frontend-Container — `make shell-frontend` öffnet eine Shell. Die tatsächlich vorhandenen Skripte:

```bash
npm run lint            # ESLint (eslint.config.js)
npm run lint:fix        # ESLint mit --fix
npx vue-tsc -b --noEmit # Type-Check (kein eigenes npm-Skript)
npm run test            # Vitest, einmaliger Lauf
npm run test:coverage   # Vitest + Coverage (istanbul)
npm run build           # vue-tsc + vite build
```

### API-Typen aus dem Backend-Schema

`src/types/api.generated.ts` wird aus `src/types/openapi.json` erzeugt und **nicht von Hand bearbeitet**. Die Datei `openapi.json` ist eine committete Kopie des Backend-Schemas — FastAPI ist laut HARNESS.md die Single Source of Truth für den API-Contract.

Bei einer Backend-API-Änderung:

```bash
# 1. im backend-Repo: Schema exportieren
poetry run python scripts/export_openapi.py        # oder: make openapi aus deployment/
# 2. Ergebnis nach frontend/src/types/openapi.json kopieren
# 3. im frontend-Repo:
npm run gen:api-types
npx vue-tsc -b --noEmit
```

Schritt 3 ist der eigentliche Zweck: Eine Contract-Änderung im Backend wird hier zu einem Type-Error statt zu einem Laufzeitfehler. `src/types/index.ts` leitet die User-Typen bereits aus dem generierten Schema ab; die übrigen Blöcke sind noch handgepflegt und sollten bei Gelegenheit nachgezogen werden.

## Theming

Branding (Logo, Name, Titel, Favicon, Markenfarben) kommt aus `src/theme/`. Das Theme wählt `VITE_THEME`
(`default` oder `t3-demo`; unbekannt → `default` mit Warnung):

```bash
VITE_THEME=t3-demo npm run dev
```

Im Container greift `VITE_THEME` über `env-config.js`/`envsubst`, ein Image genügt für alle Themes.
`t3-demo` ist nur ein Demo-Theme, kein offizielles DHBW-Design. Neues Theme anlegen: siehe
`claude_docs/decisions/2026-white-label-theming.md`.

## Technologie-Stack

- **Vue 3** mit Composition API und TypeScript
- **Pinia** für globalen State
- **Vue Router** mit Auth-Guards
- **Axios** mit Keycloak-Bearer-Interceptor
- **Tailwind CSS** für Styling
- **vue-i18n** für Mehrsprachigkeit (DE/EN)
- **oidc-client-ts** für Keycloak-Login

## Code-Struktur

Der Code liegt in `src/`. Der typische Datenfluss von der Oberfläche bis zum Backend: eine **View** (eine Seite der App) liest ihre Daten aus einem **Store** — einem zentralen Datenspeicher, den sich mehrere Seiten teilen (umgesetzt mit der Bibliothek Pinia). Der Store holt bzw. schickt diese Daten über den **API-Layer** (`api/`) zum Backend. Dabei ergänzt `api/axios.ts` bei jedem Aufruf automatisch den Login-Token, sodass sich die einzelnen Aufrufe nicht selbst darum kümmern müssen.

```
src/
├── main.ts        # Startpunkt der App (registriert Store, Router, Übersetzungen)
├── views/         # Seiten der App (Ziele der Navigation), z.B. Deployment-Wizard, App-Katalog
├── layouts/       # Seitenrahmen (App/Auth/User), je nach Route gewählt
├── components/    # Wiederverwendbare Bausteine; ui/ = generische Elemente (Button, Dialog, ...)
├── stores/        # Gemeinsamer Datenspeicher mehrerer Seiten + zugehörige Aktionen (*.store.ts)
├── api/           # Aufrufe ans Backend, ein File pro Ressource (*.api.ts) + axios.ts
├── composables/   # Wiederverwendbare Logik (use*), z.B. Login, Live-Updates
├── services/      # Logik ohne Oberfläche (aktuell: auth.service fürs Keycloak-Login)
├── router/        # Definition der Seiten-Adressen + Zugriffsschutz (Login nötig ja/nein)
├── types/         # TypeScript-Typdefinitionen (OpenStack-Credentials, Quota, ...)
├── utils/         # Kleine Helfer (clouds-yaml-Parsing, Formatierung, Fehler-Aufbereitung)
└── i18n/          # Mehrsprachigkeit: Setup + Übersetzungstexte (DE/EN)
```

> Die `.d.ts`-Dateien neben den `.ts` werden beim Build automatisch erzeugt (sie beschreiben nur die Typen) — kein handgeschriebener Code.

**Zentrale Mechanismen:**

| Datei | Zweck |
|---|---|
| `api/axios.ts` | Zentrale Stelle für alle Backend-Aufrufe: hängt vor dem Absenden automatisch den Login-Token an (`Authorization: Bearer <token>`) und fängt abgelaufene Logins (Fehler 401) ab |
| `stores/auth.store.ts` | Merkt sich, wer eingeloggt ist, und dessen Rolle (student/teacher/admin) |
| `composables/useKeycloak.ts` | Login und Logout gegen Keycloak (via Bibliothek `oidc-client-ts`) |
| `composables/useDeploymentStream.ts` | Empfängt den Live-Fortschritt eines Deployments in Echtzeit vom Backend (Server-Sent Events) |
| `router/index.ts` | Legt die Seiten-Adressen fest und schützt geschützte Seiten vor nicht eingeloggten Nutzern |

**views/** — Kern ist der mehrstufige Deployment-Wizard (`NewDeploymentConfigView` → `…VariableView` → `…GroupsAssignmentView` → `…SummaryView`), dazu App-Katalog (`AppsView`/`AppsDetailView`), Deployments (`DeploymentsView`/`DeploymentDetailView`), Kurse, Dashboard und Settings.

**api/ ↔ stores/** — spiegeln sich paarweise: zu jeder Ressource gibt es ein `*.api.ts` (macht nur die reinen Aufrufe ans Backend) und meist einen `*.store.ts` (hält die Daten im Speicher und bietet Aktionen darauf an, die wiederum die Aufrufe nutzen). Beispiele: `deployment`, `app`, `course`, `team`, `user`, `credentials`.

## Mehr

- Architektur und projektübergreifende Doku: [.github-Repo](https://github.com/DHBW-AppStore-T3/.github)
- API-Docs (Backend Swagger): http://localhost:8000/docs (nach `make dev-up`)
