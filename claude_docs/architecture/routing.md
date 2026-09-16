# Routing

`vue-router`, `src/router/index.ts`. Views unter `src/views/` — ein
Multi-Step-Wizard für neue Deployments
(`NewDeploymentConfigView` → `NewDeploymentVariableView` →
`NewDeploymentGroupsAssignmentView` → `NewDeploymentSummaryView`).

## Wizard-Guard (`requireWizardStep`)

Verhindert Deep-Links, die den Wizard-State überspringen (z. B. direkt
`/deployment/new/summary` ohne vorher eine App ausgewählt zu haben).
Prüft gegen `useDeploymentStore().draft` (siehe `state.md`), welche
Felder für den jeweiligen Schritt gesetzt sein müssen
(`appId`/`name`/`studentIds`), redirected sonst zum passenden früheren
Schritt zurück.

**Konsequenz für neue Wizard-Schritte:** neue Schritte müssen ihre
Voraussetzungen in `requireWizardStep(...)` eintragen, sonst sind sie
per Direktlink erreichbar, ohne dass der vorherige Schritt
durchlaufen wurde — der Store-State wäre dann unvollständig.

## Rollenbasierte Sichtbarkeit

`UserRole`-Typ aus `@/types` (gespiegelt zum Backend-Enum
`app/models.py::UserRole`) steuert, welche Routen/Views je nach Rolle
sichtbar sind — bei neuen rollenspezifischen Views prüfen, ob das
Backend-Enum um denselben Wert erweitert wurde.
