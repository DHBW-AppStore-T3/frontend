# Lokales Setup — Stolpersteine

## `npm run build` läuft Type-Checking mit

`"build": "vue-tsc -b && vite build"` — ein TypeScript-Fehler
verhindert den Build komplett, nicht nur eine Warnung. Bei
unerwarteten Build-Abbrüchen zuerst `vue-tsc -b` isoliert laufen
lassen, um zu sehen ob es ein Typ- oder ein Vite-Problem ist.

## Kein direkter Zugriff auf Backend-Enums

`UserRole` und ähnliche Typen sind in `src/types/` von Hand
gespiegelt zu `backend/app/models.py` — kein automatisch generierter
Client aus einer OpenAPI-Spec. Bei einer Enum-Änderung im Backend
diesen Typ manuell nachziehen, sonst laufen Frontend und Backend
unbemerkt auseinander.

## `env.ts` — zwei Konfigurationsquellen, nicht nur Vite-Build-Zeit

`env.ts` liest zuerst `window.__ENV__` (Runtime-Injection, vermutlich
vom nginx-Entrypoint zur Container-Startzeit eingefügt — erlaubt
Config-Änderungen ohne Rebuild), fällt zurück auf
`import.meta.env.VITE_*` (Vite-Build-Zeit). Nicht direkt
`import.meta.env` im restlichen Code verwenden — `env.ts` kapselt das.
Beim Debuggen einer falschen Config in Prod zuerst prüfen, ob
`window.__ENV__` zur Laufzeit korrekt gesetzt wurde, nicht nur die
Build-Zeit-Variablen.
