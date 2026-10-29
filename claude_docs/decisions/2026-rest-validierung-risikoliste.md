# REST-Antworten: Risikoliste und Prüfstrategie (Issue 143, Epic 139)

Stand: `origin/dev` 4959b12. Es gibt 38 typisierte `api.*<T>`-Aufrufe in `src/api`; der Generic prüft zur Laufzeit nichts. Geprüft wird **nicht alles**, sondern dort, wo eine falsche Form Schaden anrichtet.

## Kriterien
1. Die Form wird im UI **verzweigt oder gerendert** (ein fehlendes Feld stürzt ab oder zeigt Falsches).
2. **Rechte- oder Statuslogik** hängt daran (falsche Rechteanzeige, falsche Aktion).
3. **Fehlersymptome** sind bekannt oder wahrscheinlich (JSON in Textfeldern, Altdaten).

## Bewertung
| Endpunkt | Kriterien | Risiko | Stand |
|---|---|---|---|
| `GET /apps/{id}` | 1, 2 (`is_private`, `deploy_version`, `versions`, Besitzer steuern Aktionen); vorher `as unknown as AppDetail` | hoch | **geprüft** (`parseAppDetail`, tolerant) |
| `GET /deployments/{id}` | 1, 2 (Status, Rechte, `userInputVar` als JSON-Text, Teams) | hoch | **geprüft** (`parseDeploymentDetail`, im Store; ohne `deploymentId`/`status` abgelehnt wie ein Ladefehler) |
| `GET /tasks/{id}`, `/tasks/deployment/{id}` | 1 (`logs` ist Text, der JSON enthalten kann; Status) | hoch | **geprüft** (`parseTask`, `parseTaskList`; Einträge ohne `taskId`/`type`/`status`/`created_at` entfallen) |
| `userInputVar` / `StoredUserInput` (#120 Teil 2) | 1, 3 (`JSON.parse` + Cast in `helpers.ts`) | hoch | **geprüft** (`parseStoredUserInput`: Teile einzeln, Rückfall auf leer) |
| `GET /deployments/{id}/my-access`, `/members/{id}/access` | 2 (Rechte) | mittel | bewusst belassen: die Rechte entscheidet das Backend (403); die Antwort wird nur als Karte angezeigt, fehlende Felder lassen den Abschnitt leer |
| `GET /users/me` | 2 (Rolle) | mittel | bewusst belassen: der Cache wird seit #147 geprüft, die Rolle entscheidet das Backend bei jeder Anfrage |
| `GET /apps/{id}/runtime`, `/variables` | 1 (Wizard verzweigt) | mittel | bewusst belassen: ein Fehler im Wizard zeigt den Ladefehler (Toast), kein stilles Falschverhalten; bei Bedarf eigenes Issue |
| Listen (`/apps/`, `/courses/`, `/deployments/`, `/users/*`) | 1 (iterieren) | niedrig bis mittel | belassen: Nicht-Array führt zum Leerzustand/Fehler der Liste |
| `POST`-Antworten (`task_id`, `status`) | 1 | niedrig | belassen: Antwort wird kaum gelesen |
| `GET /dashboard/stats`, Kurs-Details, Versions-Approvals | 1 | niedrig | belassen: nur Anzeige von Zahlen/Listen |
| SSE `/deployments/{id}/stream` | 1 | hoch | bereits geprüft (`deploymentStreamEvents.ts`) |

## Vorgehen je Endpunkt
- Handgeschriebene Guards im Stil von `deploymentStreamEvents.ts`, **keine neue Abhängigkeit** (kein `zod`): nur die gelesenen Felder werden geprüft, Extrafelder bleiben.
- **Tolerant:** unbrauchbar (ohne Kennung) wird abgelehnt und wie ein Ladefehler behandelt; ein Feld falschen Typs wird mit `console.warn` verworfen, die Seite rendert ohne das Feld.
- Jeder Guard hat Tests für gültige und kaputte Formen und einen Verdrahtungstest im Hook.

## Reihenfolge der Teil-PRs
1. App-Detail (PR #172) - erledigt.
2. Task, `StoredUserInput`, Deployment-Detail - erledigt (dieser Abschluss).
3. Rest ist begründet belassen (Tabelle).
