# Dev-Abhängigkeiten und Security-Audit (frontend#82, Teil von Epic #77)

**Status:** umgesetzt (Stand 2026-10-26, `origin/dev` @ `18e3fef`). Kennzeichnung der Aussagen: **[belegt]** = am Repo, an der
installierten Version, an der npm-Registry oder am Advisory-Text geprüft; **[Annahme]** = nicht geprüft, begründete
Einschätzung, die bei der Wiedervorlage zu bestätigen ist.

## Ausgangslage
- `npm audit`: 10 Funde (5 moderate, 3 high, 2 critical); das Issue nannte 12, der Stand hat sich seitdem verändert. [belegt]
- `npm audit --omit=dev`: **0 Funde**, vorher und nachher. [belegt] Die CI blockiert darauf (`npm audit --audit-level=high --omit=dev`
  im Job `🔒 Security`), das bleibt unverändert.
- Das Produktions-Image enthält nur `dist/` aus der Build-Stage (`COPY --from=build /app/dist`, nginx-Stage). Dev-Tooling gelangt nicht
  hinein. [belegt: `Dockerfile`]
- Alle verbleibenden Funde betreffen Test- und Build-Werkzeuge, die auf Entwickler-Rechnern und CI-Runnern laufen. Der Angriffsweg
  führt jeweils über deren Eingaben, nicht über Nutzer der App.

## Was geändert wurde
| Änderung | Wirkung |
|---|---|
| `vite` 7.3.6 → **7.3.7** (`^7.3.7`, gleiche Major-Linie) | behebt die 5 Funde zu Vite und `launch-editor` (Dev-Server, besonders unter Windows) |
| `undici` 7.30.0 → **7.30.1** (nur `package-lock.json`, innerhalb `jsdom`s `^7.25.0`) | behebt 3 Funde (DoS im EventSource-Parser, SRI-Bypass, unbehandelter Fehler bei Content-Encodings) |
| `@vitest/coverage-v8` **entfernt** | wird nicht benutzt (die Konfiguration nutzt `istanbul`); entfernt 6 Pakete aus dem Baum |

Ergebnis: **10 → 7 Funde**, `undici`, `vite` und `@vitest/coverage-v8` sind aus dem Audit verschwunden. [belegt: Audit vorher/nachher]
Testanzahl und Coverage sind gegenüber dem Ausgangsstand unverändert (siehe PR).

## Abweichung vom Issue: `jsdom` bleibt
Das Issue nahm an, `jsdom` werde nirgends referenziert. Das stimmt nicht: Fünf Test-Dateien setzen `// @vitest-environment jsdom`
(`markdown-html.test.ts`, `MarkdownEditor.spec.tsx`, `MarkdownRenderer.spec.tsx`, `AddAppsView.spec.tsx`, `AppsDetailView.spec.tsx`).
Der Grund steht in den Dateien: DOMPurify braucht ein spec-konformes DOM, "happy-dom drops tags and keeps handlers". [belegt]
Das sind die Tests des XSS-Schutzes für das Markdown-Rendering. Ein Wechsel der Testumgebung würde genau diese Sicherheitstests
verändern, das gehört nicht in eine Aufräum-Änderung. Deshalb: **`jsdom` bleibt**, `undici` (dessen Abhängigkeit) wird stattdessen
im Lockfile angehoben. Ein Wegfall von `jsdom` wäre ein eigenes Thema (DOMPurify-Tests auf happy-dom neu bewerten).

## Verbleibende Funde (7 Einträge im Audit, 6 Advisories)
Alle sind Dev-Tooling. Es gibt keine Behebung innerhalb der Major-Linie, außer wo vermerkt. Entscheidung für alle: **bewusst
akzeptiert bis #83**, kein `npm audit fix --force`.

| Paket (installiert) | Advisory | Schwere | Fix-Version | Einsatz hier | Angriffsweg und Voraussetzung |
|---|---|---|---|---|---|
| `tinypool` 1.1.1 (über `vitest`) | GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr | critical (kein CVSS-Vektor angegeben) | 2.1.1 / 2.1.2 | Worker-Pool von Vitest bei jedem Testlauf [belegt] | Prototype Pollution an `Object.prototype` im Testprozess ergibt Code-Ausführung in den Workern; es braucht also eine Pollution-Quelle, die zur Testzeit fremde Daten verarbeitet. [belegt: Advisory-Text] |
| `@vitest/mocker` 3.2.7 (über `vitest`) | GHSA-82fw-gwwq-j7x9 (5.9), GHSA-qxg6-89mg-rqv8 (4.7) | moderate | 4.1.11 / 4.1.12 | Mock-Unterstützung von Vitest | Erreichbarer WebSocket eines Dev-Servers mit `mockerPlugin`/`interceptorPlugin` (Drittanbieter-Server) oder Vitest-Browser-Modus. [belegt: Advisory-Text] Für 3.x wird **kein Fix** veröffentlicht. [belegt: Advisory-Text] |
| `happy-dom` 20.14.5 | GHSA-834v-8h66-3h79 | high (8.8) | 21.0.4 (Major) | Standard-Testumgebung, dazu `new Window()` in `markdown-html.test.ts` [belegt] | Nur mit `enableJavaScriptEvaluation: true` **und** von außen kontrolliertem HTML oder Modulquelltext. [belegt: Advisory-Text] |
| `vitest` 3.2.7 | abgeleitet (über `tinypool`, `@vitest/mocker`) | critical | siehe oben | Test-Runner | kein eigener Advisory |
| `@vitest/coverage-istanbul` 3.2.7 | abgeleitet (Spanne von `vitest`) | moderate | folgt `vitest` | Coverage-Provider der CI | kein eigener Advisory |
| `postcss-selector-parser` 6.0.10 / 6.1.4 (über `@tailwindcss/typography` und `tailwindcss` 3.4.19 mit `postcss-nested`) | GHSA-rj75-hqrm-r3gf (5.9) | moderate | 6.1.5 | PostCSS-Verarbeitung im Build [belegt: `npm ls`] | Quadratische Laufzeit bei sehr langen flachen Selektoren; betrifft laut Advisory nur das Parsen **nicht vertrauenswürdiger** Selektoren im Request-Pfad, "ordinary build-time use on trusted sources is not affected". [belegt: Advisory-Text] |
| `@tailwindcss/typography` 0.5.20 | abgeleitet (über `postcss-selector-parser`) | moderate | nur "0.5.4" (ein Rückschritt, sinnlos) | Typografie-Plugin | kein eigener Advisory |

### Bewertung je Befund
- **`tinypool`:** Der Advisory beschreibt den Code von tinypool 2.x. Ob 1.1.1 denselben Code enthält, wurde nicht geprüft; `npm audit` zählt
  1.x zur betroffenen Spanne. **[Annahme]** Im Testprozess gibt es keine Prototype-Pollution-Quelle, die fremde Daten verarbeitet: Die Tests laden
  nur eigenen Code und eigene Fixtures. Das wurde **nicht** durch eine Analyse der Test-Abhängigkeiten auf Pollution-Gadgets belegt; belegt ist nur,
  dass `npm audit --omit=dev` 0 meldet. Behebung: mit Vitest 4.1.12 entfällt `tinypool` ganz (`npm view vitest@4.1.12` zeigt keine
  `tinypool`-Abhängigkeit). [belegt: Registry]
- **`@vitest/mocker`:** Weder `vitest.config.ts` noch ein Test nutzt Browser-Modus, `mockerPlugin` oder `interceptorPlugin`. [belegt: Suche im Repo]
  **[Annahme]** `npm run test:watch` öffnet keinen von außen erreichbaren WebSocket; das wurde nicht gemessen. Wer
  den Watch-Modus auf `0.0.0.0` bindet oder ein Netz freigibt, setzt sich dem Risiko aus; Standard ist localhost. [belegt: Advisory-Text]
- **`happy-dom`:** Die installierte Version setzt `enableJavaScriptEvaluation: false` als Standard. [belegt: `DefaultBrowserSettings.js`, Zeile 6]
  Weder `environmentOptions` noch ein Test schaltet es ein [belegt: Suche im Repo]; Vitest übernimmt nur `happyDOM.settings` aus der Konfiguration [belegt:
  `vitest/dist/chunks/index.*.js`]. Die Eingaben der Tests sind eigene Fixtures (auch die Angriffs-Strings in `markdown-html.test.ts`, die an den
  Sanitizer gehen). Die Voraussetzung des Advisories ist damit nicht erfüllt. Hinweis auf eine Unstimmigkeit der Quellen: Der Text des Advisories sagt
  "no patched version", die GitHub-Advisory-Daten und `npm audit` nennen 21.0.4. Maßgeblich ist hier die Aussage von `npm audit`.
  In 20.x gibt es keinen Fix (20.14.6 ist die letzte 20.x und liegt noch in der betroffenen Spanne). [belegt: Registry]
- **`postcss-selector-parser`:** Es wird beim Build auf eigenes CSS und auf die Klassen aus dem Quelltext angewendet. **[Annahme]** Zur Buildzeit fließen keine Nutzereingaben
  in CSS-Selektoren; das wurde nicht aktiv geprüft. `tailwindcss` (`^6.1.2`) und `postcss-nested` (`^6.1.1`) erlauben 6.1.5; ein reiner Lockfile-Bump würde dort die Kopie 6.1.4 beheben. `@tailwindcss/typography`
  pinnt aber exakt 6.0.10 [belegt: `npm view`], der Fund bliebe im Audit bestehen, deshalb wurde nichts angehoben. Ein `overrides`-Eintrag würde das Verhalten
  von Typography ändern und wurde bewusst nicht gemacht. Keine Migration auf Tailwind 4 aus Security-Gründen.

## Wiedervorlage
- **#83 (Vitest 4, happy-dom 21):** Zielversionen laut Advisories und Registry (alle [belegt] per `npm view`):
  `vitest` und `@vitest/coverage-istanbul` **≥ 4.1.12** (4.1.11 behebt nur den Path-Traversal, 4.1.12 auch die Code-Injection; ein Sprung auf 5.x ist
  nicht nötig), `happy-dom` **≥ 21.0.4** (Node ≥ 20). Vitest 4.1.12 erlaubt `vite ^6 || ^7 || ^8`, passt also zu Vite 7. Danach muss `npm audit` die Einträge
  `vitest`, `tinypool`, `@vitest/mocker`, `@vitest/coverage-istanbul` und `happy-dom` nicht mehr melden; bleiben sie, ist dieser Eintrag zu aktualisieren.
- **Tailwind:** erneut bewerten, wenn `tailwindcss` oder `@tailwindcss/typography` einen `postcss-selector-parser` ≥ 6.1.5 mitbringen.
- **`jsdom`:** bleibt, solange die DOMPurify-Tests es brauchen. Beim Upgrade von `jsdom` die Abhängigkeit `undici` mitprüfen (jsdom 30 nutzt `undici ^8`).
- **Regel:** Ein `npm install`/`npm update` unter Windows entfernt die `libc`-Felder der nativen Linux-Pakete aus `package-lock.json`. Diese Felder sind
  in diesem PR wiederhergestellt worden; bei künftigen Lockfile-Änderungen unter Windows prüfen, dass der Diff nur die beabsichtigten Pakete zeigt.
