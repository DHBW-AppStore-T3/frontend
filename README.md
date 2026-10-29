# Frontend

React-SPA (TypeScript) für den App Store. Studierende und Dozierende verwalten hier Apps, deployen sie als Pods im Cluster und sehen ihre Deployments.

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
npm run lint            # ESLint inkl. jsx-a11y (eslint.config.js), --max-warnings=0
npm run lint:fix        # ESLint mit --fix
npx tsc -b --noEmit # Type-Check (kein eigenes npm-Skript)
npm run test            # Vitest, einmaliger Lauf
npm run test:coverage   # Vitest + Coverage (istanbul)
npm run build           # tsc + vite build
npm run gen:api-types   # API-Typen aus src/types/openapi.json erzeugen (siehe unten)
```

Tests liegen an zwei Stellen: neben dem Code in `src/**/__tests__/` und übergreifend in `tests/unit/` (Router, Contract, i18n, Styles, Infrastruktur). `tests/setup.ts` und `tests/helpers/` stellen den Netzwerk-Guard und Render-Helfer bereit: Ein ungemockter `fetch`/XHR lässt den Test fehlschlagen.

Die CI (`.github/workflows/ci.yml`) verlangt auf jedem Branch mindestens 85 % Zeilen **und** 85 % Branches (`MIN_COVERAGE` / `MIN_BRANCH_COVERAGE`).

Die Tests in `tests/unit/infra/docker-entrypoint.spec.ts` führen `docker-entrypoint.sh` mit `sh` und `envsubst` aus. Unter Windows kommen beide mit Git for Windows (im `PATH`), unter Linux/macOS sind sie üblicherweise vorhanden (`gettext`). Alle Tests laufen auf beiden Systemen; ohne diese Werkzeuge werden sie lokal sichtbar übersprungen, in der CI schlagen sie fehl.

### API-Typen aus dem Backend-Schema

`src/types/api.generated.ts` wird aus `src/types/openapi.json` erzeugt und **nicht von Hand bearbeitet**. Die Datei `openapi.json` ist eine committete Kopie des Backend-Schemas — FastAPI ist laut HARNESS.md die Single Source of Truth für den API-Contract.

Bei einer Backend-API-Änderung (nur lesend am Backend, ohne Datenbank, Broker und Netzwerk; `make openapi` gibt es nicht):

```bash
# 1. im backend-Repo, Stand origin/dev (einmalig: poetry install):
poetry run python scripts/export_openapi.py ../frontend/src/types/openapi.json
#    Ohne Argument schreibt das Skript backend/openapi.json (nicht committen).
#    Den Backend-Commit (git rev-parse origin/dev) im PR nennen.
# 2. im frontend-Repo: Typen erzeugen und prüfen
npm run gen:api-types
npx tsc -b
# 3. ein zweiter Lauf von `npm run gen:api-types` darf keinen weiteren Diff erzeugen
```

Neue oder geänderte Endpunkte, die das Frontend aufruft, gehören in `REQUIRED_OPERATIONS` in `tests/unit/contract/openapi.spec.ts`.

Schritt 2 ist der eigentliche Zweck: Eine Contract-Änderung im Backend wird hier zu einem Type-Error statt zu einem Laufzeitfehler. `src/types/index.ts` leitet die Domain-Typen (User, Course, App, Version-Approval, Deployment, Task, Pod) direkt aus dem generierten Schema ab.

## Theming

Branding (Logo, Name, Titel, Favicon, Farben und Login-Bild) kommt aus `src/theme/`.
Ohne `VITE_THEME` wird `t3` geladen. Ein unbekannter Wert fällt mit Warnung auf `t3` zurück.

```bash
VITE_THEME=t3 npm run dev
```

Im Container wird `VITE_THEME` über `env-config.js`/`envsubst` gesetzt.
Neue Themes: [docs/themes.md](docs/themes.md).

## Laufzeittypen

Der Wizard und die Deployment-Detailseite kennen zwei Laufzeittypen, die aus `GET /apps/{id}/runtime` kommen:

| Typ | Label | Besonderheit |
|---|---|---|
| `kubernetes` | Pods im Cluster | Scope `user`/`team`, App-eigene Settings aus `appstore.yaml` |
| `kubevirt-vm` | VM im Cluster | Ressourcen-Picker (vCPU/RAM), Netzwerkauswahl |

`isClusterRuntime(runtime)` in `src/utils/runtime.ts` fasst beide zusammen.

## Technologie-Stack

- **React 19** mit Function Components, Hooks und TypeScript
- **Zustand 5** für globalen State
- **React Router 7** mit Auth-Guards (Route-Loader)
- **Axios** mit Keycloak-Bearer-Interceptor
- **Tailwind CSS** für Styling
- **react-i18next** für Mehrsprachigkeit (DE/EN)
- **oidc-client-ts** für Keycloak-Login

## Code-Struktur

Der Code liegt in `src/`. Der typische Datenfluss von der Oberfläche bis zum Backend: eine **View** (eine Seite der App) liest ihre Daten aus einem **Store** — einem zentralen Datenspeicher, den sich mehrere Seiten teilen (umgesetzt mit der Bibliothek Zustand). Der Store holt bzw. schickt diese Daten über den **API-Layer** (`api/`) zum Backend. Dabei ergänzt `api/axios.ts` bei jedem Aufruf automatisch den Login-Token, sodass sich die einzelnen Aufrufe nicht selbst darum kümmern müssen.

```
src/
├── main.tsx          # Einstiegspunkt — ruft bootstrap.tsx auf
├── bootstrap.tsx     # App-Start: Theme, Auth (LTI/Dev-Brücke/Keycloak), Rendering
├── App.tsx           # Root-Komponente mit RouterProvider
├── env.ts            # Laufzeit-Konfiguration (window.__ENV__ aus env-config.js, sonst import.meta.env)
├── silent-refresh.ts # Skript der Silent-Refresh-Seite (eigener Build-Einstieg neben index.html)
├── views/            # Seiten der App (Ziele der Navigation); je Seite ein Unterordner mit Teilkomponenten und use*-Hooks
├── layouts/          # Seitenrahmen (App/Auth/User), je nach Route gewählt
├── components/       # Wiederverwendbare Bausteine; ui/ = generische Elemente (Button, Modal, Drawer, Toast, ...)
├── stores/           # Gemeinsamer Datenspeicher mehrerer Seiten + zugehörige Aktionen (*.store.ts)
├── api/              # Aufrufe ans Backend, ein File pro Ressource (*.api.ts) + axios.ts
├── composables/      # Wiederverwendbare Hooks (use*), z.B. Rollen, Toasts, Live-Updates
├── services/         # Logik ohne Oberfläche (keycloak.service fürs OIDC-Login, auth.service für /users/me, lti-launch für LTI 1.3)
├── router/           # Seiten-Adressen (paths.ts), Routen (index.tsx) und Zugriffsschutz (guards.ts)
├── config/           # Fachliche Kataloge (App-Darstellung, Fachbereichs-Zuordnung)
├── types/            # TypeScript-Typdefinitionen; api.generated.ts und openapi.json stammen aus dem Backend-Schema
├── utils/            # Kleine Helfer (Formatierung, Fehler-Aufbereitung, Deployment-Payload, sichere Links)
├── styles/           # Design-Tokens, Schriften und Farben für die App-Icons (CSS)
├── theme/            # Theming-System (Typen, Registry, CSS-Variablen)
└── i18n/             # Mehrsprachigkeit: Setup + Übersetzungstexte (DE/EN)
```

> Die `.d.ts`-Dateien neben den `.ts` werden beim Build automatisch erzeugt (sie beschreiben nur die Typen) — kein handgeschriebener Code.

**Zentrale Mechanismen:**

| Datei | Zweck |
|---|---|
| `api/axios.ts` | Zentrale Stelle für alle Backend-Aufrufe: hängt vor dem Absenden automatisch den Login-Token an (`Authorization: Bearer <token>`) und fängt abgelaufene Logins (Fehler 401) ab |
| `stores/auth.store.ts` | Merkt sich, wer eingeloggt ist, und dessen Rolle (student/teacher/admin) |
| `services/keycloak.service.ts` | Login und Logout gegen Keycloak (via Bibliothek `oidc-client-ts`) |
| `services/lti-launch.ts` | LTI 1.3-Start aus Moodle: löst den One-Time-Code ein und setzt den Session-Token |
| `composables/useDeploymentStream.ts` | Empfängt den Live-Fortschritt eines Deployments in Echtzeit vom Backend (Server-Sent Events) |
| `router/index.tsx`, `router/guards.ts` | Legt die Routen fest (`paths.ts` hält alle Adressen) und schützt Seiten per Loader: Login, Rolle, Wizard-Schritt (siehe [docs/routing-and-access.md](docs/routing-and-access.md)) |
| `composables/useRole.ts` | Einziger Ort für Rollen- und Berechtigungsabfragen in Komponenten |

**views/** — Kern ist der mehrstufige Deployment-Wizard: Basis-Konfiguration mit Name und Teilnehmenden (`NewDeploymentConfigView`) → Teams (`NewDeploymentGroupsAssignmentView`) → optional Variablen (`NewDeploymentVariableView`, entfällt automatisch, falls die App weder Variablen noch Ressourcenwahl noch Netzwerkschalter hat; entschieden von `needsVariablesStep`) → Zusammenfassung (`NewDeploymentSummaryView`, ein Satz und drei Karten). Dazu App-Katalog (`AppsView`/`AppsDetailView`/`AddAppsView`), Deployments (`DeploymentsView` mit `DeploymentsListView` und `DeploymentDetailView`), Kurse (`CoursesView`/`CourseDetailView`), Dashboard, Hilfe, Profil (`UserView`) sowie die Admin-Seiten `AdminAppsView` (Freigaben) und `AdminSettingsView` (Admin-Ansicht, empfohlene Apps).

**api/ ↔ stores/** — spiegeln sich bei den Kernressourcen: zu jeder gibt es ein `*.api.ts` (macht nur die reinen Aufrufe ans Backend) und meist einen `*.store.ts` (hält die Daten im Speicher und bietet Aktionen darauf an, die wiederum die Aufrufe nutzen). Vorhanden sind die APIs `app`, `course`, `dashboard`, `deployment`, `task`, `user` und die Stores `app`, `auth`, `course`, `deployment`, `admin-view` (Admin-Ansicht, in `localStorage`) und `toast`. Nicht jede Seite geht über einen Store: Mehrere Daten-Hooks in `views/` und `composables/useDashboard.ts` rufen die API direkt auf, etwa für Polling oder Suchfelder (siehe Befund B1 in [docs/architecture/architecture.md](docs/architecture/architecture.md)).

## Mehr

- Routing, Rollen und Guards: [docs/routing-and-access.md](docs/routing-and-access.md)
- Texte und Übersetzungen: [docs/i18n.md](docs/i18n.md)
- Theming: [docs/themes.md](docs/themes.md)
- Frontend-Architektur (C4, Abläufe, Befunde): [docs/architecture/architecture.md](docs/architecture/architecture.md)
- Design-Mockups zu UI-Issues: [docs/design/](docs/design/README.md)
- Übergabedokument: [claude_docs/HANDOVER.md](claude_docs/HANDOVER.md)
- Architektur und projektübergreifende Doku: [.github-Repo](https://github.com/DHBW-AppStore-T3/.github)
- API-Docs (Backend Swagger): http://localhost:8000/docs (nach `make dev-up`)
