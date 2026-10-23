# Pods/K8s im React-Frontend (frontend#36, Branch `spike/react-pods`)

**Status:** umgesetzt (AP0-AP7); E2E-Abnahme auf dem k8s-Staging am 2026-10-23 durchgeführt (siehe Ergebnis unten), Cutover in `ci.yml` vollzogen.

## Ausgangslage
`spike/vue-pods` (Vue, Stand `48a6523`, eingefroren) stellt Linux-Apps als Pods dar, verwaltet ein
OpenStack-Credential pro Projekt und liefert das Frontend als API-Gateway (nginx). `dev` ist seit PR #33 React.
`spike/react-pods` überträgt das Delta auf React; `spike/vue-pods` bleibt als Referenz unverändert.

## Entscheidungen
- **Vertrag:** `src/types/openapi.json` stammt aus Backend `spike/dev` (`scripts/export_openapi.py`). `tests/unit/contract`
  pinnt die genutzten Routen. Bei Backend-Änderungen neu erzeugen (`npm run gen:api-types`).
- **Rechte** aus `permissions` und `actions` der Detail-Antwort (`deployment-detail/access.ts`), nicht aus der Rolle.
- **Zugangsdaten** nur aus `/my-access`, nur an die eigene Zeile, gefunden per `userId` (keine Namens-Heuristik).
- **Studierende** im Wizard per AppStore-`userId`; keine Keycloak-ID-Übersetzung mehr.
- **Staff-Routen** (`staffOnly`): App anlegen, Deploy-Wizard, OpenStack-Settings.
- **Laufzeit:** `GET /apps/{id}/runtime` entscheidet, ob ein Credential nötig ist (VM) oder nicht (Pods). Pods: kein
  Packer-Bereich, Enum-Variablen als Select, `scope: user` erzwingt ein Team pro Person.
- **XSS:** Nutzerdaten in Texten nur als Text (`BoldSlot`); `dangerouslySetInnerHTML` per ESLint-Regel nur mit Begründung.
- **Infrastruktur** 1:1 aus Vue: nginx-Gateway (`API_UPSTREAM`), CSP, HSTS, read-only Image, gebündelte `silent-refresh`-Seite.

## Rollout und Cutover
Es darf nur ein Frontend-Branch das k8s-Staging ausrollen (der Digest liegt in `k8s/env/appstore.yaml` des
deployment-Repos, Branch `spike/dev`). Bis zum Cutover löst `spike/vue-pods` den Rollout bei jedem Push aus,
`spike/react-pods` nur per `workflow_dispatch` (Job `k8s-staging` in `ci.yml`).

Cutover: (1) E2E auf dem Staging, (2) `spike/react-pods` rollt auch bei `push` aus (`ci.yml`, erledigt;
`spike/vue-pods` ist eingefroren), (3) in der deployment-README „frontend: push to spike/vue-pods" auf
`spike/react-pods` ändern (PR im deployment-Repo, offen).

## E2E-Ergebnis (k8s-Staging, 2026-10-23, React-Image aus `spike/react-pods`)
Geprüft mit den Demo-Konten Dozent, Student und Admin im Browser.

- [x] Login über Keycloak; Seiten-Reload behält die Sitzung (Fix: `silent-refresh.html` darf von der App selbst
      gerahmt werden, vorher `X-Frame-Options: DENY`)
- [x] Dashboard: Hinweis „Nur Windows/VM-Apps brauchen ein Credential“, Student ohne Quota-Kachel und Kurse
- [x] App-Detail: Laufzeit-Anzeige „Pods im Cluster · je Person“, Deploy ohne Credential
- [x] Wizard Pod-App (Scope `user`): Teams je Person erzwungen, Zusammenfassung mit Laufzeit, Absenden
- [x] Deployment-Seite: Workloads live aus dem Cluster, Neustart mit Live-Stream, Reset-Dialog mit Rückfrage, Löschen
      mit Pod-Text; Mitglieder sehen nur die eigene Zeile (Passwort verdeckt), keine Aktionen
- [x] Rollen: Student wird bei Wizard und OpenStack-Settings auf „Zugriff verweigert“ geleitet
- [x] Admin-Review: Laufzeit, Commit, appstore.yaml-Hash, Image-Digests
- [ ] Nicht prüfbar auf dem Staging: VM-Wizard und Credentials anlegen/prüfen/löschen (kein OpenStack),
      LTI-Start (`#lti=1…`, kein Moodle). Beides ist durch Unit-Tests abgedeckt.

### Beobachtung außerhalb des Frontends
Ein neues Deployment mit zwei Workloads (`scope: user`) scheiterte in der Phase `K8S_WAIT_READY` nach 0,1 s mit
„Pod … cannot be scheduled … persistentvolumeclaim … not found“. Das Frontend zeigt den Fehler korrekt an. Ursache liegt
im Worker (die Bereitschaftsprüfung wertet einen Pod als nicht planbar, bevor sein Volume angelegt ist). Gehört in ein
Issue im Worker-Repo.

## E2E-Checkliste (Vorlage)
- [ ] Login über Keycloak; LTI-Start (`#lti=1…`) und Entfernen des Fragments aus der Adresszeile
- [ ] Dashboard: Quota-Kachel mit Projektwahl (Staff), Banner für ungeprüfte/fehlerhafte Credentials
- [ ] App-Detail: Laufzeit-Anzeige, ungültige `appstore.yaml` sperrt Deploy, Student sieht kein Deploy-Panel
- [ ] Wizard Pod-App (Scope `team` und `user`): Namen, Studierende, Teams, Variablen (inkl. Enum), Zusammenfassung, Absenden
- [ ] Wizard VM-App: Projektwahl, OpenStack-Picker aus dem gewählten Projekt, Absenden
- [ ] Credentials: anlegen (Keystone-Fehler lesbar), prüfen, löschen (gesperrt bei aktiven Deployments)
- [ ] Deployment-Seite: Live-Stream, Workloads, Restart, Reset mit Rückfrage, Pause/Fortsetzen/Löschen nach `actions`
- [ ] „Meine Zugänge": nur die eigene Zeile, kein fremdes Passwort
- [ ] Rollen: Student hat weder Wizard noch OpenStack-Settings (Weiterleitung auf `/forbidden`)
- [ ] Admin-Review: Runtime, Commit, Spec-Hash, Digests
