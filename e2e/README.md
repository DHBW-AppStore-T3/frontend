# E2E-Smoke-Tests (Issue 149)

Framework: **Playwright** (`@playwright/test`, Chromium über den installierten Chrome). Bewusst klein: die kritische Strecke und der Weg zum Identity Provider, kein Ersatz für die Unit-Tests. **Nicht Teil der CI** (`ci.yml`); Aufnahme dort braucht eine eigene Freigabe (Laufzeit, `npx playwright install chrome` im Runner).

## Zwei Modi

| Modus | Befehl | Was läuft | Voraussetzung |
|---|---|---|---|
| **Hermetisch** (Standard) | `npm run e2e` | `smoke.spec.ts`: Anmelden über die Dev-Brücke (`?sso_handoff=`), Liste, Detail, Tastaturbedienung. Startet den Vite-Dev-Server selbst. Jede API-Antwort kommt aus dem Test. | Chrome (oder `E2E_CHANNEL=chromium` nach `npx playwright install chromium`) |
| **Gegen eine Umgebung** | `E2E_BASE_URL=https://<host> npm run e2e` | `staging.spec.ts`: Anmeldeseite, Sprachwechsel, Reload, Übergabe an den Identity Provider mit fremder `returnUrl`. | erreichbare URL |

## Sicherheitsregeln
- **Keine Zugangsdaten** im Repository und in den Tests. Der Keycloak-Login selbst ist nicht automatisiert; der Test endet an der Weiterleitung (der Identity Provider wird mit einer leeren Seite beantwortet).
- Der hermetische Test beantwortet nur `GET`; jede andere Methode wird mit 405 abgelehnt. Er kann nichts anlegen, ändern oder löschen und verlässt die Maschine nicht.
- Der Modus mit `E2E_BASE_URL` meldet sich nirgends an und verändert nichts auf dem Server. Nicht gegen Produktion richten, solange niemand es freigegeben hat.

## Grenzen
Echter Login, Token-Refresh und alles hinter der Anmeldung sind **nicht** abgedeckt. Dafür bräuchte es ein Testkonto (Staging, Student-Rolle, nur lesende Strecke) als Secret: Entscheidung bei den Verantwortlichen, siehe `claude_docs/decisions/2026-testkonvention-e2e.md`.
