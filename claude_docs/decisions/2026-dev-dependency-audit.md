# Dev-Abhängigkeiten und Security-Audit (frontend#82, Teil von Epic #77)

**Status:** umgesetzt mit #82 (`origin/dev` @ `18e3fef`), fortgeschrieben mit #83 (Vitest 4, happy-dom 21; siehe Abschnitt "Stand nach #83"). Kennzeichnung der Aussagen: **[belegt]** = am Repo, an der
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

## Stand nach #83 (Vitest 4, happy-dom 21)
**Ergebnis:** `npm audit` **7 → 2 Funde** (beide moderate, Tailwind/PostCSS), `npm audit --omit=dev` weiter **0**. [belegt: Audit vor und nach dem Upgrade]
Verschwunden sind `vitest`, `tinypool`, `@vitest/mocker`, `@vitest/coverage-istanbul` und `happy-dom`; die in #83 verlangten Pakete tauchen nicht mehr auf.

| Paket | vorher | nachher |
|---|---|---|
| `vitest` | 3.2.7 | **4.1.12** |
| `@vitest/coverage-istanbul` | 3.2.7 | **4.1.12** |
| `@vitest/mocker` (Abhängigkeit) | 3.2.7 | 4.1.12 |
| `tinypool` (Abhängigkeit) | 1.1.1 | entfällt (Vitest 4 nutzt es nicht mehr) |
| `happy-dom` | 20.14.5 | **21.0.4** |

Lockfile: Der Vitest-Commit ändert 15 und entfernt 49 Pakete (Vitest-Kette inkl. `vite-node`, `tinypool`, alte `test-exclude`-Abhängigkeiten) und fügt 3 hinzu
(`@standard-schema/spec`, `estree-walker`, `obug`); der happy-dom-Commit ändert nur `happy-dom`. `vite`, `jsdom`, `undici` blieben unverändert. [belegt: Lockfile-Diff je Commit]
npm 10.9.3 bricht beim Peer-Set von Vitest 4 mit einem Arborist-Fehler ab (`Cannot read properties of null (reading 'edgesOut')`); der Install lief mit npm 11.21.1
über `npx`. npm 10 entfernt unter Windows außerdem die `libc`-Felder, sie wurden wiederhergestellt (14 Einträge, siehe unten).

### Geprüfte Breaking Changes
**Vitest 4** (Quelle: v4.vitest.dev/guide/migration; "Ergebnis" bezieht sich auf dieses Repo):
| Änderung | Betrifft uns? | Ergebnis |
|---|---|---|
| Node ≥ 20, Vite ≥ 6 | lokal Node 22.20, CI Node 24, `vite` 7.3.7 | erfüllt [belegt] |
| `poolOptions` entfernt, Optionen auf oberster Ebene | ja (`execArgv: --no-experimental-webstorage`) | in `vitest.config.ts` auf `execArgv` migriert; im Worker per `process.execArgv` bestätigt, Deprecation-Warnung weg [belegt] |
| `coverage.all`, `extensions`, `ignoreEmptyLines`, `experimentalAstAwareRemapping` entfernt | nein (nicht gesetzt); wir setzen `include` explizit | Coverage unverändert (Zeilen 91,35 % gegen 91,33 %) [belegt] |
| Default-Excludes nur noch `node_modules` und `.git` | möglich (mehr Dateien könnten als Tests erkannt werden) | Anzahl unverändert: 126 Dateien [belegt] |
| `vi.fn`/`vi.spyOn` mit `new`, `getMockName`, `restoreAllMocks`, `invocationCallOrder` ab 1 | `restoreAllMocks` (4 Stellen), `invocationCallOrder` (1 Test); kein `new` auf Mocks, keine Snapshots | alle Tests grün ohne Änderung [belegt] |
| Test-Optionen als 3. Argument entfernt | nein (keine Fundstelle) | [belegt: Suche] |
| `workspace`, `poolMatchGlobs`, `environmentMatchGlobs`, `deps.*`, `vite-node`, `transformMode` | nein (keine Fundstelle) | [belegt: Suche] |
| Browser-Modus, Reporter `basic`/`verbose`, Snapshot-Shadow-Root | nein (Standard-Reporter, keine `*.snap`) | [belegt: Suche] |

**happy-dom 21** (Quelle: GitHub-Releases v20.14.6 bis v21.0.4):
| Änderung | Betrifft uns? | Ergebnis |
|---|---|---|
| 21.0.0: CSS-Dateien und Iframes werden standardmäßig nicht mehr geladen (`enableCSSFileLoading`, `enableIframePageLoading`, `disableCSSFileLoading` veraltet) | nein: kein Test lädt Stylesheet-Links oder Iframes; die `<iframe>`-Treffer sind Angriffs-Strings für den Sanitizer | [belegt: Suche, Testlauf] |
| 21.0.1 bis 21.0.4, 20.14.6: Sicherheits-Patches (SSRF im Server-Renderer, Authorization-Header bei Redirect, Cookie-Scope, ESM-Compiler-Injection) | nur als Fix | keine API-Änderung genannt |
| Events, `localStorage`, `document.hidden` (von uns genannt) | in den Release-Notes **nicht** als Änderung aufgeführt; `useDeploymentStatusPolling` (nutzt `document.hidden`), `localStorage`-Specs und Netzwerk-Guard-Tests laufen grün | [belegt: Release-Notes und Tests]. **[Annahme]** Nicht dokumentierte Verhaltensänderungen sind nicht ausgeschlossen; die Tests sind der einzige Beleg. |
| Die fünf jsdom-Specs (DOMPurify/XSS) | unverändert auf `jsdom` | grün, keine Änderung [belegt] |

**Verbleibend (2 Einträge):** `postcss-selector-parser` 6.0.10 / 6.1.4 (GHSA-rj75-hqrm-r3gf) und `@tailwindcss/typography` 0.5.20 (abgeleitet). Bewertung und
Annahme (Build-Zeit auf eigenem CSS) unverändert wie unten; keine Tailwind-4-Migration.

## Stand nach #82 (historisch): verbleibende Funde, 7 Einträge, 6 Advisories
Die Zeilen zu `tinypool`, `@vitest/mocker`, `happy-dom`, `vitest` und `@vitest/coverage-istanbul` sind mit #83 behoben; die dort gekennzeichneten
Annahmen zu diesen Paketen sind damit hinfällig. Bestehen bleiben die Zeilen zu `postcss-selector-parser` und `@tailwindcss/typography`.
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
- **#83 (Vitest 4, happy-dom 21):** erledigt, siehe "Stand nach #83". Die Zielversionen haben alle genannten Funde beseitigt.
- **Tailwind:** erneut bewerten, wenn `tailwindcss` oder `@tailwindcss/typography` einen `postcss-selector-parser` ≥ 6.1.5 mitbringen.
- **`jsdom`:** bleibt, solange die DOMPurify-Tests es brauchen. Beim Upgrade von `jsdom` die Abhängigkeit `undici` mitprüfen (jsdom 30 nutzt `undici ^8`).
- **Regel:** Ein `npm install`/`npm update` unter Windows entfernt die `libc`-Felder der nativen Linux-Pakete aus `package-lock.json`. Diese Felder sind
  in #82 und #83 wiederhergestellt worden (npm 11 behält sie, npm 10 nicht); bei künftigen Lockfile-Änderungen unter Windows prüfen, dass der Diff nur die beabsichtigten
  Pakete zeigt. Kann npm 10 das Peer-Set nicht auflösen (Arborist-Fehler), hilft `npx npm@11 install ...`.
