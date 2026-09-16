# API-Client & Fehlerbehandlung

`src/api/axios.ts` — ein zentraler Axios-Instance, alle `*.api.ts`-Module
nutzen ihn statt eigener Axios-Aufrufe.

## Token-Handling — bewusst In-Memory, nicht localStorage

`composables/useKeycloak.ts` speichert den `oidc-client-ts`-Token in
`InMemoryWebStorage`, **nie** in `localStorage`. Kommentar im Code
dazu, wörtlich: "Any XSS payload that runs in the page would otherwise
be able to exfiltrate a long-lived access token." Trade-off:
ein harter Reload verliert die In-Tab-Session — abgefangen über
Keycloaks SSO-Cookie + `signinSilent`, das den Token bei Bedarf
automatisch neu ausstellt, ohne erneuten Login.

**Konsequenz für neuen Code:** niemals den Token selbst in
`localStorage`/`sessionStorage` schreiben, auch nicht "nur kurz zum
Debuggen" — das unterläuft genau die Schutzmaßnahme oben.

## Request-Interceptor (`axios.ts`)

Hängt automatisch `Authorization: Bearer <token>` an jeden Request,
holt den Token frisch über `useKeycloak().getAccessToken()` (kein
gecachter Wert im Interceptor selbst).

## Response-Interceptor — globale Fehlerbehandlung

- **401** — versucht zuerst einen stillen Token-Refresh
  (`ensureValidToken()`). Schlägt das fehl: `localStorage`-Eintrag
  `user` wird gelöscht (Legacy-Rest, nicht der Auth-Token selbst) und
  Redirect zu `/login` mit `returnUrl`.
- **403** — nur geloggt (`console.error`), kein automatischer Redirect.
  Wer eine bessere UX für 403 will (z. B. Toast über `toast.store.ts`),
  muss das hier ergänzen — aktuell verschwindet der Fehler in der
  Konsole.
