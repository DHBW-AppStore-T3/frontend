## Release `dev` → `main`

<!--
Release-PR: bringt den aktuellen Stand von `dev` in Produktion. Der Merge
allein rollt noch nichts aus: Nach dem Merge pusht CI das Image (Tag
`sha-<Commit>`) nach ghcr.io und startet `k8s-bump.yml` im Repo `deployment`
mit Ref `main`. Das öffnet dort einen PR "chore(k8s): roll out frontend
sha-… on prod", der den Digest in `k8s/images/prod.yaml` setzt. Erst wenn eine
Person diesen PR freigibt und mergt (bei `PROD_AUTO_MERGE=true` mergt er sich
selbst), rollt Argo CD (`prod-root`) aus.

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

**Staging:** <!-- Link zum CI-Lauf mit dem Roll-out auf Staging und Ergebnis von `staging_verdict` (appstore-mcp, Skill `/verify-staging`) für diesen `dev`-Stand -->

**Release-Reihenfolge:** <!-- Nur falls backend/worker/deployment mitziehen. Das frontend kommt in der Regel zuletzt, nachdem die benötigten Backend-Endpunkte in Produktion sind. Sonst "nur frontend". -->

**Rollback auf:** <!-- Aktuell produktiver Image-Digest/Tag aus `deployment/k8s/images/prod.yaml` -->

## Release-Checkliste

<!--
Jeder Punkt wird abgehakt, bevor der PR gemergt werden kann. Trifft ein
Punkt nicht zu: mit "n/a" markieren UND abhaken, z. B.
- [x] n/a — Konfiguration: keine neuen Variablen

Die Änderungs-Checklisten der enthaltenen PRs werden hier nicht wiederholt.
Dieser PR prüft, ob der gesammelte Stand in Produktion darf. Type Check, Lint,
Tests inkl. Coverage-Gate (≥ 80 % Zeilen und Branches), Security, Build und
Image Scan laufen als CI-Checks.
-->

- [ ] Staging: Genau dieser `dev`-Stand ist auf Staging ausgerollt, CI inkl. Roll-out grün, `staging_verdict` ohne Befund; die enthaltenen Änderungen dort im Browser mit den betroffenen Rollen durchgeklickt
- [ ] Enthaltene PRs: Liste oben vollständig; jeder enthaltene PR hat eine vollständige Checkliste; PRs, die ohne Review auf `dev` gemergt wurden, sind in diesem PR reviewt
- [ ] Kompatibilität: Alle Backend-Endpunkte und -Felder, die dieser Stand nutzt, sind bereits in Produktion oder werden vorher released; die Reihenfolge ist oben festgelegt
- [ ] Konfiguration: Neue Laufzeit-Variablen (`VITE_*`) sind in `docker-entrypoint.sh` und `public/env-config.js` eingetragen und in `deployment/k8s/charts/appstore/templates/frontend.yaml` (Werte in `k8s/environments/prod.yaml`) gesetzt; diese Änderung ist auf `deployment/main` (`k8s/promote.sh`), bevor der Digest-PR für Produktion gemergt wird
- [ ] Rollback: Digest/Tag für den Rückweg ist oben notiert (Rückweg: Digest in `deployment/k8s/images/prod.yaml` per PR auf `main` zurücksetzen)
