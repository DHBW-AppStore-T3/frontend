# Handover — Frontend

Lebendes Übergabedokument gemäß [HARNESS.md](https://github.com/DHBW-AppStore-T3/.github/blob/main/docs/HARNESS.md) Abschnitt 1.2.
Jede Session liest dieses Dokument zu Beginn und aktualisiert es vor dem Abschluss.

---

> **Stand Oktober 2026 (.github#12):** Der OpenStack-VM-Pfad ist aus dem Frontend entfernt (Credentials-Einstellungen, Ressourcen-Picker, Quota-Kachel, Infrastructure-Tab). Es gibt nur noch Pod-Deployments. Abschnitte unten beschreiben teilweise noch den alten Stand.

## 1. Status & Fokus

- **Stack:** React 19, Zustand, React Router 7, react-i18next, Tailwind CSS, Vite, TypeScript, Vitest + React Testing Library.
- **Die 2 Flows (Harness Engineering):**
  - **Flow 1 (`/user-story`):** Vorab-Spezifikation von UI/UX-Komponenten, Store-State und OpenAPI-Typen im Issue.
  - **Flow 2 (`/harness-workflow`):** Autonomer Feature-Bau gegen `dev` -> TDD (Vitest) -> PR auf `dev` -> CI grün -> Auto-Merge -> Automatisches Staging Deployment -> Hermes Discord Statusmeldung.
  - **Push auf `main`:** Bleibt rein menschlich! Abgesichert durch automatisiertes **Test Coverage Gate**.
- **CI/CD:** `ci.yml` unterstützt jetzt `main` und `dev`. Push auf `dev` baut Images und stößt Staging Deployment an.

---

## 2. In Arbeit & Nächste Schritte

- [x] Reengineering auf 2 Flows: `ci.yml` auf `dev`-Trunk und Test Coverage Gate für `main` umgestellt.
- [x] Staging-Deploy-Trigger korrigiert auf `DHBW-AppStore-T3/deployment --ref dev`.
- [ ] Typensichere API-Client-Integration mit generierten Typen (`api.generated.ts`) fortführen.
- [ ] Pods/K8s-Frontend (frontend#36, Branch `spike/react-pods`): Port von `spike/vue-pods` abgeschlossen (AP0-AP7);
      offen ist die E2E-Abnahme auf dem k8s-Staging und der Cutover (AP8, Checkliste in
      `claude_docs/decisions/2026-react-pods.md`).

---

## 3. Bekannte Fallstricke & Blocker

1. **Typensicherheit:** `tsc -b` schlägt bei fehlerhaften Typen im CI Build fehl; Typen vor dem Commit immer lokal prüfen.
2. **Coverage Gate:** Der Job `🧪 Test` in `ci.yml` verlangt auf **jedem** Branch und PR mindestens 85,0 % Zeilen (`MIN_COVERAGE`,
   Metrik `total.lines.pct`). Die Linux-CI misst ca. 91,3 %. Wert immer mindestens 2 Punkte unter dem CI-Ist-Wert halten und
   `CLAUDE.md` mit anpassen.
3. **Security-Audit:** `npm audit --omit=dev` ist 0 und blockiert in der CI. `npm audit` (mit Dev) meldet 2 bewusst akzeptierte Funde
   (`postcss-selector-parser`, `@tailwindcss/typography`, beide moderate; Tailwind 3). Begründung je Fund und Stand nach den Upgrades in
   `claude_docs/decisions/2026-dev-dependency-audit.md`.
4. **Netzwerk-Guard:** Jeder ungemockte `fetch`/XHR lässt den Test fehlschlagen. Neue Views brauchen ihre API-Module als Mock
   (oder `allowRealNetwork()` mit Begründung). `NETWORK_GUARD=warn` listet alle Verursacher.
5. **Windows:** `docker-entrypoint.spec.ts` braucht `sh` und `envsubst` (Git for Windows im `PATH`). Die Tests laufen auf Windows und
   Linux (frontend#79); ohne die Werkzeuge werden sie lokal sichtbar übersprungen, in der CI schlagen sie fehl. Der Pfad des
   Scratch-Verzeichnisses wird als gequoteter POSIX-Pfad in das Skript eingesetzt (`shQuote`), nie als Windows-Pfad.
6. **Messen statt raten:** Flackernde Tests mit `--maxWorkers=1 --no-file-parallelism` und vielen Einzelläufen messen (ein Flake
   kann bei 3 % bis 15 % liegen). Ein globaler Store (Toasts, Deployment-Entwurf) ist geteilter Zustand: Code, der ihn leert
   (`clear()`), trifft auch Hinweise, die ihm nicht gehören (frontend#102).
7. **Effekte sind nicht "fertig", wenn das DOM da ist:** `findBy...` löst beim Einfügen des Knotens auf; ein `useEffect`
   (Log, Analytics) kann erst danach laufen. Auf den Effekt selbst mit `waitFor` warten.

---

## 4. Letzte Übergaben (Historie)

- **2026-10-26 (Vitest 4 und happy-dom 21, frontend#83, Teil von Epic #77):** `vitest` und `@vitest/coverage-istanbul` 3.2.7 → **4.1.12**, `happy-dom` 20.14.5 →
  **21.0.4**, in zwei einzeln lauffähigen Commits. `npm audit` von 7 auf **2** Funde (nur noch Tailwind/PostCSS), `--omit=dev` weiter 0. Baseline und Ergebnis
  identisch: 126 Dateien, 1283 Tests, Zeilen 91,33 % → 91,35 % (Statements 90,01 → 90,03; Funktionen 90,79; Branches 82,69), Gate 85 % hält. **Kein Test musste geändert werden.**
  **Einzige Code-Änderung:** `vitest.config.ts`, weil Vitest 4 `poolOptions` entfernt hat: `execArgv: ['--no-experimental-webstorage']` steht jetzt oben auf `test`
  (im Worker per `process.execArgv` bestätigt). Geprüfte Breaking Changes beider Majors mit Beleg: `claude_docs/decisions/2026-dev-dependency-audit.md`, Abschnitt "Stand nach #83".
  Bei happy-dom 21 betrifft nur "CSS und Iframes laden standardmäßig nicht mehr" die API; nichts im Repo nutzt es. **Lehren:**
  1. **npm 10.9.3 scheitert an Vitest 4** (Arborist: `Cannot read properties of null (reading 'edgesOut')` im Peer-Set). `npx npm@11 install ...` (11.21.1) funktioniert, der
     Lockfile-Diff enthielt nur die Vitest-Kette und behielt die `libc`-Felder. Nach dem happy-dom-Install mit npm 10 fehlten die `libc`-Felder wieder (Skript, das sie aus `HEAD`
     zurückholt, siehe #82). Lockfile-Diff nach jedem npm-Befehl auf Paketebene prüfen.
  2. Die `--no-experimental-webstorage`-Option ist unter Node 22.20 wirkungslos (`localStorage` ist dort ohne Flag aus) und schützt erst ab Node 25; sie wurde trotzdem migriert.
  3. Ein einzeln stehender Peer (`@vitest/coverage-istanbul` auf der alten Version) blockiert `npm install vitest@4`; beide Pakete im selben Befehl anheben.
  4. Ein Vitest-4-Blocker ist nicht aufgetreten; wäre einer aufgetreten, hätte er dokumentiert und die Tests nicht geschwächt werden dürfen.

- **2026-10-26 (Dev-Abhängigkeiten und Security-Audit, frontend#82, Teil von Epic #77):** `npm audit` von 10 auf 7 Funde (alle Dev-Tooling),
  `npm audit --omit=dev` weiter 0. **Geändert:** `vite` 7.3.6 → 7.3.7 (5 Funde zu Vite/launch-editor), `undici` 7.30.0 → 7.30.1 (nur Lockfile, innerhalb
  `jsdom`s `^7.25.0`, 3 Funde), `@vitest/coverage-v8` entfernt (ungenutzt, 6 Pakete weniger). **Abweichung vom Issue:** `jsdom` bleibt. Das Issue nahm an,
  es werde nirgends gebraucht; fünf Test-Dateien setzen `// @vitest-environment jsdom`, weil DOMPurify (XSS-Schutz fürs Markdown) ein spec-konformes DOM
  braucht, happy-dom behält Handler. Testanzahl und Coverage unverändert (126 Dateien, 1283 Tests, 91,33 % Zeilen). Entscheidungseintrag mit allen verbleibenden
  Advisories, belegten Fakten und gekennzeichneten Annahmen: `claude_docs/decisions/2026-dev-dependency-audit.md`. **Lehren:**
  1. **`npm install`/`uninstall`/`update` unter Windows löscht die `libc`-Felder** (glibc/musl) der nativen Linux-Pakete aus `package-lock.json` (14 Einträge). Das
     ändert das Linux-/Docker-`npm ci`. Nach jedem npm-Befehl den Lockfile-Diff prüfen und die Felder zurückholen; hier mit einem kleinen Skript, das nur
     `libc` aus `HEAD` zurückträgt (Zeilenenden bleiben CRLF). Ziel: Diff zeigt nur die beabsichtigten Pakete.
  2. Annahmen im Issue gegen den Stand prüfen: "12 Funde" waren 10, "jsdom ungenutzt" war falsch. Fix-Versionen aus Registry und Advisory lesen, nicht aus dem Gedächtnis.
  3. Für #83 reichen laut Advisories und Registry `vitest` und `coverage-istanbul` 4.1.12 und `happy-dom` 21.0.4 (kein 5.x nötig); `vitest` 4.1.12 hat kein `tinypool` mehr.

- **2026-10-26 (Coverage-Gate auf 85 %, frontend#80, Teil von Epic #77):** `MIN_COVERAGE` in `.github/workflows/ci.yml` von 40,0 auf
  85,0 angehoben. **Gemessen auf der Linux-CI:** 91,33 % Zeilen im Push-Lauf auf `dev` (`40408558912`), 91,33 % und 91,19 % in zwei
  weiteren grünen Läufen (`40407041329`, `40403557161`); Statements 90,01 %, Branches 82,69 %, Funktionen 90,79 %. Lokal unter Windows
  exakt dieselben Zahlen (91,33 %). Das Gate prüft nur Zeilen. 91,3 % ist über der Schwelle von 87 % aus dem Issue, daher 85,0 und
  ca. 6 Punkte Puffer. Die 90,7 % im Issue-Text waren ein älterer Wert. **Nachweis, dass das Gate greift:** Wegwerf-Branch
  `tmp/80-gate-proof` (inzwischen gelöscht) mit `MIN_COVERAGE=92.0`, CI per `workflow_dispatch` gestartet (Lauf `40409842918`): Job `Test`
  scheitert im Schritt `Test Coverage Gate` mit `Coverage Gate Failed: 91.33% < 92.0%`, `Build`/`Image Scan`/`Push`/`Rollout` übersprungen.
  **Doku angeglichen:** `CLAUDE.md` (85 %), dieser Fallstrick 2 (stand auf 60 % für `main`, die Workflow-Datei auf 40 %) und
  `docs/architecture/architecture.md` (Momentaufnahme, nur mit Hinweis ergänzt). Das alte Log `claude_docs/log/2026-W39.md` blieb als
  Historie unverändert. **Lehren:**
  1. Das Gate galt schon vorher auf jedem Branch, nicht nur auf `main`; die alten Angaben ("PRs auf `main`", 60 %) stimmten nicht.
  2. Ein Gate-Nachweis geht ohne PR: `workflow_dispatch` auf einem Wegwerf-Branch. Push und Rollout laufen dort nicht (nur `main`/`dev`).
  3. Beim Anheben nicht nur die Zahl, auch den Kommentar in `ci.yml` pflegen: der alte nannte "Lowered 2026-10 back to 40 %".

- **2026-10-26 (zwei verbleibende Flakes, frontend#102, Teil von Epic #77):** `NewDeploymentConfigView.spec` ("verlangt
  mindestens einen Studierenden") und `error-boundary.spec` ("logs the error once"). **Beides echte Ursachen, keine Timeouts erhöht.**
  1. **`NewDeploymentConfigView` (Produktcode-Fehler):** `useStudentDirectory` plante beim Öffnen einen Debounce-Timer für die
     Suche mit leerer Query. Nach 300 ms rief er `toaster.clear()` auf und leerte damit den **globalen** Toast-Store, also auch
     Hinweise, die nichts mit der Suche zu tun haben (die Validierung "Weiter", ebenso ein Ladefehler der Kurse). Im Test lag der
     Klick manchmal knapp vor diesem Timer (gemessen: Toast `0->1`, 1 bis 13 ms später `1->0`). Reproduziert: 2 von 20, 1 von 30,
     2 von 40 Einzelläufen. **Fix in `src/views/new-deployment/useStudentDirectory.ts`:** `toaster.clear()` ist ganz raus. Die
     Suche merkt sich die ID ihres **eigenen** Fehler-Toasts (`searchErrorId`) und entfernt nur diesen (`removeToast`), wenn
     die nächste Suche gelingt, die Query leer oder zu kurz ist oder erneut ein Fehler kommt. Fremde Toasts (Ladefehler,
     Validierung) bleiben, auch während und nach der Suche. Debounce, Ergebnisse und gültige Suchanfragen sind unverändert.
     Ein erster Zwischenstand sperrte nur den Timer der leeren Start-Query; das ließ `clear()` bei aktiver Suche weiter wirken
     und wurde im Review korrigiert. **Neue Tests:** deterministisch mit Fake-Timern (Start-Timer räumt nichts weg), fremde
     Warnung und fremder Fehler bleiben nach abgeschlossener Suche, und nur der Suchfehler verschwindet bei der nächsten
     erfolgreichen Suche. Der zuerst geschriebene Test "räumt einen alten Hinweis weg" legte das globale Löschen fest und ist
     ersetzt.
  2. **`error-boundary` ("logs the error once"):** `RouteError` loggt in einem `useEffect`; `findByRole('alert')` löst beim Einfügen
     des Knotens auf, der Effekt konnte danach laufen. Gemessen mit Zeitstempeln: im Fehlerfall nur `alert-found`, der
     `[RouteError]`-Log kam erst nach dem Testkörper (stand dann im echten stderr, weil `afterEach` den Spy schon zurückgesetzt
     hatte). **Fix im Test:** `waitFor` auf genau einen Log-Eintrag, danach `await act(async () => {})` und erneut genau
     einen erwarten, damit "einmal" weiter geprüft wird. Die Rate ist niedrig (Original: 0 von 30 unter Last, Diagnose-Variante
     1 bis 4 von 10 bis 30), die Ursache ist per Reihenfolge belegt, die Korrektur wartet auf die Bedingung selbst.
  **Abweichung vom Issue:** #102 schloss `src/` aus, die Ursache von 1. liegt aber im Produktcode und wird hier begründet
  behoben. **Verifikation (Windows, 1 Worker):** beide Dateien 20/20 grün, `tsc`, Lint (0 Errors), Build grün, Gesamtsuite grün.
  **Lehren:** (a) Wer einen globalen Store leert, leert ihn für alle. (b) Beim Flake-Debugging die Zwischenzustände mitschreiben
  (Store-Subscription, Event-Listener, Zeitstempel) statt zu raten: erst das zeigte, dass der Toast entstand und wieder verschwand.
  (c) Ähnlich gebaute Prüfungen ("nach `findBy...` sofort Seiteneffekt eines Effekts prüfen") wurden nicht systematisch gesucht.

- **2026-10-26 (docker-entrypoint-Tests plattformfest, frontend#79, Teil von Epic #77):** Nur Tests und Doku, `docker-entrypoint.sh`
  unverändert. **Ursache (per Experiment belegt, nicht wie im Issue vermutet fehlendes `sh`/`envsubst`):** Der Test ersetzt
  `/tmp/runtime` und `/usr/share/nginx/html` im Skripttext durch den Scratch-Pfad. Beide Stellen stehen im Skript
  unquotiert (`RUNTIME_DIR=/tmp/runtime`, `< /usr/share/nginx/html/env-config.js`). Ein Windows-Pfad mit Backslashes verliert dort
  die Backslashes (`C:Users...`), ein Leerzeichen würde ihn teilen. Folge: `ENOENT runtime/*.conf` und, weil `mkdir -p` im
  Arbeitsverzeichnis des Laufs lief, leere Müllverzeichnisse `C:Users...runtime/` im Repo-Root (git sieht leere Verzeichnisse nicht).
  **Fix in `tests/unit/infra/docker-entrypoint.spec.ts`:** `shQuote()` setzt den Pfad mit Forward-Slashes in einfachen
  Anführungszeichen ein (`'` wird zu `'\''`); `spawnSync` läuft mit `cwd` im Scratch-Verzeichnis, das Verzeichnis heißt bewusst
  mit Leerzeichen (`entrypoint spaces-...`). Kein `skipIf` nach Plattform. `runOk()` prüft bei Erfolgsfällen Exit 0, leeres
  stderr, genau die fünf erzeugten Dateien (`api-gateway.conf`, `env-config.js`, `listen.conf`, `security-headers.conf`,
  `silent-refresh-headers.conf`) und dass sonst nichts im Scratch-Verzeichnis liegt; die Inhalts-Assertions blieben unverändert.
  Die zwei Ablehnungs-Tests (`FRAME_ANCESTORS`, `API_UPSTREAM`) prüfen jetzt auch die Fehlermeldung, vorher genügte Exit 1, der
  auch von einem Folgefehler kam. Neuer Test `has sh and envsubst in CI` schlägt fehl, wenn `CI` gesetzt ist und eines fehlt;
  lokal ohne die Werkzeuge bleibt es ein sichtbarer Skip (Werkzeug-, nicht Plattform-Skip). **Verifikation (Windows, 1 Worker):**
  Datei 10/10 Läufe grün (18 Tests, 0 skipped), Gesamtsuite 125/125 Dateien, 1274/1274 Tests, `tsc`, Lint (0 Errors), Build
  grün. Mutationsprüfung: Backslash-Pfad oder ungequotetes Einsetzen machen 17 von 18 Tests rot. Nach den Läufen keine Reste
  im Repo und in `%TEMP%`. **Lehren:**
  1. Beim Einsetzen von Pfaden in Shell-Text immer quoten und Forward-Slashes nutzen; Pfade mit Leerzeichen gehören in den Test.
  2. Ein reiner Exit-Code-Test kann an einem Folgefehler "bestehen": die Fehlermeldung mitprüfen.
  3. Müllverzeichnisse nach Windows-Läufen mit `ls | grep '^C:'` suchen; sie sind für git unsichtbar.

- **2026-10-26 (Testinstabilität und Netzwerk-Guard, frontend#78, Teil von Epic #77, PR #100):** Nur Tests, kein `src`.
  **Netzwerk-Guard** (`tests/helpers/network-guard.ts`, eingehängt in `tests/setup.ts`): ein Test, der ein ungemocktes
  `fetch` oder `XMLHttpRequest` schickt, schlägt fehl (axios nutzt unter happy-dom den xhr-Adapter). Der Verstoß wird
  zusätzlich gemerkt und in `afterEach` erneut geworfen, weil getesteter Code abgelehnte Requests oft verschluckt.
  `allowRealNetwork()` hebt den Guard pro Test auf; mit `vi.stubGlobal` ersetzte Funktionen und Node-Environment-Tests
  bleiben unberührt; `NETWORK_GUARD=warn` loggt nur (zum Auflisten aller Verursacher). Tests dazu:
  `tests/unit/helpers/network-guard.spec.ts` und `network-guard.node.spec.ts`. **Behobene Ursachen des Flackerns:**
  1. `routes.spec`: `AdminSettingsView` rendert `RecommendedAppsCard`, deren Request als einziger der ganzen Suite
     ungemockt war. Jetzt wird `@/api/app.api` gemockt. Dazu werden alle Lazy-Routen einmal in `beforeAll` geladen, damit
     das 1-s-`waitFor` Routing misst und nicht den ersten dynamischen Import.
  2. `AddAppsView.spec`: `userEvent.type` rendert bei jedem Tastendruck die Markdown-Vorschau neu und lief ins
     5-s-Timeout. Felder werden jetzt per Klick + `paste` gefüllt; der Live-Vorschau-Test tippt weiterhin. Kein Netzwerk
     beteiligt. Es wurde keine Assertion entfernt oder abgeschwächt.
  **Verifikation (Windows, 1 Worker):** 20 Wiederholungen der drei betroffenen Gruppen 20/20 grün, `tsc`, Lint (0 Errors),
  Build grün; `dev` (Stand `9034630`) ist in den Branch gemergt, `tsc` danach grün. **Lehren:**
  1. `tsc -b` verbietet Parameter-Properties im Konstruktor (`erasableSyntaxOnly`, TS1294), auch in `tests/`.
  2. **Weiter flackernd, vorbestehend, nicht von #78:** `NewDeploymentConfigView.spec` ("verlangt mindestens einen
     Studierenden") scheitert auch auf der Basis `916c93f` ohne diese Änderung (3 von 20 Einzelläufen); in der
     Gesamtsuite zeigte sich einmalig auch `error-boundary.spec` ("logs the error once", Spy sieht den Log-Aufruf zu
     früh). Der Guard meldet dabei keine Verstöße. Eigenes Issue nötig.
  3. Unter Windows waren die 10 `docker-entrypoint.spec`-Tests rot (frontend#79, im Issue stand 9); behoben, siehe
     Eintrag 2026-10-26 (docker-entrypoint).
  4. Im Worktree `frontend/` fehlt `vitest` in `node_modules`; Tests dort starten nicht.

- **2026-10-26 (Architektur-Ist-Stand, C4, beide Oberflächen):** Neu: `docs/architecture/architecture.md` (statische und
  dynamische Architektur von **Frontend und self-service-ui** mit Kontext-, Container-, Komponenten-, Deployment- und zehn
  Dynamic-Diagrammen) und `docs/architecture/workspace.dsl` (Structurizr-Modell, über den Structurizr MCP Server validiert
  und nach Mermaid exportiert). Beschrieben ist `dev` (= Staging) zum Zeitpunkt der Analyse: Frontend `0005672`,
  self-service-ui `54130c3`. **Spätere `dev`-Commits sind nicht
  erfasst.** Prod liegt 47 bzw. 13 Commits hinter dem beschriebenen Stand (Tabelle 1.1 im Dokument). Am 2026-10-26 14:14 UTC
  wurden die laufenden Digests in `appstore-staging` und `appstore-prod` gegen die Pins geprüft: alle gleich, Argo überall
  `Synced`/`Healthy`. Das Dokument zitiert keine Zeilennummern, weil sie mit jedem `dev`-Commit driften.
  Befunde B1 bis B13 stehen im Dokument, u. a. direkte API-Aufrufe aus 14 Dateien, kein Retry nach 401, kopierte Wizard- und
  Katalog-Logik in beiden Repos, Doku-Drift (Wizard-Reihenfolge, Coverage-Gate). **Nicht zur Laufzeit geprüft.** Die
  Mermaid-Blöcke sind Exporte und müssen nach jeder DSL-Änderung neu erzeugt werden; ein Skript dafür liegt nicht im Repo.

- **2026-10-25 (Error Boundaries, frontend#81, Teil von Epic #77):** Ein Render-, Lazy-Import- oder Loader-Fehler lässt die App
  nicht mehr weiß werden. `src/components/RouteError.tsx` ist der `errorElement` (Titel + Kurztext, Schaltflächen „Seite neu
  laden" und „Zum Dashboard", der Fehler geht nur per `console.error('[RouteError]', error)` ins Log, nie in die Seite).
  Im Router steht er zweimal: auf der Root-Route (`fullPage`, fängt ein ausfallendes Layout) und auf einer **pathlosen
  Wrapper-Route um die Kindrouten** jedes Layouts (Hilfsfunktion `contained()` in `src/router/index.tsx`). Ein
  `errorElement` direkt am Layout würde Sidebar und Header mit ersetzen; am Wrapper ersetzt es nur die Seite. URLs, Guards
  (Loader) und Navigation sind unverändert, der Fehler wird beim nächsten Routenwechsel vom Router zurückgesetzt. Texte unter
  `router.error.*` (de/en). Tests: `tests/unit/router/error-boundary.spec.tsx` (10). **Nicht im Browser geprüft**, nur
  per Test; Hauptbundle +3 kB. **Bekannt, nicht von dieser Änderung:** `routes.spec` ("sends role-less users from admin routes
  to /forbidden") flackerte auch auf `dev` (gemessen 2 von 12 Läufen mit und ohne die Änderung); Ursache in frontend#78
  behoben (siehe Eintrag 2026-10-26).

- **2026-10-25 (Statuspolling für Mitglieder, frontend#71):** Studierende (`permissions.member && !owner_view`) sehen den
  Status einer laufenden Bereitstellung (`pending`/`running`) in `/deployments/:id` ohne Neuladen. Der SSE-Stream bleibt
  Besitzer/Dozenten vorbehalten (rohe Worker-Logs), deshalb pollt `useDeploymentStatusPolling` `GET /deployments/{id}`
  alle 10 s. **Entscheidungen:** direkter `deploymentApi.getById(id, { signal })` statt `fetchDeploymentById`, weil
  `runRequest` `isLoading`/`error` setzt und 403/404/Netzfehler nicht unterscheidbar macht; Store-Write nur bei
  inhaltlicher Änderung (`JSON.stringify`) und nur für die eigene `deploymentId`; verkettete `setTimeout` statt
  `setInterval` (keine überlappenden Requests); Netzfehler/5xx/401 -> `degraded` mit Backoff `min(10 s * 2^n, 20 s)`,
  403 -> `forbidden` (Stopp), 404 -> `onGone` (Toast + Liste); `document.hidden` pausiert und bricht den Request ab,
  Rückkehr fragt sofort. Beim Ende des Pollings lädt `useDeploymentDetail` `/my-access` nach (Zugangsdaten gibt es nur
  dort). `DeploymentStatusNotice` zeigt Hinweise für `failed` (auch beim ersten Öffnen), Verbindungsproblem und
  fehlenden Zugriff. **Bewusst nicht gepollt:** `pausing`/`resuming`/`destroying` (`isLiveStatus` ist zentral).
  **Stolperstein:** `npm ci` im OneDrive-Ordner scheitert mit `EPERM` an `esbuild.exe`; in einem Worktree außerhalb von
  OneDrive arbeiten.

- **2026-10-25 (Überschrift zentriert, Nachtrag zu frontend#56):** Im Kopf von `/apps/:id` steht die Metazeile (Badge, Git-Link)
  nur noch in der Admin-Ansicht im DOM, und der Abstand `mb-2` unter dem Titel gilt nur dort. `.app-detail-heading` und die
  innere Zeile richten mit `align-items: center` aus, damit der Titel ohne Metazeile neben dem Logo mittig sitzt. Nicht im
  Browser geprüft (Test prüft nur die Struktur).
- **2026-10-25 (Git-Link nur für Admins, Nachtrag zu frontend#56):** Der GitHub-Link im Kopf von `/apps/:id` steht jetzt
  zusammen mit dem Badge „Versionen verfügbar" in `<RoleGate adminView>`: Dozenten, Studierende und Admins ohne
  Admin-Ansicht sehen ihn nicht. Der Link in der Karte „Versionsinformationen" (`html_url` des Tags) bleibt unverändert.
- **2026-10-25 (Version festlegen, frontend#56):** Auf `/apps/:id` sehen nur Admins mit Admin-Ansicht das Badge „Versionen
  verfügbar", den Tab „App Store" und die Versionsauswahl. Alle anderen deployen `deployVersionOf(app, versionOptions)`
  (`app.deploy_version`, wenn noch gelistet, sonst die erste Version). In der Admin-Ansicht heißt der Button „Version
  festlegen" (`appApi.admin.setDeployVersion` → `PUT /admin/apps/{id}/deploy-version`, Backend #43/#44), deaktiviert bei
  laufendem Speichern, bereits festgelegter oder nicht freigegebener Version; er startet kein Deployment. `useAppDetail`
  lädt Freigaben nur noch für die Admin-Ansicht (Parameter `loadsApprovals`). Folge laut Issue: Besitzer ohne Admin-Rolle
  können Versionen nicht mehr selbst einreichen (Tab weg). Der alte Test „Besitzer kann deaktivierte App nicht öffentlich
  machen" im View-Test entfiel, weil der Store-Tab nur noch für Admins erreichbar ist. Offen: `openapi.json`/
  `api.generated.ts` nicht neu generiert (siehe #55).
- **2026-10-25 (Filter „Empfohlen", frontend#55):** `AppsView` hat den Tab „Empfohlen" als ersten (nur wenn eine App
  `recommended` ist); `selectedFilter` ist `CatalogFilter | null`, `activeFilter` fällt auf „Empfohlen" bzw. „Alle" zurück,
  eine Nutzerauswahl bleibt. Admins schalten pro App in `/admin/settings` (neue Karte `RecommendedAppsCard`, Schalter bis zur
  Antwort deaktiviert, Fehler-Toast) über `appApi.admin.setRecommended` → `PUT /admin/apps/{id}/recommended` (Backend #42).
  `Toggle` hat die neue Prop `disabled`. Offen: `src/types/openapi.json` und `api.generated.ts` sind nicht neu generiert
  (im Backend liegt keine `openapi.json` im Repo), der Contract-Test prüft den neuen Endpunkt daher noch nicht.
- **2026-10-24 (Hilfe-Seite gekürzt, frontend#54):** `HelpView` ohne Einleitung, „Für wen ist diese Seite?", `quickTip`,
  Seitenübersicht (`quickHelp.page*`, `processTitle`, `pagesTitle`) und `troubleshooting.description`; die Schlüssel sind
  aus `de.ts`/`en.ts` gelöscht. Checkliste hat jetzt drei Punkte (neu: OpenStack-Credentials), Schrittfolge „So starten Sie
  ein Deployment" folgt den Wizard-Schritten. Farbe: Links `text-info`, Überschriften `text-textHeading` mit Icon in
  `text-info`, kein `text-primary` mehr. Englisch nennt den Wizard-Schritt „Overview" (so heißt er in der UI), nicht
  „Summary". Die sachliche Richtigkeit der Schritte muss noch eine Person aus dem Team gegenlesen (Akzeptanzkriterium).
- **2026-10-24 (Nachtrag #53, Griff-Symbol):** Im Browser (Dev-Container, Entwurf per Dev-Store gesetzt) gegengeprüft: bei
  „je Person" sind Hinweis weg, Zufall/Zurücksetzen disabled, 0 ziehbare Karten, echtes Ziehen ändert nichts. Offen war das
  Griff-Symbol (⋮⋮) auf den Karten; es entfällt jetzt bei `dragDisabled`. Hinweis zum Testen: VM-Apps brauchen eine
  OpenStack-Credential, ohne sie lässt sich der Wizard nicht regulär erreichen. Nach einem Branch-Wechsel oder langer Sitzung
  Tab neu laden, der Vite-HMR im Docker-Mount liefert sonst veraltete Module (zwei Store-Instanzen `?t=…`).
- **2026-10-24 (Verteilung „je Person", frontend#53):** In `NewDeploymentGroupsAssignmentView` steuert `isForced`
  (`forcedGroupMode === 'eachUser'`) jetzt Hinweis, Buttons und Karten: Drag-&-Drop-Hinweis nicht gerendert, „Zufall" und
  „Zurücksetzen" `disabled` (ausgegraut, ohne Hover-Wechsel), `dropOn` kehrt früh zurück. `UnassignedPool` und `TeamColumn`
  haben die Prop `dragDisabled` (Karten nicht `draggable`, ohne `cursor-move`/Hover-Skalierung, kein Entfernen-Button).
  Andere Modi unverändert; keine neuen Texte. Gelber Hinweis „App läuft je Person" bleibt.
- **2026-10-24 (Sie-Form Nachtrag, frontend#52):** Der Test aus #52 hatte Lücken: „Durchstöbere" (Apps-Untertitel),
  „Aktualisiere" und „prüfe sie" (Fehlercode) blieben Du-Form. Texte korrigiert, Imperativ-Liste erweitert, zusätzlich prüft
  der Test jetzt Imperative nach `;` `,` `:` und „bitte". „Entferne..." ist als Ellipsen-Status erlaubt.
- **2026-10-24 (Sie-Form, frontend#52):** Alle Du-Pronomen und Du-Imperative in `src/i18n/locales/de.ts` sind auf Sie-Form
  umgestellt, `en.ts` unverändert. Neuer Test `tests/unit/i18n/sie-form.spec.ts` flacht `de.ts` ab und schlägt bei Du-Pronomen
  oder Imperativ-Anfängen (Liste im Test, auch nach „Bitte") fehl. Ausnahmen: Statusmeldungen in Ellipsen-Form („Lade Kurs...")
  und die Toasts „Setze/Lösche Deployment … — siehe Live-Fortschritt unten." Neue Imperative bei Bedarf in die Liste im Test
  aufnehmen. Die Hilfe-Texte (`HelpView.*`) sind ebenfalls umgestellt; das Issue „Hilfe-Seite: Texte kürzen" schreibt sie neu,
  Konflikte löst, wer später merged.
- **2026-10-24 (Dashboard-Begrüßung, frontend#51):** Hero-Überschrift lautet „Hallo {Vorname}" (`DashboardView.greeting`),
  Fallback großgeschriebener Benutzername, ohne Nutzer „Hallo" (`greetingAnonymous`). Logik in
  `src/utils/user-display.ts` (`greetingNameOf`). Tageszeit-Eyebrow und `DashboardView.timeGreetings.*` sind entfernt;
  damit war `.page-eyebrow` unbenutzt und die CSS-Regel in `workspace.css` ist gelöscht (Folge aus #50).
  `.dashboard-name` bricht lange Namen per `overflow-wrap: anywhere`. Layout bei 375 px nicht im Browser geprüft.
- **2026-10-24 (Eyebrow entfernt, frontend#50):** Prop `eyebrow` und das `<p className="page-eyebrow">` sind vollständig aus
  `PageHeader` entfernt, die sieben Aufrufe (Profil, Freigaben, Deployments, Apps, Kurse, OpenStack-Credentials, Hilfe)
  angepasst, ungenutzter Schlüssel `UserView.settings.title` in de/en gelöscht. Die CSS-Regel `.page-eyebrow` in
  `workspace.css` bleibt bewusst stehen: `DashboardView` nutzt die Klasse noch (Begrüßung, eigenes Issue); beim Dashboard-Issue
  mit löschen. `.auth-eyebrow` im Login-Hero ist unberührt.
- **2026-10-24 (Admin-Ansicht, frontend#49):** Neue Seite `/admin/settings` (`AdminSettingsView`, nur Admins, Nav-Eintrag
  „Admin-Einstellungen" immer sichtbar) mit Schalter „Admin-Ansicht" (Standard aus). Zustand in
  `src/stores/admin-view.store.ts` (Zustand `persist`, Schlüssel `appstore.adminView`, pro `userId`, kein Backend).
  `useRole()` liefert `isAdminView` (`isAdmin` und Schalter an), `<RoleGate adminView>` ist dafür ergänzt. Die Folge-Issues
  („Empfohlen"-Filter, Version festlegen) steuern ihre Admin-Elemente darüber. Bestehende Admin-Funktionen (Freigaben,
  Sichtbarkeitsfilter, Bearbeiten/Löschen) bleiben bewusst unabhängig vom Schalter. Hinweis: `routes.spec.tsx` mockt
  `auth.store` ohne `selectUserId`; die View liest die `userId` deshalb per Inline-Selektor.
- **2026-10-23 (Pods/K8s in React, frontend#36):** `spike/vue-pods` (Linux-Apps als Pods, ein Credential pro
  OpenStack-Projekt, nginx als API-Gateway) ist auf `spike/react-pods` portiert. Vertrag: OpenAPI aus Backend
  `spike/dev` (`794e9db`), byte-identisch zur Vue-Fassung (`tests/unit/contract`). Rechte auf der Deployment-Seite
  kommen aus `permissions`/`actions` der API, Zugangsdaten nur aus `/my-access` an die eigene Zeile (per `userId`).
  Studierende werden im Wizard per `userId` adressiert. Namen in Bestätigungen laufen über `BoldSlot` (Text), raw HTML
  nur mit begründeter ESLint-Ausnahme. Rollout auf das k8s-Staging für React nur per `workflow_dispatch`, bis der
  Vue-Trigger beim Cutover entfällt.

- **2026-10-23 (Fachbereichs-Filter im App-Katalog, frontend#34):** Die generischen Kategorie-Tabs
  (Produktivität/Entwicklung/Daten & KI/Weitere) in `AppsView.tsx` sind durch Fachbereiche ersetzt
  (Maschinenbau, Informatik, Elektrotechnik, Wirtschaftsingenieurwesen, Fächerübergreifend; immer
  genau ein Tab aktiv, Favoriten bleiben). Die Zuordnung steht zentral in
  `src/config/department-catalog.ts`: kuratierte Tabelle `APP_DEPARTMENTS`, geschlüsselt über
  normalisierte `git_link`-Aliasse (exakter Vergleich, **kein** Regex-/Keyword-/Repo-Name-Matching).
  **Neue App aufnehmen = Eintrag in `APP_DEPARTMENTS` ergänzen**, sonst erscheint sie nur unter
  „Alle“. `appPresentation()` liefert nur noch Logo/Icon (Feld `category` entfernt). Keine Backend-
  oder DB-Änderung. **Offen, bewusst nicht Teil von #34:** Die Beschreibungen in der Datenbank haben
  Mängel (Korrekturvorschläge im Anhang von Issue #34, u. a. Ubuntu-Version, Einsatzhinweise,
  Klartext-Passwort in pgAdmin); die Datenkorrektur erfolgt gesondert und nur nach Freigabe. Nach dem
  Staging-Deploy prüfen, ob alle Apps aus `GET /apps/` über ihren `git_link` zugeordnet werden.
  **Abweichung vom Skill:** Branch von `origin/dev` statt `main`, da `main` hier 30 Commits hinter
  dem React-Stand auf `dev` liegt. `node_modules` war veraltet (Vue-Stand) → `npm ci` nötig.
- **2026-09-28 (T3-Redesign, frontend#21):** Drei-Phasen-Redesign auf einem Feature-Branch, ein
  finaler PR gegen `dev`. **Phase 1:** `src/styles/tokens.css` (Radius/Shadow/Spacing/Typografie,
  theme-unabhängig), Tailwind-Bindung dafür in `tailwind.config.js`, Allowlist-Guardrail gegen
  arbitrary Radius/Shadow-Werte, kontextbezogene WCAG-Kontrastprüfung für Status-Farben
  (`tests/unit/styles/contrast.helper.ts`), `t3` as the canonical and default theme,
  in `src/theme/index.ts`, `resolveTheme()`-Fallback jetzt `t3` for missing and unknown selections). **Phase 2:**
  `BaseButton` (primary/secondary/outline/text/destructive), `BaseInput`-Fokusring auf
  `primaryAction`, `Card`/`Toast`/`EntityListState` auf Radius/Shadow-Tokens, `Badge` konsolidiert
  (neutral/success/warning/danger/info/brand + `bordered`), `ScopeBadge`/`AppVersionStatusBadge`
  jetzt dünne Wrapper, `useOverlay.ts` (Focus-Trap/Escape/Scroll-Lock/Fokus-Rückgabe) aus `Modal.vue`
  extrahiert, neue `Drawer.vue` darauf aufgebaut, `AppLayout.vue` in `AppSidebar.vue`/`AppHeader.vue`
  aufgeteilt (Sidebar jetzt hell mit Primary-Akzent nur auf Aktiv-Item, `Drawer`-basierter
  Mobile-Modus < 768px, `.header-title` `position: fixed` durch Flex-Layout ersetzt). **Phase 3:**
  alle Views im Scope (Login bis Forbidden/Empty/Loading/Error) von rohen Tailwind-Paletten-Klassen
  auf die Farb-Tokens migriert, Fachverhalten unverändert. **Abweichungen vom Spec:** `useOverlay`
  war komplett neue Funktionalität (Modal hatte vorher keinen Focus-Trap/Escape/Scroll-Lock, nichts
  zum "Extrahieren"); `InfrastructureVmDrawer.vue`/`OpenStackResourcePicker.vue` bewusst nicht auf
  `Drawer`/`useOverlay` umgebaut (strukturell kein Overlay, nur Token-Migration); einige
  Nicht-Marken-Farbstellen (Quota-Balken in `useQuotas.ts`, JSON-Viewer-Syntax-Highlighting in
  `json-view.ts`, vereinzelte Status-Punkte) bleiben auf rohen Tailwind-Farben, da sie
  Werttyp-/Zustands-Unterscheidung statt Markenfarbe transportieren. Details:
  `claude_docs/decisions/2026-white-label-theming.md`.
- **2026-09-26 (White-Label-Theming, frontend#18):** `src/theme/` (Typen, Registry, `default` + `t3` as the canonical and default theme,
- **2026-09-24 (CSS-Farbvariablen, frontend#13):** Alle Farben zentral in `src/styles/colors.css` (RGB-Kanäle), `tailwind.config.js` referenziert sie via `rgb(var(--color-…) / <alpha-value>)`; Guard-Test `tests/unit/styles/colors.spec.ts` verhindert neue Literale. Tailwind-`white` bleibt unberührt (Token `on-dark`).
- **2026-09-18 (Harness 2-Flow Reengineering):** `ci.yml` auf `dev`-Trunk umgestellt; Test Coverage Gate für `main` eingeführt; `CLAUDE.md` und `HANDOVER.md` standardisiert.
- **2026-09-17:** Security Audit Fixes (js-yaml, nanoid) über PR #3 gemergt.
