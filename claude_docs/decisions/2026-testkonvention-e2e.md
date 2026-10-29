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

## 3. E2E: Entscheidung und Umsetzung
**Umgesetzt** (PR zu Issue 149): Playwright, Chrome des Rechners, Einrichtung und Befehle in `e2e/README.md`.
- `smoke.spec.ts` (hermetisch): Anmelden über die Dev-Brücke, Liste, Detail, Tastatur. Nur `GET`, alle Antworten aus dem Test, keine Zugangsdaten.
- `staging.spec.ts` (`E2E_BASE_URL`): Anmeldeseite, Sprachwechsel, Übergabe an den Identity Provider; ohne Login, ohne Änderung auf dem Server.
- Läuft nicht in der CI. Der Betrieb dort (`playwright install chrome`, Laufzeit) und ein **Testkonto für die Strecke hinter dem Login** (Staging, Student-Rolle, nur lesend, als Secret) sind Entscheidungen der Verantwortlichen; bis dahin bleibt der echte Login bewusst außerhalb der Automatisierung.
