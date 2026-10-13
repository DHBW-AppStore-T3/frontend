## Release `dev` → `main`

<!--
Release-PR: bringt den aktuellen Stand von `dev` in Produktion. Nach dem
Merge pusht CI das Image als `latest` und startet `deployment/production.yml`.
Jeder Merge auf `main` in backend, worker oder frontend löst ein
vollständiges Produktions-Deployment mit den jeweils aktuellen
`latest`-Images aus.

Anlegen:
  gh pr create --base main --head dev --title "release: <Datum>" \
    --body-file .github/pull_request_template/release.md
oder im Browser: .../compare/main...dev?expand=1&template=release.md

Mit Merge-Commit mergen, nicht squashen, damit `dev` und `main` nicht
auseinanderlaufen.
-->

**Enthaltene PRs:**

<!-- Alle PRs seit dem letzten Release, z. B. aus `git log --oneline origin/main..origin/dev`. BREAKING-PRs kennzeichnen. -->

-

**Staging:** <!-- Link zum Staging-Deploy-Lauf und zum Hermes-Report für diesen `dev`-Stand -->

**Release-Reihenfolge:** <!-- Nur falls backend/worker/deployment mitziehen. Das frontend kommt in der Regel zuletzt, nachdem die benötigten Backend-Endpunkte in Produktion sind. Sonst "nur frontend". -->

**Rollback auf:** <!-- Aktuell produktives Image-Tag (`sha-…`) -->

## Release-Checkliste

<!--
Jeder Punkt wird abgehakt, bevor der PR gemergt werden kann. Trifft ein
Punkt nicht zu: mit "n/a" markieren UND abhaken, z. B.
- [x] n/a — Konfiguration: keine neuen Variablen

Die Änderungs-Checklisten der enthaltenen PRs werden hier nicht wiederholt.
Dieser PR prüft, ob der gesammelte Stand in Produktion darf. Lint, Type
Check, Tests inkl. Coverage-Gate, Security, Build und Image Scan laufen als
CI-Checks.
-->

- [ ] Staging: Genau dieser `dev`-Stand ist auf Staging deployt; Staging-Deploy grün, Hermes-Healthcheck GUT; die enthaltenen Änderungen dort im Browser mit den betroffenen Rollen durchgeklickt
- [ ] Enthaltene PRs: Liste oben vollständig; jeder enthaltene PR hat eine vollständige Checkliste; PRs, die ohne Review auf `dev` gemergt wurden, sind in diesem PR reviewt
- [ ] Kompatibilität: Alle Backend-Endpunkte und -Felder, die dieser Stand nutzt, sind bereits in Produktion oder werden vorher released; die Reihenfolge ist oben festgelegt
- [ ] Konfiguration: Neue Laufzeit-Variablen (`VITE_*`) sind in `docker-entrypoint.sh` und `public/env-config.js` eingetragen, in `deployment/docker-compose.prod.yml` durchgereicht (auf `deployment/main`) und ihre Werte im Secret `PRODUCTION_ENV_FILE` gesetzt, bevor gemergt wird
- [ ] Rollback: Image-Tag für den Rückweg ist oben notiert (`deployment/claude_docs/rollback/service.md`)
