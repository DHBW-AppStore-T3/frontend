## Zusammenfassung

<!-- Was ändert dieser PR und warum? 1–3 Sätze. -->

Closes #

**Art der Änderung:** <!-- feat | fix | refactor | ui | i18n | test | docs | ci | chore — bei Breaking Change zusätzlich "BREAKING" -->

## Prüfung

<!-- Wie wurde das Verhalten geprüft? Welche Rollen, welche Umgebung (lokal mit `deployment` → `make dev-up`, Staging), welche Abläufe durchgeklickt? -->

## Screenshots

<!-- Bei UI-Änderungen: vorher/nachher, Desktop und schmaler Viewport. Sonst entfernen. -->

## Checkliste

<!--
Checkliste für Änderungs-PRs (Feature-/Fix-Branch → `dev`, Hotfix → `main`).
Release-PRs (`dev` oder `promote/*` → `main`) verwenden stattdessen
`.github/pull_request_template/release.md`.

Jeder Punkt wird abgehakt, bevor der PR gemergt werden kann. Der CI-Check
"PR Checklist" blockiert den Merge, solange hier noch ein offenes "- [ ]" steht.

Trifft ein Punkt nicht zu: mit "n/a" markieren UND abhaken, z. B.
- [x] n/a — i18n: keine Textänderungen

Die reviewende Person prüft, dass die Häkchen stimmen, und bestätigt das mit
ihrem Approval (auf `dev` ist keines erzwungen: dann prüft die Autorin oder der
Autor die Häkchen selbst und die Fragen kommen im Release-PR zurück). Type Check,
Lint (`--max-warnings=0`, inkl. jsx-a11y), Tests inkl. Coverage-Gate (≥ 80 %
Zeilen und Branches auf jedem Branch), Security, Build und Image Scan laufen als
CI-Checks und werden hier nicht wiederholt.
-->

**Funktionale Eignung**

- [ ] Vollständigkeit: Alle Akzeptanzkriterien des verlinkten Issues sind umgesetzt; Abweichungen oder offene Punkte sind oben begründet
- [ ] Korrektheit: Vitest-Tests decken die Akzeptanzkriterien ab, inkl. Rand- und Fehlerfällen (leere Daten, API-Fehler, fehlende Berechtigung)
- [ ] Angemessenheit: Ablauf manuell im Browser gegen ein echtes Backend durchgespielt (lokal oder Staging), nicht nur mit Mocks
- [ ] Rollen: Verhalten für alle betroffenen Rollen (`student`, `teacher`, `admin`) geprüft; nicht erlaubte Aktionen sind ausgeblendet oder gesperrt (`useRole`, `RoleGate`, Route-Guards)
- [ ] Zustände: Lade-, Leer- und Fehlerzustände sind in der UI sichtbar behandelt, kein stilles Scheitern
- [ ] Regression: Angrenzende Abläufe, die geänderten Code mitnutzen, funktionieren weiterhin (z. B. Deployment anlegen → Status → Logs)

**Schnittstellen & Konventionen**

- [ ] API-Contract: Bei Backend-Schnittstellenänderungen `src/types/openapi.json` aus dem Backend exportiert, `npm run gen:api-types` ausgeführt und zugehöriger Backend-PR verlinkt
- [ ] i18n: Neue/geänderte Texte in `src/i18n/locales/de.ts` **und** `en.ts` (deutsche Texte in Sie-Form), keine hartcodierten UI-Strings
- [ ] UI: Farben nur über Theme-Tokens (keine fest eingetragenen Farbwerte, `tests/unit/styles/colors.spec.ts`); Layout auf Desktop und schmalem Viewport geprüft; interaktive Elemente per Tastatur bedienbar und beschriftet
- [ ] Code: Funktionskomponenten mit typisierten Props, kein neues `any` und kein neues `eslint-disable` für `react-hooks/exhaustive-deps` ohne Begründung im Code

**Sicherheit & Doku**

- [ ] Sicherheit: Keine Secrets im Diff; kein `dangerouslySetInnerHTML` mit Nutzereingaben, HTML aus Übersetzungen nur über `translateHtml`, Markdown nur über `MarkdownRenderer`; neue externe Quellen in der CSP (`docker-entrypoint.sh`) bewusst geprüft; neue `.trivyignore`-Einträge begründet
- [ ] Doku: `claude_docs/HANDOVER.md` bzw. README/`docs/` aktualisiert, falls sich Verhalten, Setup oder Entscheidungen geändert haben
