# Bekannte Fehlerbilder

## "401 Loop" nach abgelaufener Session

Wenn `ensureValidToken()` in `axios.ts`s Response-Interceptor
fehlschlägt, wird zu `/login` redirected — aber falls die
Login-Route selbst einen 401-auslösenden Request macht (z. B. für
Nutzerdaten), kann das theoretisch eine Redirect-Schleife auslösen.
Bei mysteriösen Redirect-Loops zuerst prüfen, ob `LoginView` selbst
authentifizierte Requests macht, die sie nicht sollte.

## Wizard-State verschwindet nach Reload

Der `deployment.store.ts`-Draft-State lebt nur im Pinia-Store
(In-Memory), nicht persistiert. Ein Reload mitten im
Deployment-Wizard verliert den Fortschritt — das ist aktuell
erwartetes Verhalten, kein Bug, aber eine häufige Nutzerfrage.

## `npm audit`-Fund bei `js-yaml`/`nanoid`

Stand 2026-09-15 (erster echter CI-Lauf nach der GitHub-Actions-
Freischaltung, siehe `log/2026-W38.md`): HIGH-Severity-CVEs in
`js-yaml` und `nanoid`, beide über `npm audit fix` behebbar. Nicht
selbst gefixt in dieser Runde — bei nächster Gelegenheit
`npm audit fix` ausführen und Testsuite gegenprüfen.
