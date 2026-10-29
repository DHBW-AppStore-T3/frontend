# Routing und Zugriffskontrolle

Übersicht über Rollen, Route-Guards, Capabilities und das `RoleGate`-Muster. Wer eine neue Seite baut, findet hier alles an einem Ort.

---

## Rollen

Es gibt drei Rollen, die von Keycloak kommen und in `src/stores/auth.store.ts` gespeichert werden:

| Rolle | Konstante | Bedeutung |
|---|---|---|
| `student` | `isStudent` | Startet keine Deployments und registriert keine Apps; sieht die Deployments, in denen die Person Mitglied ist |
| `teacher` | `isTeacher` | Registriert Apps, startet Deployments, verwaltet Kurse, bedient eigene Deployments |
| `admin` | `isAdmin` | Wie teacher + App-Freigaben, alle Deployments sehen |

`isStaff` ist ein Kurzschluss für `isAdmin || isTeacher` — die Grenze, ab der Apps registriert und Deployments gestartet werden können. Im Router heißt das Gegenstück `staffOnly` (`STAFF_ROLES` in `src/router/guards.ts`).

---

## Admin-Ansicht

Admins haben zusätzlich eine schaltbare **Admin-Ansicht** (`/admin/settings`). Sie ist standardmäßig aus.

```
isAdminView = isAdmin && adminViewEnabled   // aus useRole()
```

Dahinter liegen UI-Extras, die bei normaler Nutzung stören würden: Versionsanzahl auf App-Kacheln, Tab „App Store" auf der App-Detailseite, Schalter „Empfohlen" pro App, Button „Version festlegen". Bestehende Admin-Rechte (Freigaben, alle Deployments sehen, `adminApps`-Route) sind **unabhängig** vom Schalter.

Der Zustand liegt in `src/stores/admin-view.store.ts` (Zustand `persist`, Schlüssel `appstore.adminView`, pro `userId`).

---

## `useRole()` — der einzige Ort für Rollenabfragen

Alle Rollenprüfungen in Komponenten laufen über den `useRole()`-Hook (`src/composables/useRole.ts`). Nicht `useAuthStore` direkt abfragen.

```ts
const { role, isAdmin, isTeacher, isStudent, isStaff, isAdminView, canEditApp, canOperateDeployment } = useRole()
```

**Capabilities** (`can*`) sind ressourcengebunden und spiegeln `backend/app/utils/capabilities.py`:

| Capability | Logik |
|---|---|
| `canEditApp(app)` | `isAdmin` oder App gehört dem eingeloggten User |
| `canDeleteApp(app)` | identisch mit `canEditApp` |
| `canSubmitAppVersion(app)` | identisch mit `canEditApp` |
| `canApproveApp` | nur `isAdmin` |
| `canOperateDeployment(d)` | `isAdmin` oder Deployment gehört dem eingeloggten User |
| `canEditCourse(c)` | `isAdmin` oder User ist in `c.teacherIds` |
| `canChangeUserRole` | nur `isAdmin` |

> Die `can*`-Prüfungen sind **kosmetisch** — sie steuern Button-Sichtbarkeit. Die maßgebliche Prüfung passiert immer im Backend (API liefert sonst 403).

---

## `<RoleGate>` — bedingtes Rendern

Für rollenabhängige UI-Teile gibt es die `RoleGate`-Komponente (`src/components/RoleGate.tsx`). Sie rendert `children` nur, wenn die Bedingung erfüllt ist — andernfalls `null`.

```tsx
// Nur Admins
<RoleGate admin>
  <DeleteButton />
</RoleGate>

// Nur Staff (teacher + admin)
<RoleGate staff>
  <NewDeploymentButton />
</RoleGate>

// Admin mit eingeschalteter Admin-Ansicht
<RoleGate adminView>
  <VersionBadge count={app.versions?.length} />
</RoleGate>

// Ressourcen-Capability (boolean wird vom Parent berechnet)
<RoleGate can={canEditApp(app)}>
  <EditButton />
</RoleGate>
```

Props: `admin`, `staff`, `adminView`, `can` — immer nur eine davon setzen.

---

## Route-Guards

Guards laufen als Route-Loader, bevor die Seite gerendert wird (`src/router/guards.ts`).

### `resolveRouteGuard(meta, fullPath)`

Globaler Guard für Auth und Rollen. Gibt `null` zurück wenn alles passt, sonst einen Redirect-Pfad.

```ts
export interface RouteMeta {
  requiresAuth?: boolean    // nicht eingeloggt → /login?returnUrl=…
  requiresGuest?: boolean   // eingeloggt → /dashboard
  requiresRole?: UserRole[] // falsche Rolle → /forbidden (+ Toast)
}
```

Vorgefertigte Metaobjekte:

```ts
const auth: RouteMeta = { requiresAuth: true }           // jeder eingeloggte User
const staffOnly: RouteMeta = { requiresAuth: true, requiresRole: ['teacher', 'admin'] }
```

### `requireWizardStep(required)`

Schützt die Wizard-Schritte vor Deep-Links, die den Wizard-State überspringen. Gibt den Pfad des ersten fehlenden Schritts zurück.

```ts
// Felder: 'appId' | 'name' | 'studentIds'
requireWizardStep(['appId', 'name', 'studentIds'])
// → paths.apps      wenn kein appId
// → paths.deploymentConfig  wenn kein name / keine studentIds
```

### `skipVariablesStep()`

Der Variablen-Schritt des Wizards entfällt, wenn die App nichts einzustellen hat. `needsVariablesStep(draft)` (`src/views/new-deployment/variablesStep.ts`) liefert dafür `true` (Variablen, Ressourcenwahl oder sichtbarer Netzwerkschalter), `false` oder `null` (noch nicht bekannt, der Schritt öffnet dann wie gewohnt). Bei `false` leitet `skipVariablesStep()` `/deployment/new/variables` per `replace` nach `paths.deploymentTeams` um: Die übersprungene Seite landet nie im Verlauf, ein Lesezeichen oder „Zurück“ führt also nicht in eine leere Seite.

### `guarded(route, meta, wizard?, stepGuard?)` — internes Hilfsmittel

Verpackt eine Route mit den Guards als `loader`, in dieser Reihenfolge: `resolveRouteGuard`, dann optional `requireWizardStep(wizard)`, dann optional `stepGuard` (Umleitung mit `replace`). Intern in `src/router/index.tsx` verwendet — nicht direkt importieren.

---

## Routen-Übersicht

Alle Pfade stehen in `src/router/paths.ts`. Die Guard-Ebene je Route:

| Route | Guard |
|---|---|
| `/login` | `requiresGuest` — eingeloggte User → Dashboard |
| `/callback` | — (offen) |
| `/`, `/dashboard` | `requiresAuth` |
| `/apps`, `/apps/:id` | `requiresAuth` |
| `/apps/create` | `staffOnly` |
| `/deployments`, `/deployments/:id` | `requiresAuth` |
| `/deployment/new/config` (Wizard, Schritt 1) | `staffOnly` |
| `/deployment/new/teams`, `/variables`, `/summary` | `staffOnly` + Wizard-Step-Guard; `/variables` zusätzlich `skipVariablesStep` |
| `/courses`, `/courses/:id` | `staffOnly` |
| `/admin/apps` | `requiresRole: ['admin']` |
| `/admin/settings` | `requiresRole: ['admin']` |
| `/user`, `/help`, `/forbidden` | `requiresAuth` |
| `*` (unbekannt) | Umleitung auf `/` |

---

## Fehler-Boundary

Jeder Layout-Zweig ist in einen pathlosen Wrapper-Route eingebettet, der ein `errorElement` (`src/components/RouteError.tsx`) trägt. Wirft ein Loader oder ein Render einen Fehler, ersetzt `RouteError` nur die Seite — Sidebar und Header bleiben stehen. Die Root-Route hat zusätzlich ein `RouteError fullPage` als letzten Fallback.

---

## Neue Seite anlegen — Checkliste

1. Pfad in `src/router/paths.ts` eintragen.
2. Route in `src/router/index.tsx` mit `guarded(...)` und dem richtigen `RouteMeta` registrieren.
3. In der View `useRole()` nutzen, nie `useAuthStore` direkt.
4. Bedingte UI-Bereiche hinter `<RoleGate>` stecken.
5. Ressourcen-abhängige Buttons mit `can={canEditApp(app)}` o. Ä. schützen — die API prüft trotzdem nochmal.
