# frontend

Frontend des DHBW-AppStore (React 19, Zustand, React Router 7, react-i18next, Tailwind CSS, Vite, TypeScript).
Harness-Gesamtkonzept: siehe https://github.com/DHBW-AppStore-T3/.github/blob/main/docs/HARNESS.md

## Die 2 Flows
1. **Flow 1 (`/user-story`):** UI/UX-Spezifikation und OpenAPI-Contracts werden vorab im Issue definiert.
2. **Flow 2 (`/harness-workflow`):** TDD (`npm run test`), OpenAPI-Typen generieren (`npm run gen:api-types`), PR auf `dev`, CI grün, Auto-Merge auf `dev`, automatisches Staging-Deploy, Hermes Discord Reporting.
   - Push auf `main` bleibt rein menschlich + Test Coverage Gate (mind. 85 % Zeilen und 85 % Branches, `MIN_COVERAGE` / `MIN_BRANCH_COVERAGE` in `ci.yml`, gilt für jeden Branch).

## Lokale Befehle
- Dev-Server: `npm run dev`
- Build & Typecheck: `npm run build` (`tsc -b && vite build`)
- Tests & Coverage: `npm run test` / `npm run test:coverage` (CI-Gate: mind. 85 % Zeilen und 85 % Branches, Linux-CI misst ca. 94 % Zeilen / 88 % Branches)
  - `docker-entrypoint.spec.ts` braucht `sh` und `envsubst` (Windows: Git for Windows im `PATH`); läuft auf Windows und Linux, kein Plattform-Skip. Fehlen die Werkzeuge, wird die Datei lokal sichtbar übersprungen, in der CI schlägt sie fehl
  - Netzwerk-Guard: ein ungemockter `fetch`/XHR lässt den Test fehlschlagen (`NETWORK_GUARD=warn` listet alle Verursacher)
- Lint: `npm run lint` (ESLint inkl. jsx-a11y, `--max-warnings=0`: jede Warnung bricht die CI)
- OpenAPI Typen synchronisieren: Schema aus dem Backend exportieren (`poetry run python scripts/export_openapi.py ../frontend/src/types/openapi.json`), dann `npm run gen:api-types` und `npx tsc -b`; Details im README
- Lebendes Übergabedokument: `claude_docs/HANDOVER.md`
- Fachdoku: `docs/routing-and-access.md` (Rollen, Guards), `docs/i18n.md` (Sie-Form, `BoldSlot`, `translateHtml`), `docs/themes.md`, `docs/architecture/architecture.md` (C4, Abläufe, Befunde)
- Änderst du das Coverage-Gate in `ci.yml`, passe `CLAUDE.md` und `claude_docs/HANDOVER.md` mit an

