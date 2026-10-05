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
Jeder Punkt wird abgehakt, bevor der PR gemergt werden kann. Der CI-Check
"PR Checklist" blockiert den Merge, solange hier noch ein offenes "- [ ]" steht.

Trifft ein Punkt nicht zu: mit "n/a" markieren UND abhaken, z. B.
- [x] n/a — i18n: keine Textänderungen

Die reviewende Person prüft, dass die Häkchen stimmen, und bestätigt das mit
ihrem Approval. Lint, Type Check, Tests inkl. Coverage-Gate, Security und
Build werden separat als Pflicht-CI-Checks erzwungen und hier nicht wiederholt.
-->

**Funktionale Eignung**

- [ ] Vollständigkeit: Alle Akzeptanzkriterien des verlinkten Issues sind umgesetzt; Abweichungen oder offene Punkte sind oben begründet
- [ ] Korrektheit: Vitest-Tests decken die Akzeptanzkriterien ab, inkl. Rand- und Fehlerfällen (leere Daten, API-Fehler, fehlende Berechtigung)
- [ ] Angemessenheit: Ablauf manuell im Browser gegen ein echtes Backend durchgespielt (lokal oder Staging), nicht nur mit Mocks
- [ ] Rollen: Verhalten für alle betroffenen Rollen (`student`, `teacher`, `admin`) geprüft; nicht erlaubte Aktionen sind ausgeblendet oder gesperrt (`useRole`, `RoleGate`)
- [ ] Zustände: Lade-, Leer- und Fehlerzustände sind in der UI sichtbar behandelt, kein stilles Scheitern
- [ ] Regression: Angrenzende Abläufe, die geänderten Code mitnutzen, funktionieren weiterhin (z. B. Deployment anlegen → Status → Logs)

**Schnittstellen & Konventionen**

- [ ] API-Contract: Bei Backend-Schnittstellenänderungen `src/types/openapi.json` aktualisiert, `npm run gen:api-types` ausgeführt und zugehöriger Backend-PR verlinkt
- [ ] i18n: Neue/geänderte Texte in `src/i18n/locales/de.ts` **und** `en.ts`, keine hartcodierten UI-Strings
- [ ] UI: Farben nur über Theme-Tokens (keine hartcodierten Farbwerte); Layout auf Desktop und schmalem Viewport geprüft
- [ ] Code: Neue Komponenten mit `<script setup lang="ts">`, Props/Emits typisiert, kein neues `any` ohne Begründung

**Sicherheit & Doku**

- [ ] Sicherheit: Keine Secrets im Diff; kein `v-html` mit Nutzereingaben (auch nicht über `$t`-Parameter), Markdown nur über `MarkdownRenderer`; neue `.trivyignore`-Einträge begründet
- [ ] Doku: `claude_docs/HANDOVER.md` bzw. README/`docs/` aktualisiert, falls sich Verhalten, Setup oder Entscheidungen geändert haben
