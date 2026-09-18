# frontend

Frontend des DHBW-AppStore (Vue 3, Pinia, Tailwind CSS, Vite, TypeScript).
Harness-Gesamtkonzept: siehe https://github.com/DHBW-AppStore-T3/.github/blob/main/docs/HARNESS.md

## Die 2 Flows
1. **Flow 1 (`/user-story`):** UI/UX-Spezifikation und OpenAPI-Contracts werden vorab im Issue definiert.
2. **Flow 2 (`/harness-workflow`):** TDD (`npm run test`), OpenAPI-Typen generieren (`npm run openapi:generate`), PR auf `dev`, CI grün, Auto-Merge auf `dev`, automatisches Staging-Deploy, Hermes Discord Reporting.
   - Push auf `main` bleibt rein menschlich + Test Coverage Gate.

Wichtige Befehle:
- Dev-Server: `npm run dev`
- Build & Typecheck: `npm run build` (`vue-tsc -b && vite build`)
- Tests & Coverage: `npm run test` / `npm run test:coverage`
- OpenAPI Typen synchronisieren: `npx openapi-typescript ../backend/openapi.json -o src/types/api.generated.ts`
- Lebendes Übergabedokument: `claude_docs/HANDOVER.md`
