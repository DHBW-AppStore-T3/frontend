# In-Memory-Tokens statt localStorage

`composables/useKeycloak.ts` speichert den OIDC-Access-Token in
`InMemoryWebStorage`, nicht in `localStorage`. Begründung im
Quellcode-Kommentar: jeder XSS-Payload, der im Seitenkontext läuft,
könnte sonst einen langlebigen Access-Token exfiltrieren.

**Trade-off, akzeptiert:** ein harter Browser-Reload verliert die
In-Tab-Session. Abgefedert durch Keycloaks SSO-Cookie plus
`signinSilent`, das den Token ohne erneuten Login-Screen neu ausstellt.

**Konsequenz:** dieser Trade-off ist eine bewusste
Sicherheitsentscheidung, keine Lücke — nicht "reparieren", indem der
Token doch in `localStorage` gecacht wird, um den Reload-Verlust zu
vermeiden.
