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
- [x] Typensichere API-Client-Integration mit generierten Typen (`api.generated.ts`) weitgehend umgesetzt (#86, #87).
- [x] Pods/K8s-Frontend (frontend#36): Cutover vollzogen (siehe `claude_docs/decisions/2026-react-pods.md`).
- [ ] Barrierefreiheit / a11y (Epic #139, #154 Phase 2 & 3): klickbare Karten/Zeilen Tastaturzugänglichkeit, Fokus nach Schließen von Toasts.

---

## 3. Bekannte Fallstricke & Blocker

1. **Typensicherheit:** `tsc -b` schlägt bei fehlerhaften Typen im CI Build fehl; Typen vor dem Commit immer lokal prüfen.
2. **Coverage Gate:** Der Job `🧪 Test` in `ci.yml` verlangt auf **jedem** Branch und PR mindestens 80,0 % Zeilen (`MIN_COVERAGE`,
   Metrik `total.lines.pct`) **und** mindestens 80,0 % Branches (`MIN_BRANCH_COVERAGE`, Metrik `total.branches.pct`); beide Werte
   müssen gelten. Die Linux-CI misst auf `dev` ca. 94,5 % Zeilen und 88,4 % Branches. Jeden Wert immer mindestens 2 Punkte unter dem
   CI-Ist-Wert halten und `CLAUDE.md` mit anpassen.
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
8. **Node 25 und `localStorage`:** Node 25 legt ein globales `localStorage` ohne `setItem` an. `execArgv: ['--no-experimental-webstorage']`
   in `vitest.config.ts` (in Vitest 4 eine Top-Level-Option) entfernt es, `dev` läuft damit auf Node 25.9 ohne Patch grün; das Flag
   nicht entfernen. Zeigt lokal ein Typ- oder Testfehler, den die CI nicht zeigt, zuerst `npm ci` (eine veraltete `node_modules` mit
   Vitest 3.2.7 statt 4.1.12 hat das in frontend#134 vorgetäuscht).
9. **Lokaler Browser-Check:** Die Seed-Apps im Docker-Dev-Stack sind nicht deploybar (Version fehlt oder `appstore.yaml` ungültig,
   „Jetzt Deployen" gesperrt). Um den Assistenten zu erreichen, in der Seite nur `GET /apps/<id>/runtime` per `XMLHttpRequest`-Patch
   fälschen und danach ausschließlich per Klick navigieren (ein Neuladen verwirft den Patch). Nie „Deployen" im letzten Schritt klicken.

---

## 4. Letzte Übergaben (Historie)

- **2026-10-29 (Epic #139, integrierter Stand auf `dev` 57bfa2a, auf Staging ausgerollt):** gemergt sind #162, #164 (a11y Phase 2 und 3), #165 (Hygiene), #167 (`Task.logs`), #168 (releaseTag, assignments), #169 (Sprachen lazy), #170 (Auth-Randfälle), #171 (Hooks Teil 1), #172 (REST-Guard App-Detail), #173 (Testkonvention, Factories). Gemessen auf dem gemeinsamen Stand: 2366 Tests grün, Coverage 94,98 % Zeilen / 89,34 % Branches (Gate je 85 %), Lint 0/0, `tsc -b`, Build grün.

  | Issue | Stand | Rest |
  |---|---|---|
  | #140, #141 | erledigt | – |
  | #154 | Code erledigt, Tastatur und Toast in echtem Chrome geprüft (gemockte API) | **Screenreader-Abnahme (NVDA/JAWS/VoiceOver) nicht durchgeführt**; Tastaturalternative zum Ziehen (eigenes Issue, falls gewünscht) |
  | #142 | Teil 1 (15 → 11 Disables) | `useUserSearch`, `useDeploymentRuntime`, Eintrittsladeeffekte; 4 in `useDeploymentDetail` mit #146 |
  | #143 | Teil 1 (App-Detail, Risikoliste in `claude_docs/decisions/2026-rest-validierung-risikoliste.md`) | Task/Logs, `StoredUserInput`, Deployment-Detail |
  | #144 | Punkte 1, 2 behoben, übrige begründet belassen (PR #168) | #118 abhaken |
  | #145 | erledigt (Backend gelesen, kein Objekt-Log) | #120 Teil 1 abhaken; Teil 2 in #143 |
  | #146 | nicht begonnen | nach #142/#143 |
  | #147 | 3 von 4 behoben, 1 begründet belassen | echter Login-/Refresh-Pfad nicht mit Zugangsdaten geprüft |
  | #148 | Sprachen lazy (Erststart -13,1 kB gzip) | `manualChunks` ungemessen |
  | #149 | Teil 1 (Konvention, Factories) | E2E-Freigabe, `as any` schrittweise |
  | #150 | erledigt soweit belegt | Branch-Entscheidungen, `js-yaml` mit Linux-npm entfernen |

  **Browserprüfung (Chrome, automatisiert):** Sprachen auf Staging (DE/EN-Start, Wechsel, Reload, gesperrter Sprach-Chunk mit Rückfall auf die andere Sprache, beide gesperrt: App startet mit Schlüsseln statt leerer Seite); `returnUrl`-Validierung auf Staging bis zur Weiterleitung an Keycloak; Karten, Leertaste/Enter und Toast (Pause bei Fokus, Fokusrückgabe, Auto-Ende) lokal mit gemockter API. **Nicht geprüft:** Login mit echtem Konto, 401-Retry gegen echtes Keycloak (alle 401 des Backends kommen aus der Token-Prüfung vor dem Handler, `backend/app/utils/keycloak_auth.py`, daher ist die Wiederholung auch für POST sicher), Screenreader.
  **Die Browserprüfung fand einen Fehler, den die Unit-Tests nicht fanden:** Login-Seite und Profil schalteten die Sprache direkt um und zeigten Schlüssel, bis die Datei geladen war. Seitdem schaltet nur `switchLocale` um (Guard-Spec `no-direct-switch`).
  **Sicherheitsbranches:** `fix/lti-one-time-code` und `fix/safe-links-and-deactivated-app` sind per `git patch-id` identisch mit den gemergten PRs #48 und #47; es fehlt nichts. Die Branches sind veraltet und können mit Freigabe gelöscht werden (nicht gelöscht).
  **Fallen:** Issue-Nummern wie `#144` in `src` (auch Tests) schlagen `colors.spec.ts` an (Hex-Farbe), "issue 144" schreiben; `colors.spec.ts` läuft unter Last gelegentlich in das 5-s-Timeout (einzeln grün); `npm uninstall` unter Windows verwirft `libc`-Felder im Lockfile; ein laufender `vite`-Prozess blockiert `npm ci` (EPERM auf die Rollup-Binärdatei); ein globales Registrieren der App-i18n in `tests/setup.ts` bricht die Key-Echo-Specs (stattdessen der Alias `@/i18n` in `vitest.config.ts`).

- **2026-10-29 (Übersicht nennt die App, „App nicht gefunden" behoben; Folge von #133 und #136):** Die Übersicht zeigte bei jeder App „App nicht gefunden für n Personen"
  (auf Staging bei pgAdmin, Web-LaTeX und windows-matlab-app gesehen). **Ursache:** sie suchte die App in `useAppStore.apps`, und diese Liste füllt nur `fetchApps()`; der Katalog (`AppsView`) hält seine Liste
  lokal, auf dem Weg „Katalog, Details, Deployen, Assistent" ist sie also leer. Bei Apps mit Variablen war das schon immer so; bei Apps **ohne** Variablen füllte früher der Übersichts-Hook (`useSummaryVariables`) die Liste nebenbei,
  weil ein leerer Cache als „nicht geladen" galt: seit #133 gilt `[]` als geladen, der Aufruf entfiel. **Behebung:** `useDraftApp()` (`src/views/new-deployment/useDraftApp.ts`) nimmt die App aus der Liste, sonst aus
  `currentApp` (wenn es die des Entwurfs ist), sonst fragt es **einmal** `fetchAppById(appId)` und meldet `isLoading`, bis die Antwort da ist. Die Übersicht zeigt bis dahin das Skelett (und „Deployen" ist gesperrt) statt kurz „App nicht gefunden";
  der Hinweis erscheint nur noch, wenn auch das Backend die App nicht kennt. Der Aufruf lädt nur diese App, nicht den ganzen Katalog (Bilder). `useAppStore.apps` bleibt ungefüllt: wer die Liste braucht, ruft `fetchApps()` auf.
  **Nicht geändert:** `NewDeploymentGroupsAssignmentView` liest `draftAppDetails()` weiter aus der Liste; es ist ohne Wirkung, weil `useDeploymentConstraints` den Parameter (`_app`) ignoriert (Aufräumkandidat, auch `draftAppDetails` im Store).
  **Tests:** `useDraftApp.test.tsx` (7), neue Fälle in `NewDeploymentSummaryView.spec` (Liste leer, Skelett, erst nach der Einzelabfrage „nicht gefunden", Bild) und im Durchlauf (`variablesStepFlow.spec`: `appApi.getById` einmal). Mutationsprobe
  (Hook fragt nie): 9 Tests in 3 Dateien schlagen fehl. **Fallstricke:** Specs der Übersicht brauchen `fetchAppById` als Mock (Netzwerk-Guard), wenn die Liste leer ist; mit echter Übersetzung heißt der Button „Deployen" statt `deployment.actions.deploy`.
- **2026-10-29 (Doku gegen den Code abgeglichen, Branch `docs/update-frontend-docs`):** `origin/dev` ist in den Doku-Branch gemergt (zuerst `e232c21`, Branch-Coverage-Gate #158; danach `bc9ed09`, Gate auf 80 % gesenkt, PR #175). Beim zweiten Merge kollidierten `CLAUDE.md` und dieses Dokument: in `CLAUDE.md` gilt das Gate von `dev` (80 % Zeilen **und** 80 % Branches) und `npm run gen:api-types` (das Skript `openapi:generate` gibt es nicht), in diesem Dokument stehen die Einträge von `dev` vor diesem. Der Ordner `docs/architecture/` ist aus dem Branch entfernt; die Verweise in `CLAUDE.md` und `README.md` sind entfernt, ältere Einträge unten nennen ihn als Momentaufnahme weiter. Alle Frontend-Dokumente wurden gegen den Code gelesen: **README** (Code-Struktur um `env.ts`, `silent-refresh.ts`, `config/`, `styles/` ergänzt; `router/index.ts` heißt `index.tsx`; es gibt keine Stores/APIs `team`, `user`, `credentials`, vorhanden sind `app`, `auth`, `course`, `deployment`, `admin-view`, `toast` bzw. `app`, `course`, `dashboard`, `deployment`, `task`, `user`; Wizard-Beschreibung, Tests, Gate und Links ergänzt), **CLAUDE.md** (Werkzeug-Skip der Entrypoint-Tests, Lint, Netzwerk-Guard, Doku-Verweise), **docs/routing-and-access.md** (`skipVariablesStep`, vierter Parameter von `guarded`, Rollenbeschreibung, `canChangeUserRole`, Wizard-Zeilen der Routentabelle), **docs/i18n.md** (Plural, Fallback-Richtung, `STATUS_ELLIPSIS`/`STATUS_TOASTS` genau, `locale`-Schlüssel), **docs/themes.md** (`env.ts`, `useTheme`, Guard-Tests), **.github/copilot-instructions.md** (Wizard-Schritt 1 enthält Name und Teilnehmende, nicht Version/Beschreibung/Dauer; Schritte 3 und 4; Branch-Gate) (die Architektur-Doku `docs/architecture/architecture.md` war ebenfalls abgeglichen, wurde danach aber gelöscht). **Bewusst nicht neu geprüft:** Umgebungsstand und Image-Pins (Architektur 1.1/2.6), alles zu self-service-ui und die Befunde B9 bis B13. **Lehre:** Zahlen in einer Architektur-Doku driften mit jedem `dev`-Commit (Dateien 166 → 182, Tests 131 → 169 in drei Tagen); beim nächsten Abgleich zuerst die Zählung wiederholen (`find src tests`, Import-Kanten per Skript). Die deployment-Makefile-Targets der README (`dev-up`, `dev-restart-frontend`, `shell-frontend`) gibt es auf `origin/dev` und `origin/main`; auf dem lokalen Branch `feat/local-k8s-dev` des deployment-Repos fehlen sie, das ist ein offener Umbau und noch nicht Stand von `dev`.
- **2026-10-29 (Zusammenfassung, Schritt 4: ein Satz, drei ruhige Karten, frontend#136):** `NewDeploymentSummaryView` zeigt statt dreier Pastellkästen drei weiße Karten:
  **Das wird gestartet** (`SummaryHero`: Satz „{App} für {n} Personen", `Deployment „{Name}"`, Typenschild Version und Laufzeit; `data-testid="summary-runtime"` bleibt),
  **Teilnehmende** (`SummaryParticipants`: Modus-Chip, ein Satz je Modus und Umgebung/Desktop, eine Leiste; bei „Jeder Nutzer einzeln" nur Personen, sonst Teams mit Mitgliedern)
  und **Variablen-Konfiguration** (`SummarySettings`, `<dl>`), die es **nur gibt, wenn `buildSettingsRows(...)` mindestens eine Zeile liefert**. Titel „Zusammenfassung";
  Skelett (`SummarySkeleton`, `aria-busy`) statt Spinner; jede Karte hat „Bearbeiten" mit Ziel `paths.deploymentConfig`/`deploymentTeams`/`deploymentVariables` und `aria-label` des Ziels
  (mobil nur der Stift, 34 px). **Zeilenlogik** rein in `summaryRows.ts`: Rechenressourcen (`resourceChoices`; „Empfohlen"/„Angepasst"; Summe „insgesamt für n Personen" nur bei `scope: 'user'`
  **und** mehr als einer Person), Internetzugriff und Vernetzte Desktops/Pods aus `visibleNetworkKeys` (**auch im Standardfall**, nicht nur bei Abweichung), je Datei-Variable eine Zeile (auch ohne Datei:
  „Keine Datei ausgewählt."; eine Datei für alle: „starter.zip · 640 KB · gilt für alle n Personen"; sonst „k Dateien · x MB" mit Leiste) und je Text-/Auswahl-Variable eine Zeile (je Team eine Zeile).
  Zeilen tragen Daten, keine Sätze (die Komponenten übersetzen); Dateien nur mit Name und Größe, nie mit Inhalt. **Eine Frage, eine Antwort (Zusammenspiel mit #133):** ein Test
  (`summaryRows.test.ts`, „…answer the same question…") belegt für die App-Typen A bis D, dass die Karte genau dann da ist, wenn `needsVariablesStep(draft) === true`. **Geteilte Leiste:**
  `RecipientRail` (+ `.css`) ist aus `FileRecipients` (#113) herausgelöst; Klassen heißen jetzt `rail-row`/`rail-node`/`rail-row__right` (vorher `fv-*`), `FileRecipients` und seine Tests sind unverändert;
  `sameFile` steht jetzt in `recipientRows.ts`. **Entscheidungen 5 bis 7 des Issues wie empfohlen umgesetzt** (Netzwerk immer zeigen, Titel „Zusammenfassung", optionale Datei ohne Auswahl als Zeile).
  **Abweichungen vom Issue (bewusst):** (1) `buildFileSummaries` wurde **nicht** erweitert: die Dateizeile liest Empfänger (`buildRecipients`) und `draft.fileUploads` direkt, damit „für alle" dieselbe Regel hat wie die Datei-Karte
  in Schritt 3. Damit sind `buildFileSummaries`, `buildTerraformEntries`, `toSummaryEntry` und `SummaryEntry` in `summary.ts` im Produktivcode **ungenutzt** (nur ihre Tests): Kandidaten zum Entfernen. (2) Die Folgezeile des Internetzugriffs
  nutzt auch bei Pod-Apps die neutralen Texte `deployment.vm.internet.noteOn/noteOff` (der Pod-Text „… können **dann** …" passt zum Schalter, nicht zur Zusammenfassung). (3) Die Summe fehlt bei einer einzigen Person. (4) Das Skelett zeigt immer drei Karten
  (vorher unbekannt, ob die dritte kommt). **Alte Texte entfernt** (`baseConfigTitle`, `deploymentNameLabel`, `selectedStudents`, `teamAssignmentTitle`, `teamCountLabel`, `modeLabel`, `submittedValue`, `uploadedFiles`, `scope`, `noFileUploaded`); neu unter
  `deployment.summary.{hero,participants,counts,rows,edit}` (Plural mit `_one`/`_other` und `{count}`). **Offener Punkt „Rücksprung" des Issues geprüft:** Schritt 1 setzt beim Ändern der Auswahl **nichts** zurück
  (`applyStudentIds` schreibt nur `studentIds`/`courseIds`); entfernte Studierende bleiben in `draft.assignments`, „Weiter" bleibt aktiv und `buildDeploymentPayload` schickt sie mit (Probe: `studentIds [u1,u2]`, `assignments [[u1,u2,u3]]` ergibt
  `teams[0].userIds` mit `u3`). Das gab es schon vorher (über „Zurück" bis Schritt 1), das neue „Bearbeiten" macht den Weg kürzer. **Nicht in #136 behoben** (Schritt 1 bis 3 bleiben laut Issue), eigene Aufgabe vorgeschlagen.
  **Fallstricke:** (1) Der Deployment-Name steht über `BoldSlot` im Satz: mit dem Schlüssel-Echo-i18n der Specs ist er **kein** Text, als „geladen"-Kennzeichen taugt `data-testid="summary-hero"`; die Texte prüfen die Tests mit `realI18n`. (2) Der Farb-Wächter
  (`colors.spec.ts`) liest `#133` in einem Testtitel als Hex-Farbe: in Tests unter `src/**/__tests__/` keine `#<Zahl>`. (3) Ein Test mit nie endender Anfrage lässt den geteilten Lader (`variableDefinitions.ts`) für den nächsten Test mit derselben App hängen: am Testende auflösen.
  (4) Der Seed der Summary-Spec nutzt eine Datei-Variable mit `osScope: 'all'` und dem Slot `all` (vorher `user`/`u1`: passt nicht zu den Empfänger-Slots `Team-Username`). **Sichtprüfung:** die drei Karten in einer Wegwerf-Harness mit echten Komponenten bei Desktop-Breite und 375 px
  (kein horizontales Scrollen, Stift 34 px, Leiste und Typenschild gestapelt); **Staging-Prüfung nach dem Merge**, siehe PR.
- **2026-10-29 (Schritt „Variablen" entfällt, wenn die App nichts einzustellen hat, frontend#133):** Der Assistent zeigt den Schritt 3 nur noch, wenn
  `needsVariablesStep(draft)` (`src/views/new-deployment/variablesStep.ts`) nicht `false` ist: die App hat Variablen-Definitionen, `resourceChoices` oder ein sichtbares
  Netzwerk (`visibleNetworkKeys`). `null` heißt „noch nicht bekannt". Sonst: Leiste mit 3 Schritten (`DeploymentProgressBar` bekommt `showVariablesStep`, Anzeigenummern
  1 bis 3, `currentStep` bleibt die logische Nummer), „Weiter" in Schritt 2 führt nach `/deployment/new/summary`, „Zurück" in der Übersicht nach `/deployment/new/teams`, die Karte
  „3 — variables" fehlt, `/deployment/new/variables` leitet per `replace` nach `/teams` (Guard `skipVariablesStep` in `router/guards.ts`, vierter Parameter von `guarded`).
  **Zustand:** `defaultDraft.variableDefinitions` ist jetzt `undefined` (nicht geladen); `[]` heißt „geladen, leer". `useVariableForm` und `useSummaryVariables` prüfen
  `!== undefined` statt `.length > 0`, eine App ohne Variablen wird pro Entwurf also nur einmal beim Backend abgefragt. **Laden:** `ensureVariableDefinitions()`
  (`variableDefinitions.ts`) holt, bereinigt (`dedupeVariables`) und schreibt die Definitionen, fasst parallele Aufrufe zu einer Anfrage zusammen (modulweiter Merker
  je App und Version, 30 s Axios-Timeout) und schreibt nur in den Entwurf, der noch zu App und Version passt und nichts hat. Schritt 1 stößt es beim Betreten an
  (Fehler verschluckt), Schritt 2 ebenfalls; `resolveNeedsVariablesStep()` lässt „Weiter" auf die Antwort warten (Ladeanzeige, `aria-busy`, nicht doppelt klickbar,
  kein Sprung mehr, wenn die Ansicht verlassen wurde) und liefert bei Ladefehler `null`: der Schritt wird dann **nicht** übersprungen. Gesendet wird unverändert
  (Test: `variablesStep.payload.spec.tsx` vergleicht die Nutzlast mit und ohne Besuch von Schritt 3). **Abweichungen vom Issue (bewusst):** (1) `needsVariablesStep`
  liefert `true`, sobald Auswahl oder Netzwerk den Schritt belegen, auch wenn die Definitionen noch fehlen: VM-Apps warten in Schritt 2 nicht auf das Backend.
  (2) Die Variablen-Ansicht selbst übergibt `showVariablesStep` nicht (sie ist der Schritt, die Leiste bleibt vierteilig). (3) Der Variablen-Schritt entscheidet beim
  Betreten nach „gespeicherte Werte in `draft.variables`" statt nach „Definitionen im Cache": ohne gespeicherte Werte läuft auch mit vorgeladenen Definitionen
  `initialFromFetch`, nicht `restoreFromDraft`. Sonst bekäme ein Pflicht-Bool ohne Default `''` statt `false` und „Weiter" wäre gesperrt. (4) `useSummaryVariables` behält die
  Prüfung gegen die App-Liste (Charakterisierungstest). **Bestehende Tests angepasst:** Seeds, die `variableDefinitions: []` für „nicht geladen" nutzten, nutzen
  `undefined` (`NewDeploymentSummaryView.spec` 2, `NewDeploymentVariables.characterization.spec` Seed und 2 Erwartungen: nach einem Ladefehler bleibt der Wert `undefined`);
  die Erwartungen zum Verhalten sind unverändert. **Fallstricke:** (1) Ein Test, der eine Anfrage nie beendet (`new Promise(() => {})`), lässt den modulweiten Merker
  stehen und der nächste Test teilt sich die hängende Anfrage: offene Antworten am Testende auflösen (`deferred` in `NewDeploymentGroupsAssignmentView.spec`).
  (2) Schritt 1 und 2 laden jetzt beim Betreten: Specs dieser Ansichten mit `appId` im Entwurf brauchen einen Mock für `fetchAppVariables` bzw. `appApi.getVariables`
  (Netzwerk-Guard). (3) `npm ci` nach dem Branch-Wechsel, sonst fehlt `eslint-plugin-jsx-a11y` (aus #153). **Nicht im lokalen Browser geprüft** (`npm run dev` braucht den
  Docker-Stack und einen Keycloak-Login); Prüfung auf Staging nach dem Merge, Ergebnis in der PR.
- **2026-10-29 (Schritt „Variablen“ schickt keine Slots von Teams und Personen mehr mit, die es nicht mehr gibt):** „Weiter“ in Schritt 3 (`next()` in
  `useVariableForm.ts`) entfernt jetzt aus `draft.variables`/`userInputVar` und aus `draft.fileUploads` alle Slots, die die aktuellen Teams nicht (mehr) enthalten: abgewählte
  Person (Schritt 1), umbenanntes, gelöschtes Team, Person in ein anderes Team verschoben (Schritt 2). **Ursache:** `dropStaleSlots` lief nur, wenn sich die Teams änderten,
  *während* der Schritt offen war; `restoreFromDraft`/`seedScopedDefault` und `buildDraftValues`/`cleanScopedMap` behalten fremde Schlüssel, `fileUploads` wurde nirgends bereinigt.
  Beim Zurückkommen standen alte Slots deshalb unsichtbar im Entwurf und in der Nutzlast (`userInputVar.terraform.<var>`, `files.<var>`). **Backend** (`app/services/deployment_input.py`,
  `validate_scoped_user_input`): ein `team`-Slot ohne Team und ein `Team-Person`-Slot ohne Team (Variable und Datei) ergeben 422 `unknown_scope_target` (das Frontend kennt den Grund nicht und
  zeigt nur „Request failed with status code 422“); der Slot einer Person in einem Team, das es noch gibt, wird nicht geprüft (nur das Team-Präfix; eine Mitgliederliste hat die Prüfung nicht) und geht weiter an Terraform.
  **Neu in `variableForm.ts`:** `fileSlotKeysFor` (Scope `all` → `['all']`, sonst `slotKeysFor`; ein Test vergleicht es für alle Scopes und Teamformen mit den Zeilen-Ids von `buildRecipients`,
  damit die Karte und die Bereinigung nicht auseinanderlaufen) und `dropStaleFileSlots` (wie `dropStaleSlots`: gleiches Objekt zurück, wenn nichts fällt; die Map einer Variablen bleibt leer stehen,
  die Nutzlast lässt leere Einträge aus). `next()` schreibt `fileUploads` nur, wenn etwas fiel. **Entscheidungen:** (1) *Wo:* beim Verlassen, nicht beim Betreten und nicht in der Nutzlast. Dort sind die
  Schlüssel genau die, die die Karten eben gezeigt haben, es geht also nie etwas verloren, was die Person sehen konnte. Beim Betreten käme der Schlüssel (`Team-Benutzername`, Benutzername aus
  `studentCache`, sonst E-Mail-Teil, Vorname, `userId.slice(0, 8)`) aus einem Cache, der seit dem Speichern Einträge ersetzt haben kann (`mergeIntoCache` tauscht, wenn Vor-/Nachname dazukommen); ein
  anders gelesener Schlüssel würde einen gültigen Wert unsichtbar und unwiederbringlich löschen. Das Backend führt `username` als Pflichtfeld, der Fallback greift praktisch nie, ist aber
  der Grund, den Eintritt nicht anzufassen (der Kommentar „restoring previously saved slots on entry is left untouched“ gilt weiter). `buildDeploymentPayload` kennt nur den Entwurf, nicht den Cache,
  und könnte Benutzer-Slots gar nicht prüfen; die Übersicht würde außerdem Slots zeigen, die nicht gesendet werden. (2) Kein Hinweis-Toast beim Verlassen: die Slots waren nicht zu sehen. Der bestehende
  `teamRenameToast` (Teams ändern sich bei offenem Schritt) bleibt unverändert. **Tests:** `tests/unit/views/NewDeploymentVariables.staleSlots.spec.tsx` (echte Ansicht, Entwurf mit den Slots der
  Probe aus PR 159 plus Umbenennen, Löschen, Verschieben, alle Teams ersetzt, nichts Veraltetes, Eingabe bleibt; prüft `variables`, `userInputVar`, `fileUploads` und `buildDeploymentPayload`),
  `variableForm.test.ts` (`fileSlotKeysFor`, `dropStaleFileSlots`), `recipientRows.test.ts` (Gleichlauf mit `buildRecipients`); gegen den `dev`-Stand sind 7 der 8 Ansichtsfälle rot, der
  achte („Teams wie vorher, nichts geht verloren“) schützt vor zu viel Löschen. **Grenzen:** (a) Nur der Weg über „Weiter“ in Schritt 3 bereinigt. Wer Schritt 2 per Browser-Zurück ändert und per
  Browser-Vor durch Schritt 3 zur Übersicht springt, umgeht es (Übersicht zeigt die Slots dann sichtbar). (b) `bytesOf` in `NewDeploymentVariableView` zählt beim Betreten auch verwaiste Dateien
  anderer Datei-Variablen zur Gesamtgröße; spürbar erst bei einer App mit zwei Datei-Variablen (heute hat jede App eine). (c) `fileUploads`-Einträge zu Variablen, die der App fehlen, bleiben
  unberührt (nur Slots bekannter Datei-Variablen werden geprüft). Der offene Punkt „Schritt 3“ im Eintrag zu Abgewählten Studierenden (PR 159) ist damit erledigt. **Nicht im Browser geprüft.**
- **2026-10-29 (Zurück zur Übersicht führt fest nach `/apps`, frontend#134):** `AppsDetailView.tsx` navigiert mit
  `navigate(paths.apps)` statt `navigate(-1)`. Ursache: „Zurück" im Assistenten **fügt** einen Verlaufseintrag hinzu
  (`/apps/<id>` → `/deployment/new/config` → `/apps/<id>`), `navigate(-1)` landete deshalb wieder im Assistenten; bei einem Deep Link
  gab es keinen Vorgänger. `NewDeploymentConfigView.handleBack` bleibt unverändert (kein `navigate(-1)`, wegen Deep Links).
  **Tests:** neue Datei `tests/unit/router/wizard-back-navigation.spec.tsx` (echte Routen und Views, `createMemoryRouter(appRoutes, …)`:
  Vollablauf mit Assistent, ohne Assistent, Deep Link) und zwei neue Fälle in `AppsDetailView.spec.tsx`. Gegen den ungefixten
  `dev`-Stand sind 4 Fälle rot (der Fall ohne Assistent war schon grün). **Browser:** lokal geprüft (Docker-Dev-Stack, Admin): ohne
  Assistent, mit Assistent (2×) und per Deep Link endet „Zurück zur Übersicht" auf `/apps`. **Nicht geändert:** `tests/setup.ts` und
  `vitest.config.ts` (siehe Fallstrick 8).
- **2026-10-28 (Deployments-Liste ohne Version und Laufzeit, Nachtrag zu frontend#56):** Auf `/deployments` stehen Version
  (`releaseTag`) und Laufzeit-Badge (`runtime-badge`, PODS/VM) einer Karte nur noch in `<RoleGate adminView>`: Dozenten,
  Studierende und Admins ohne Admin-Ansicht sehen sie nicht. Name, App, Status und Datum bleiben; das Datum trägt `ml-auto` und
  steht ohne die linke Gruppe weiter rechts. Nur Oberfläche, keine neuen Texte. **Nicht geändert:** `DeploymentDetailView`
  zeigt weiter `releaseTag` und Laufzeit (eigener Nachtrag, falls gewünscht). Nicht im Browser geprüft (Tests prüfen DOM und
  Klasse).
- **2026-10-29 (Upload, Toast, Sichtbarkeit, frontend#154 Phase 1, Teil von Epic #139):** **Bild-Upload** (`LogoPicker`,
  `EditAppModal`): der Datei-Input ist `sr-only` statt `display: none`, liegt in einem `<label>` (Klickziel, Fokus per Tab,
  Enter/Leertaste öffnen den Dialog nativ) und wird über die Zeilenbeschriftung benannt (`aria-labelledby`, `FormRow labelId`;
  ohne Zeilenlabel `aria-label`); Hinweis bzw. Dateiname ist die Beschreibung. „Entfernen“ ist ein Geschwister des Labels, kein
  verschachtelter Button; die Drop-Zone behält ihre Drag-Handler, der Fokusring kommt über `has-[:focus-visible]`.
  **Toast:** Schließen-Button mit Namen (`toast.close`), Icons `aria-hidden`. Angesagt wird über zwei dauerhafte, anfangs
  leere `sr-only`-Regionen (`aria-live="polite"` für Erfolg/Info, `"assertive"` für Fehler/Warnung, ohne Rolle, damit sie nicht neben `RouteError` als Alert auftauchen; `aria-atomic="false"`,
  `aria-relevant="additions"`), die pro Meldung ein Kind bekommen. Grund: ein `role="status"`-Element, das samt Text neu
  eingefügt wird, wird nicht zuverlässig angesagt. Die sichtbaren Toasts tragen keine Live-Rolle (eine Ansage je Meldung); der
  Text steht deshalb zweimal im DOM, Tests fragen die sichtbare Meldung über `.toast-message` ab. Die Specs prüfen den
  DOM-Vertrag, **nicht** die tatsächliche Ansage: dafür bleibt eine Handprüfung mit NVDA/JAWS/VoiceOver nötig.
  Klick auf den Toast schließt weiterhin (Mausabkürzung; der Button ist der Tastaturweg), das ist beim Einschalten der Klick-Regeln
  (Phase 3) mit Begründung freizugeben. **Sichtbarkeit** (`AddAppsView`): `role="group"` mit der Zeilenbeschriftung als Namen,
  `aria-pressed` je Button (bewusst keine Radiogroup: Tab statt Pfeiltasten). Specs: `image-upload.a11y.spec.tsx`,
  `Toast.a11y.spec.tsx`, Abschnitt „Sichtbarkeit“ in `AddAppsView.spec.tsx`. **Offen (#154 Phase 2/3):** klickbare Karten/Zeilen,
  Klick-Regeln einschalten, Toast ohne Typ-Ansage im Text, Fokus nach Schließen eines Toasts (geht verloren), Toasts verschwinden auch bei Tastaturfokus nach 5 s.
- **2026-10-28 (Formular-Labels und jsx-a11y, frontend#141, Teil von Epic #139):** Felder ohne zugänglichen Namen sind verknüpft:
  `ReasonModal`, `SubmitVersionModal`, `EditAppModal`, `OverviewTab`, `NewDeploymentConfigView`, `AddAppsView` (über
  `FormRow htmlFor`) per `useId` + `htmlFor`; Suchfelder (`AddMembersModal`, Studierendensuche), `CourseNameEditor` und
  `TeamColumn` per `aria-label` (vorhandener Text, kein neuer Schlüssel); der Schalter in `AdminAppsView` per
  `aria-labelledby`. `BaseInput` hat ein optionales `label` (rendert `<label htmlFor>` mit `useId`), `MarkdownEditor`
  nimmt `id`/`aria-label`/`aria-labelledby`/`aria-describedby` an. Neuer Schlüssel `CourseDetailView.addModal.removeSelected`.
  Umschließende Labels (UserView, Checkboxen im `AddMembersModal`, Bereichsregler im `ResourcePicker`) waren schon korrekt.
  **Lint:** `eslint-plugin-jsx-a11y` (`recommended`) für `src/**/*.tsx`; `package.json` braucht `overrides`, weil das Plugin
  ESLint 10 nicht als Peer führt (ohne: `npm ci` scheitert mit ERESOLVE; mit: läuft). Dass die Regeln feuern, prüft
  `tests/unit/infra/eslint-a11y.spec.ts` (Fixtures); bei jedem ESLint- oder Plugin-Update neu prüfen. Das Lockfile ist mit
  npm 11 (Node 24 wie die CI) erzeugt; npm 10 lässt die `libc`-Felder weg. Aus: `click-events-have-key-events`, `no-static-element-interactions`,
  `no-noninteractive-element-interactions` (23 Treffer an 12 Stellen, Folgeaufgabe frontend#154; eigenes Tastaturkonzept
  nötig). `label-has-associated-control` erkennt `<label>{t('…')}</label>` nicht; den Schutz leisten die `getByLabelText`-Specs
  (`tests/unit/components/form-labels.spec.tsx`). **Offen (frontend#154):** Bild-Upload in `EditAppModal`/`LogoPicker` (versteckter Input,
  Klick-Zone ohne Tastatur), Schließen-Button im `Toast` ohne Namen, klickbare Zeilen/Karten, Sichtbarkeits-Buttons in `AddAppsView`.
- **2026-10-28 (Modal und Drawer als Dialoge, frontend#140, Teil von Epic #139):** `Modal` und `Drawer` tragen jetzt `role="dialog"` und `aria-modal="true"`. **Name:** `Modal` verweist per `aria-labelledby` (`useId`) auf den sichtbaren Titelbereich (`header` vor `title` vor Fallback; eine uebergebene `<h2>` bleibt eine Ueberschrift im Namen); `Drawer` hat die neuen optionalen Props `label` (aria-label) und `labelledBy` (gewinnt), ohne beide einen lokalisierten Standardnamen (`dialog.panelLabel`); `AppSidebar` uebergibt `nav.mobileMenu`. **i18n:** neu `dialog.close`, `dialog.fallbackTitle`, `dialog.panelLabel`, `nav.mobileMenu` (de/en); im Code stehen die englischen Werte als `defaultValue`, damit Specs ohne I18n-Provider unveraendert bleiben (en-Fallbacktitel bleibt "Modal", de "Dialog"; kein Aufrufer nutzt den Fallback). **`useOverlay`:** nur eine belegte Aenderung: hat das Overlay nichts Fokussierbares, bekommt das Panel (`tabIndex=-1`, `focus:outline-none`) den Fokus und Tab wird abgefangen (vorher blieb der Fokus hinter dem Overlay, Tab verliess es). Escape, Fokusfalle, Scroll-Lock und Fokus-Rueckgabe sind unveraendert. **Bewusst nicht geaendert, als Test dokumentiert:** gestapelte Overlays schliessen alle bei Escape, und das innere setzt `body.overflow` beim Schliessen zurueck, obwohl das aeussere offen ist; im Code stapelt nichts. **Tests:** `overlay.characterization.spec.tsx` (Commit 1, gegen den alten Code gruen; nur die Faelle, die die Aenderung ausmacht, wurden umgestellt) und `dialog-a11y.spec.tsx`. **Grenzen:** `aria-modal` blendet den Hintergrund nur in Hilfstechnologien aus, die es umsetzen; der Hintergrund ist nicht `inert`. Modale Texte der Aufrufer (Labels der Formularfelder) gehoeren zu #141.
- **2026-10-28 (SSE-Events validieren, REST-Resynchronisierung, frontend#90, Teil von Epic #77, letztes offenes Issue):** **Funktionale Robustheitsverbesserung, kein reines Typ-Refactoring.** **Alt:** `handleEvent` castete Payloads ungeprueft (`data as ProgressEvent`); fehlte z. B. `progress_pct`, wurde `undefined` in den Zustand geschrieben, ein `iso_timestamp` mit falschem Typ brach erst im Render (`log.timestamp.split`). **Neu:** `src/composables/deploymentStreamEvents.ts` mit `parseSnapshot`, `parseProgress`, `parseLog` (Eingabe `unknown`, Ausgabe Typ oder `null`; die Event-Typen `LogEntry`/`ProgressEvent`/`SnapshotEvent` wohnen dort und werden aus `useDeploymentStream` weiter exportiert). **Geprueft werden nur gelesene Felder.** snapshot: nichts Pflicht (Deployment ohne Task sendet nur `null`); `status`/`current_phase` String, `progress_pct` endliche Zahl, jeweils `null`/fehlend = nicht gesendet (wird zu `null`, ein fehlendes Feld schreibt also nie `undefined`); `task_id`/`type` werden nicht gelesen und nicht geprueft. progress: `phase` (String), `phase_index`, `total_phases`, `progress_pct` (endliche Zahlen) Pflicht, `phase_names` optional (kein Array = ignoriert wie bisher, Array mit Nicht-String = Event ungueltig), alle anderen Felder (`message`, `iso_timestamp`, ...) egal. log: `level`, `message` (Strings) Pflicht; Zeit aus `iso_timestamp`, sonst `timestamp`, sonst jetzt (wie bisher), wenn vorhanden muss sie ein String sein; `tool`, `category` (String) und `streaming` (Boolean) optional, explizites `null` = nicht gesendet; alle weiteren Felder laufen unveraendert durch. **Ungueltig:** das Event wird verworfen (kein Teil-Update), `invalidEvents` (neues Zustandsfeld, bei `start()` auf 0) steigt, `console.warn` genau einmal je Eventtyp und Verbindung (Reconnect = neue Verbindung), nur mit Eventtyp, nie mit Payload. `succeeded`/`failed`/`revoked` lesen keine Payload und beenden den Stream wie bisher; unbekannte Eventtypen werden weder gezaehlt noch gemeldet. **Resync (`useDeploymentDetail.ts`):** steigt `invalidEvents` waehrend der Stream relevant (Owner-Ansicht, Task live) und `live` ist, laedt die View `fetchDeploymentById(deploymentId)` und `loadTasks()` neu, hoechstens einmal je 15 s (`RESYNC_MIN_INTERVAL_MS`, Zeitstempel in einem `ref`, Vorderflanke; weitere ungueltige Events im Fenster loesen nichts aus, auch nicht nachtraeglich). Kein Request bei gueltigen Events, ausserhalb von `live` (connecting/reconnecting/ended/error), nach Unmount, bei anderem `deploymentId`, solange ein Resync noch laeuft; eine verspaetete Antwort laedt keine Tasks mehr nach, wenn sich das inzwischen geaendert hat oder das Deployment weg ist (dann uebernimmt der bestehende `ended`-Pfad mit seinen Toasts/Navigation). Mitglieder haben keinen Stream und `loadTasks()` ueberspringt sie weiter: kein Owner-Endpunkt fuer sie. **Warum 15 s:** ein dauerhaft kaputtes Format kann pro Sekunde viele Events liefern; das Fenster haelt die Last auf `/deployments/{id}` und `/tasks` klein, die Anzeige bleibt trotzdem aktuell. **Entfernt:** die vier `any` in `useDeploymentStream.ts` (Index-Signatur von `LogEntry` ist `unknown`, `handleEvent(…, data: unknown)`, `raw`, `parseFrame`-Callback) samt ihrer `eslint-disable`/`TODO #90`-Zeilen; `parseFrame` selbst ist unveraendert (nur die Callback-Signatur). Unveraendert: Verbindungsaufbau, Authorization-Header, Keycloak, Backoff, Backend. **Tests:** `useDeploymentStream.characterization.test.ts` (31) und `useDeploymentDetail.stream.test.tsx` (9) liefen in Commit 1 gegen den alten Code, `useDeploymentStream.test.ts` ist unveraendert; neu `deploymentStreamEvents.test.ts` (59, Guards), `useDeploymentStream.validation.test.ts` (14), `useDeploymentDetail.resync.test.tsx` (17, nur `Date` gefaked). Offene Randfaelle (bewusst so): ein einzelner ungueltiger Tick im 15-s-Fenster ohne Folgeevent bleibt bis zum naechsten gueltigen Event oder Streamende unkorrigiert; ein `fetchDeploymentById`, das beim Wechsel der Deployment-ID schon unterwegs ist, schreibt sein Ergebnis noch in den Store (wie der bestehende `ended`-Reload).
- **2026-10-28 (Variablen-UI ohne any, `no-explicit-any` als Fehler, frontend#89, Teil von Epic #77):** `@typescript-eslint/no-explicit-any` steht in `eslint.config.js` auf `error`, das `lint`-Skript ist `eslint . --max-warnings=0`: jede Warnung bricht die CI ab, der Ratchet bleibt also erhalten; `npm run lint` meldet 0 Fehler und 0 Warnungen (vorher 28). Beide Negativfaelle geprueft: ein `any` in Produktionscode (Fehler) und ein `console.log` (Warnung, "too many warnings") lassen Lint fehlschlagen. Entfernte `any`: `useVariableForm.ts` 7, `VariableCard.tsx` 6, `useSummaryVariables.ts` 4, `summary.ts` 2, `VariableInput.tsx` 2, `types/index.ts` 2 (`DeploymentDraft`). Reines Typ-Refactoring, kein Verhalten geaendert. **Typen:** `ScalarValue`, `VariableValue`, `SlotValue`, `SlotMap`, `StoredValue(s)` stehen jetzt in `src/types/index.ts` (der Draft baut darauf auf) und werden aus `variableForm.ts` weiter exportiert; `FormValues` bleibt dort. `DeploymentDraft.variables` ist `StoredValues`, `userInputVar` ist `StoredValues | string` (der Variablen-Schritt speichert `JSON.stringify(changed)` als Text, ein geparstes Objekt, auch der Startwert `{}`, wird weiter gelesen). `VariableInput`: `value: SlotValue`, `onChange: (ScalarValue) => void` (Text/Enum liefern Strings, Zahl `valueAsNumber` inkl. NaN, Bool die negierte Truthiness; Listen bleiben Komma-Text). Der Hook nimmt `SlotValue` entgegen (`setValue`, `setScopedValue`) und liefert `VariableValue` (`getScopedValue`). Neu `parseStoredInput` in `variableForm.ts` ersetzt die beiden gleichen Parser in `useVariableForm.ts` und `useSummaryVariables.ts` (gleiches Verhalten, gleiche Log-Meldung; geparstes JSON wird weiter nicht validiert, `"null"` kommt als `null` zurueck). `formatSubmitError(error: unknown, …)` liest ueber `SubmitErrorDetail`/`SubmitFailure` (Cast an der Fehlergrenze, wie in #86/#87), `useSummaryVariables` grenzt `error.response.status` ein. **Charakterisierungstests** (Commit 1, gegen den alten Code gruen, danach unveraendert): `VariableInput.characterization.spec.tsx` (49), `summary.characterization.test.ts` (52), `NewDeploymentVariables.characterization.spec.tsx` (39: gespeicherte `userInputVar` als String/Objekt/ungueltig, Speichern, Zurueck, Team-Umbenennung, Hook-Setter, Summary-Merge); neun Mutationen am Produktionscode werden erkannt (eine gleichwertige nicht). Neu ausserdem `src/types/__tests__/draft-values.test.ts` (`expectTypeOf`). Aufgefallene Eigenheiten (nicht korrigiert, als Tests dokumentiert): ein geleertes Zahlenfeld liefert `NaN` (im JSON `null`); ein leerer String als `detail` wird unveraendert als Meldung zurueckgegeben; ein `null` im Draft verdeckt den Default in der Zusammenfassung; ein Bool mit dem Text `'false'` oder einem leeren Array gilt als an; die JSON-Texte `null` und `5` werden nicht abgefangen (`null` loest beim Laden einen Fehler-Toast aus). **ESLint-Konfiguration:** Tests behalten `no-explicit-any: off` (Fixtures, Mocks und absichtlich fehlerhafte Eingaben; steht im Kommentar der Konfiguration), Produktionscode ist geschuetzt; eine Probe mit `(x: any)` schlaegt fehl. Der ueberfluessige `eslint-disable` in `useDeploymentDetail.ts` (war die eine Nicht-`any`-Warnung) ist entfernt. **Verbleibende, begruendete Ausnahmen:** vier `eslint-disable-next-line @typescript-eslint/no-explicit-any` in `src/composables/useDeploymentStream.ts` (Zeilen der Index-Signatur, `handleEvent`, `raw`, `parseFrame`), jeweils mit `TODO #90`; die SSE-Logik ist unveraendert. `--max-warnings` steht auf 0 (nicht entfernt), damit auch Warnungen anderer Regeln wie `no-console` blockieren.
- **2026-10-27 (Variablenlogik ohne any, frontend#88, Teil von Epic #77):** In `src/views/new-deployment/variableForm.ts` sind alle 20 `any` weg; `eslint . --max-warnings=28` (vorher 48, gemessen 28, mit 27 schlaegt Lint fehl). Reines Typ-Refactoring, kein Verhalten geaendert. **Wertetypen (alle in `variableForm.ts` exportiert):** `ScalarValue` (string, number, boolean), `VariableValue` (Skalar, `unknown[]` oder `Record<string, unknown>`; deckt jeden `AppVariable.default` ab), `SlotValue` (= `VariableValue | null | undefined`, Wert eines Team-/Benutzer-Slots), `SlotMap` (Slot-Schluessel -> `SlotValue`), `FormValues` (`Record<string, SlotValue>`: Formularwerte, Listen als Komma-TEXT), `StoredValue`/`StoredValues` (Wert im Draft bzw. `changed`/`all`: Listen als Array, Zahlen als Zahl; `undefined` = Feld nie gesetzt). Form- und Speicherform sind getrennt benannt, auch wenn sie strukturell gleich sind, weil sie anders gefuellt werden. Die Typgrenze zu `draft.variables`/`userInputVar` (`DeploymentDraft`, noch `any`) bleibt unveraendert. **Abweichungen Issue <-> Code:** `src/utils/draft-variables.ts` gibt es nicht; die Logik liegt in `variableForm.ts` (20 statt 22+2 `any`). Datei-Variablen sind nicht Teil von `FormValues` (sie laufen ueber `draft.fileUploads`, `buildDraftValues` und `restoreFromDraft` ueberspringen sie), ein Datei-Slot-Typ war hier nicht noetig. **Eine schmale Assertion:** `findMissingRequired` liest `(form[key] ?? {}) as SlotMap`, weil ein Wert, der keine Map ist, wie bisher jeden Slot als `undefined` liest; sein `form`-Parameter ist jetzt `Record<string, unknown>` (nur Leer-Pruefung). **Charakterisierungstests** (`variableForm.test.ts`, 93 neue Tests, gegen den alten Code geschrieben, im Refactoring unveraendert): `dropStaleSlots`, `@expert`, leere Werte, `normalizeValue`, Scoped-Defaults, Restore/Fetch, `changed`/`all`, Listen Text <-> Array. Sie halten bewusst Eigenheiten fest, die nicht korrigiert wurden: `@expertise` zaehlt als Expert, die Luecke bei `Foo @expert bar` bleibt, Whitespace ist als Zahl 0, jede nicht leere Zeichenkette ist als Bool `true`, eine Liste ohne Default (und eine leere Zahl ohne Default) gilt immer als geaendert, Map-Defaults werden nie als geaendert erkannt, ein fehlender Zahlenschluessel wird als `NaN` gespeichert, `initialFromFetch` ueberspringt Datei-Variablen nicht (anders als `restoreFromDraft`), `restoreFromDraft` liefert fuer ein Bool ohne Wert `''` statt `false`, Listen-Slots bleiben beim Zurueckkehren Arrays. Neu: `variableForm.types.test.ts` (`expectTypeOf`, Beweis ist `tsc -b`). **Bewusst bestehende Eigenheiten:** die oben aufgezaehlten Faelle sind Ist-Verhalten, per Charakterisierungstest festgehalten und nicht korrigiert; wer eines aendert, muss den zugehoerigen Test bewusst anpassen und das als Verhaltensaenderung ausweisen (nicht als Typ-Refactoring). **Grenzen der Typen:** `FormValues` (`Record<string, SlotValue>`) und `StoredValues` (`Record<string, StoredValue>`) sind unterschiedlich benannt, aktuell aber strukturell identisch; der Compiler erzwingt die Trennung "Liste als Komma-Text im Formular, als Array im Draft" also nicht, sie steht nur in den Kommentaren und Tests. `isSlotMap` prueft nur "Objekt, kein Array, nicht null" und ist keine Laufzeitvalidierung der Eintraege; ein Slot-Eintrag kann zur Laufzeit jeder JSON-Wert sein, der Typ `SlotValue` behauptet das nicht verlaesslich. **Fuer #89:** `useVariableForm.ts` (`setValue`/`setScopedValue`/`getScopedValue` mit `any`, `userInputVar ... as any`), `VariableCard.tsx`, `VariableInput.tsx`, `summary.ts`, `useSummaryVariables.ts`; sie kompilieren unveraendert gegen die neuen Typen.
- **2026-10-27 (Datei-Variablen: eine Datei für alle, früh geprüft, frontend#113):** Datei-Variablen (`osType: 'file'`, heute
  Web-LaTeX `starter` und Online-IDE `assignments`) haben im Schritt „Variablen" eine eigene Karte (`FileVariableCard`) in einer
  `max-w-3xl`-Spalte **über** der lila Karte; die lila Karte zeigt nur noch den Rest und entfällt, wenn die App nur Dateien hat.
  Standard „Eine Datei für alle" (schreibt dieselbe Nutzlast in alle Slots, ein Store-Update über `setFileSlots`), „Pro Person/Team
  unterschiedlich" ist die Ausnahme; der Modus wird beim Betreten abgeleitet (alle Slots gleich → für alle), nicht gespeichert.
  Neue Dateien unter `src/views/new-deployment/`: `FileVariableCard` (+ `.css`), `FileDropArea`, `FileRecipients` (die Leiste),
  `fileLimits.ts` (`validateUpload`, Grenzen, Größenformat), `recipientRows.ts` (`buildRecipients`: Personen statt „Team #1"),
  `readDeploymentFile.ts`. **Geprüft wird beim Ablegen** (auch per Drag & Drop): Endung, Dateigröße (still, 1 MiB, nie angezeigt),
  Gesamtgröße (10 MiB, angezeigt); vorher fiel das erst beim Deployen im Backend auf (413/422). `FileDropZone` und `fileDropZone.*`
  sind entfernt. `AppVariable.label?` ist neu (kommt von den Apps noch nicht, Rückfall: Titel aus dem Namen); `description` aus
  der App wäre die aufklappbare Beschreibung. Neue Texte `deployment.fileVariable.*` (de/en, Sie-Form, Test `file-variable-messages`).
  **Gesendet wird unverändert** `DeploymentCreate.files` aus `draft.fileUploads`. **Fallstricke:** (1) macOS ist case-insensitiv:
  `fileRecipients.ts` überdeckte `FileRecipients.tsx` beim Import `'../FileRecipients'` (`.ts` wird vor `.tsx` aufgelöst, die
  Komponente war dann `undefined`): Logik-Module nie so benennen wie eine Komponente; (2) der Guard `tokens.spec` verbietet
  `rounded-[…]`; (3) nach einem Branch-Wechsel `npm ci` (vitest 4), sonst meldet `tsc` einen Fehler in `vitest.config.ts`.
  **Offen (Team):** `label`/`description`/`maxSize` je Variable im Vertrag der Apps (Backend, Registry, App-Repos); Design:
  `docs/design/113-datei-variablen/` (kommt mit PR #114).
- **2026-10-27 (Kurs-, App- und Version-Approval-Typen aus dem Schema, frontend#87, Teil von Epic #77):** In `src/types/index.ts` leiten sich `Course`, `CourseWithUsers`, `CourseCreate`, `CourseUpdate`, `App`, `AppWithUser`, `AppCreate`, `AppUpdate`, `AppVersionApproval`, `AppVersionApprovalWithApp` und `AppVersionApprovalStatus` aus `components['schemas']` ab (Namen bleiben); `DeploymentWithRelations.app` ist jetzt der Schema-Typ (`App`), und `AppDetail` (`versionInfo.ts`) baut auf `App` auf. Reines Typ-Refactoring: Laufzeit, Requests, Meldungen, Auth und UI unverändert. Die 6 `any` im Scope sind weg (`useAppDetail.ts` 3, `auth.store.ts` 2, `CallbackView.tsx` 1); `eslint . --max-warnings=48` (vorher 54, gemessen 48). Die 2 `any` in `types/index.ts` (`DeploymentDraft.userInputVar`/`variables`) und die Variablen-`any` gehören zu #88/#89, `useDeploymentStream` zu #90. **Fehlerbehandlung:** neues `thrownMessage(err: unknown)` in `src/utils/http-error.ts` (Meldung eines geworfenen Objekts oder undefined); bewusst nicht `extractErrorMessage`, das `response.data.detail` bevorzugen und die Meldungen aendern wuerde. Einzige Randfall-Aenderung: wirft Keycloak `null`/`undefined`, stuerzte der `catch` bisher selbst mit einem `TypeError` ab (kein Fehlertext, `login` rethrowt den `TypeError`); jetzt greift der Fallback-Text. Ebenso bildet `thrownMessage` eine nicht-stringfoermige `message` (Zahl, Objekt, `{ message: 42 }`) auf den Fallback ab; vorher landete der Rohwert (`err.message || fallback`) im Fehlerzustand bzw. in der Anzeige. Beides vom Maintainer ausdruecklich akzeptiert, nicht zurueckbauen (Tests in `http-error.test.ts`). Alle anderen Faelle (Error, Objekt mit `message`, leere Meldung, String) sind per Charakterisierungstest (`auth.store.errors.test.ts`, gegen den alten Code geschrieben) unveraendert. In `useAppDetail.ts` ersetzen `SpecErrorDetail`/`ApiFailure` das `any` (Cast an der Fehlergrenze, wie in #86). **Abweichungen Issue <-> Code:** `openstack-resources.api.ts`, `useOpenStackResourceCache.ts`, `useResourceList.ts`, `resourceItems.ts` gibt es nicht mehr (OpenStack-Pfad entfernt), es gab dort nichts zu tun und nichts wurde wiederhergestellt. **Abweichungen vom Schema:** `App.releaseTag` entfaellt (die API liefert es nicht an der App, nur an Deployments und in den `versions`-Eintraegen; `versionInfo.ts` liest es dort aus `unknown`; kein Konsument las es am `App`; einzige Fundstelle war ein Test-Fixture). `AppCreate` verlangt jetzt `is_private` und `submit_all_versions` (Schema: Defaults werden als Pflicht generiert; vorher optional; einziger Aufrufer `buildCreatePayload` sendet beide immer). `AppVersionApproval.runtime` ist Pflicht (Schema) und auf die bekannten Werte eingeengt. `App.hidden_by_admin`/`recommended` sind Pflicht (Schema liefert sie immer; ein Test-Fixture ergaenzt). **Bleibt handgeschrieben:** `AppRuntime` samt `ResourceChoice`/`NetworkChoices` (Schema: `runtime`/`scope`/`egress` als `string`, `access`/`resources`/`network` als offene Records; Kommentar am Typ), `AppVersionBadgeStatus` (reines UI-Konstrukt), Wizard-Typen. Neue Tests: `src/types/__tests__/schema-derived.app.test.ts`, `auth.store.errors.test.ts` (10), `thrownMessage` in `http-error.test.ts`.
- **2026-10-27 (Deployment-, Task- und Pod-Typen aus dem Schema, frontend#86, Teil von Epic #77):** In `src/types/index.ts` leiten sich `Deployment`, `DeploymentWithRelations`, `DeploymentCreate`, `DeploymentPermissions`, `DeploymentTeam`, `DeploymentTeamMember`, `DeploymentFile`, `PodWorkload`, `PodSetupProgress`, `DeploymentResourceListResponse`, `Task`, `TaskType` und `TaskStatus` jetzt aus `components['schemas']` ab (alle Namen bleiben exportiert). Reines Typ-Refactoring: nichts an Laufzeit, Requests, Meldungen oder UI; die 55 Golden-Tests aus #85 sind unverändert. Die `any` in den Typen (`outputs`, `TaskLogEntry`, `TaskLogsObject`, `DeploymentCreate.userInputVar`) und die 5 in `helpers.ts` (2) und `useDeploymentDetail.ts` (3 `catch (err: any)`) sind weg; `eslint . --max-warnings=54` (vorher 65). **Abweichungen Issue ↔ Code:** `InfrastructureVmDrawer.tsx` gibt es nicht mehr (der OpenStack-VM-Pfad ist seit .github#12 entfernt); das Schema kennt kein `DeploymentResourceSchema`, sondern `DeploymentResourceListResponse` und `PodWorkloadSchema`; `useDeploymentDetail.ts` hatte 3 statt 4 `any`. **Bewusst abweichend vom Schema (Kommentar an jedem Typ):** `status`, `runtime`, `actions` bleiben auf die bekannten Werte eingeengt (Schema: `string`); `Task.logs` akzeptiert weiter das Log-Objekt (Schema: `string | null`), weil `logEntryCount`, `splitTaskLogs` und Test-Fixtures es kennen; `app` bleibt der handgeschriebene `App` (#87); `MyAccessResponse` bleibt handgeschrieben (Schema lockerer, kennt zusätzlich `team_endpoints`, das `useDeploymentDetail` per Cast liest); `DeploymentUpdate` gibt es im Schema nicht und wird nirgends benutzt. **Vertragskorrekturen im Typ (ohne Laufzeitwirkung):** `userInputVar` ist ein Objekt (vorher `string | null`), `releaseTag`, `created_at`, `userInputVar`, `commit_sha` sind optional, `teams`, `permissions`, `actions` am Detail sind laut Schema immer vorhanden, `DeploymentCreate` hat kein `commitHash`/`commitInfo` mehr (nicht im Schema, nirgends gesetzt). Neue Tests: `src/types/__tests__/schema-derived.test.ts` (`expectTypeOf`, Beweis ist `tsc -b`), `helpers.userInput.test.ts` (geparstes Objekt), `useDeploymentDetail.resources.test.tsx` (Fehlerpfad von `loadResources`).

- **2026-10-27 (Payload-Logik aus dem Store gelöst, frontend#85, Teil von Epic #77):** `submitDraft` prüft weiter App und Name (`"App und Name sind Pflichtfelder"`) und ruft `buildDeploymentPayload(draft)` aus `src/utils/deployment-payload.ts` auf; dort steht auch `normalizeReleaseTag(raw: unknown)`. Die Logik wurde 1:1 verschoben, nur typisiert (die 9 `any` im Store entfallen, `unknown` mit Eingrenzung). Der Builder wirft dieselbe Meldung selbst (`DRAFT_REQUIRED_ERROR`), damit `appId` als `string` typisiert ist; `submitDraft` prüft vorher, die Meldung ist unverändert. **Absicherung:** `src/stores/__tests__/submitDraft.golden.test.ts` (55 Tests, handgeschriebene Erwartungen, `toStrictEqual`, über `submitDraft()` mit gemocktem `deploymentApi.create`) lief in Commit 1 gegen den alten und läuft unverändert gegen den neuen Code. **Lint-Ratchet:** `npm run lint` ist `eslint . --max-warnings=65` (vorher 74, die 9 `any` sind weg); die folgenden Issues (#86 bis #89) senken den Wert. **Abweichungen Issue ↔ Code (nichts davon verändert):** (1) `credentialId` und "VM-Runtime" gibt es in `submitDraft` nicht; `runtime`, `scope` und `version` des Drafts gehen nicht in den Payload (Golden-Test hält das fest). (2) Es gibt keinen eigenen Packer-Pfad und kein Multi-Image: Variablen mit `source: 'packer'` gehen wie alle anderen unter `userInputVar.terraform`. (3) Der Payload hat genau `name`, `appId`, `releaseTag`, `userInputVar` (`terraform`, optional `resources`, `network`), `teams` und optional `files`. **Auffälligkeiten des heutigen Verhaltens (bewusst nicht korrigiert, im Golden-Test dokumentiert):** `assignments` ist als `Record<number, string[]>` getypt, der Code verlangt aber `Array.isArray(draft.assignments)` (der Wizard liefert `string[][]`); ein einfaches Objekt wird ignoriert und die Teams kommen aus der `groupCount`-Verteilung. Sind `groupNames` gesetzt und `assignments` leer, entstehen Teams mit leeren Mitgliedslisten und es greift kein Fallback. Release-Tags als String werden nicht getrimmt. Ein leerer `variableDefinitions`-Array (Standard des Drafts) sendet keine Variablen, ein Nicht-Array sendet alle, auch leere. `groupNames` als Nicht-Array würde im Fallback mit einem `TypeError` abbrechen.

- **2026-10-27 (OpenAPI-Schema und Contract-Test, frontend#84, Teil von Epic #77):** Das Schema `src/types/openapi.json` stimmt mit dem Backend überein: ein frischer Export aus Backend `origin/dev` (`753cdf8`) ist **byte-identisch** mit der committeten Datei (sie wurde schon in #92 neu erzeugt, das Issue-Bild "fehlen im Schema" war überholt). `npm run gen:api-types` ergibt reproduzierbar keinen Diff, `tsc -b` ist sauber, an `src/` ändert sich nichts. **Neu:** `tests/unit/contract/openapi.spec.ts` prüft zusätzlich `PUT /admin/apps/{app_id}/recommended` und `PUT /admin/apps/{app_id}/deploy-version`. **Doku korrigiert:** README (Abschnitt "Bei einer Backend-API-Änderung") und `CLAUDE.md` nannten `make openapi` bzw. `../backend/openapi.json`; beides gibt es nicht. Der funktionierende Weg ist `poetry run python scripts/export_openapi.py <Ziel>` im Backend, dann `npm run gen:api-types`. **Lehren:** (1) Ohne installiertes Poetry reicht `pip install --target <Ordner> poetry` und `PYTHONPATH=<Ordner> python -m poetry ...`; `poetry install` in einem tief verschachtelten Pfad scheitert unter Windows (WinError 206), dann `POETRY_VIRTUALENVS_PATH` auf einen kurzen Pfad setzen. (2) Den Export aus einem `git archive origin/dev` machen, wenn das Backend-Checkout auf einem anderen Branch steht; das Checkout bleibt unberührt.

- **2026-10-27 (Windows-VM-App: Internetzugriff sichtbar, Ressourcen in den Experteneinstellungen, frontend#109):** Variablen-Schritt
  (`NewDeploymentVariableView`) hat für `draft.runtime === 'kubevirt-vm'` ein eigenes Layout; **Pod-Apps (`kubernetes`) bleiben
  unverändert** (`NetworkSettings` und `ResourcePicker` nicht angefasst), die Weiche steht in der View. Neue Dateien unter
  `src/views/new-deployment/`: `VmInternetAccess` (Karte: Status „Erlaubt/Gesperrt", Schalter, Folgezeile, bei „Erlaubt"
  bernsteinfarben), `VmExpertSettings` (Akkordeon, zugeklappt; Kopf zeigt Chip „Empfohlen/Angepasst" und das Typenschild
  „4 vCPU | 8 GB RAM"; Inhalt ist zugeklappt `inert` + `aria-hidden`, bleibt aber im DOM, damit das Auf-/Zuklappen animiert
  (`grid-template-rows`)), `VmResourceSliders` (natives `<input type="range">`, Ablesefeld, Kerben, Markierung „empfohlen",
  „Auf Empfehlung zurücksetzen", Gesamtzeile nur bei `scope: user`), `NetworkSwitchRow` (Zeile „Vernetzte Desktops") und
  `VmSettings.css` (nur Tokens). `src/utils/resources.ts`: `formatMemoryGb`, `isDefaultSelection`, `totalResources`.
  Neue Texte unter `deployment.vm.*` (de/en, Test `vm-messages.test.ts`); die Übersicht (`NewDeploymentSummaryView`) nennt die
  Zeile bei VMs „Vernetzte Desktops". **Der Standard kommt unverändert aus `draft.resources`** (`defaultSelection`), gesendet wird
  weiter `userInputVar.resources`; geändert hat sich nur, wo und wie die Bedienelemente stehen. 8 GiB werden als „8 GB" angezeigt,
  die Nutzlast bleibt `8Gi`. **Fallstricke:** (1) `rerender` aus `renderWithProviders` verliert den i18n-Provider, deshalb in den
  Tests neu rendern; (2) die Lint-Regel `react-hooks/refs` meldet jede Prop eines Props-Objekts, das eine `*Ref` enthält, als
  Ref-Zugriff beim Rendern: Props destrukturieren. **Offen (Team):** was für Pod-Apps gelten soll (siehe Issue, „Offene Punkte").
  Design: `issue-drafts/14-internetzugriff-sichtbar/` (Mockup und `design-plan.md`, außerhalb dieses Repos).
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
  5. Nach dem Merge von `dev` (#111): 131 Dateien, 1335 Tests grün, Zeilen 91,56 % (Statements 90,25; Funktionen 91,14; Branches 83,11), `npm audit` 2 Funde, `--omit=dev` 0.

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
  machen" im View-Test entfiel, weil der Store-Tab nur noch für Admins erreichbar ist. `openapi.json`/
  `api.generated.ts` waren damals nicht neu generiert (inzwischen erledigt, siehe Eintrag frontend#84).
- **2026-10-25 (Filter „Empfohlen", frontend#55):** `AppsView` hat den Tab „Empfohlen" als ersten (nur wenn eine App
  `recommended` ist); `selectedFilter` ist `CatalogFilter | null`, `activeFilter` fällt auf „Empfohlen" bzw. „Alle" zurück,
  eine Nutzerauswahl bleibt. Admins schalten pro App in `/admin/settings` (neue Karte `RecommendedAppsCard`, Schalter bis zur
  Antwort deaktiviert, Fehler-Toast) über `appApi.admin.setRecommended` → `PUT /admin/apps/{id}/recommended` (Backend #42).
  `Toggle` hat die neue Prop `disabled`. `src/types/openapi.json` und `api.generated.ts` waren damals nicht neu generiert (inzwischen erledigt, siehe Eintrag frontend#84).
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
