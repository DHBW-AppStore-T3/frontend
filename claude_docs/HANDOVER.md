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
2. **Coverage Gate:** PRs auf `main` verlangen mindestens 60% Zeilen-Abdeckung.
3. **Security-Audit:** `js-yaml` und `nanoid` wurden über PR #3 gepatcht; `npm audit` regelmäßig prüfen.

---

## 4. Letzte Übergaben (Historie)

- **2026-10-26 (Architektur-Ist-Stand, C4, beide Oberflächen):** Neu: `docs/architecture/architecture.md` (statische und
  dynamische Architektur von **Frontend und self-service-ui** mit Kontext-, Container-, Komponenten-, Deployment- und zehn
  Dynamic-Diagrammen) und `docs/architecture/workspace.dsl` (Structurizr-Modell, über den Structurizr MCP Server validiert
  und nach Mermaid exportiert). Beschrieben ist `dev` (= Staging) zum Zeitpunkt der Analyse: Frontend `0005672`,
  self-service-ui `54130c3` (erster Stand: `916c93f` und `1e67bd1`, siehe Git-Historie). **Spätere `dev`-Commits sind nicht
  erfasst.** Prod liegt 47 bzw. 13 Commits hinter dem beschriebenen Stand (Tabelle 1.1 im Dokument). Am 2026-10-26 14:14 UTC
  wurden die laufenden Digests in `appstore-staging` und `appstore-prod` gegen die Pins geprüft: alle gleich, Argo überall
  `Synced`/`Healthy`. Dieser Branch zweigt von `916c93f` ab, das Dokument beschreibt `0005672`; es zitiert deshalb keine
  Zeilennummern.
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
  to /forbidden") flackert auch auf `dev` (gemessen 2 von 12 Läufen mit und ohne die Änderung), siehe frontend#78.

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
