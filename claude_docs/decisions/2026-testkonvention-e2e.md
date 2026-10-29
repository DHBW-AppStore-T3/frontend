# Testort, Fixtures und E2E (Issue 149, Epic 139)

Stand `origin/dev` 4959b12: 87 Dateien unter `src/**/__tests__`, 67 unter `tests/unit`, 295 `as any` in Tests, kein E2E-Framework. Coverage-Basis 93,55 % Zeilen / 87,46 % Branches wird nur dokumentiert; das 85-%-Gate in `ci.yml` bleibt unverändert.

## 1. Konvention für den Testort (keine Massenverschiebung)
- **Neben dem Modul** (`src/<bereich>/__tests__/<modul>.test.ts[x]`): Tests, die **ein** Modul (Hook, Guard, Hilfsfunktion, Komponente) isoliert prüfen.
- **`tests/unit/<bereich>/<name>.spec.tsx`**: Tests, die **mehrere Schichten** zusammen prüfen (View mit Router, Stores, i18n), Infrastruktur (`infra/`, `styles/`, `contract/`) und alles, was Quelltext oder Konfiguration liest.
- Endungen: `.test.*` in `src`, `.spec.*` in `tests/`. Bestehende Dateien bleiben, wo sie sind; verschoben wird nur, wenn ein Test ohnehin angefasst wird und klar am falschen Ort liegt.
- Hilfen in `tests/helpers/` (`render`, `liveStore`, `network-guard`, **`factories`**).
- Issue-Nummern in Dateien unter `src` (auch Tests) als "issue 123" schreiben: `tests/unit/styles/colors.spec.ts` hält `#123` für eine Hex-Farbe.

## 2. Typisierte Fixture-Factories
`tests/helpers/factories.ts` bietet `makeUser` und `makeTask` mit vollständigen Pflichtfeldern. Neue Specs nutzen sie; bestehende werden **nicht** pauschal umgeschrieben (`as any` bleibt in Tests erlaubt, siehe `eslint.config.js`), sondern beim nächsten Anfassen. Weitere Factories (Deployment, App) entstehen, wenn zwei Specs dasselbe Fixture brauchen.

## 3. E2E: Entscheidung (kein Code, keine CI-Änderung)
Ziel wäre ein einzelner Smoke-Test der kritischen Strecke **Login → Liste → Detail**. Offene Entscheidungen, die bei Menschen liegen:

| Frage | Optionen | Empfehlung |
|---|---|---|
| Framework | Playwright, Cypress | Playwright (Chromium reicht, TypeScript, Trace-Viewer) |
| Testkonto | echtes Keycloak-Konto auf Staging, Dev-Bypass (`sso_handoff`, nur im Dev-Build) | Staging-Konto mit Student-Rolle; der Dev-Bypass testet den Login-Pfad nicht |
| Wo läuft er | manuell vor Präsentationen, nach jedem Staging-Deploy in CI | zuerst manuell/auf Abruf; CI erst nach Freigabe (Laufzeit, Flake-Rate, Zugangsdaten als Secret) |
| Daten | Seed-Apps im Dev-Stack sind nicht deploybar (HANDOVER Abschnitt 3) | nur lesende Strecke, **kein** Deploy |

Bis zur Freigabe wird weder ein Framework noch ein Workflow hinzugefügt (Infrastruktur- und Secret-Entscheidung).
