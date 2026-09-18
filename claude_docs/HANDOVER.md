# Handover — Frontend

Lebendes Übergabedokument gemäß [HARNESS.md](https://github.com/DHBW-AppStore-T3/.github/blob/main/docs/HARNESS.md) Abschnitt 1.2.
Jede Session liest dieses Dokument zu Beginn und aktualisiert es vor dem Abschluss.

---

## 1. Status & Fokus
- **Stack:** Vue 3 (Composition API), Vite, Pinia Stores, Tailwind CSS, TypeScript (`vue-tsc`), Vitest, Axios, OIDC (`oidc-client-ts`).
- **Rolle:** Web-UI für Dozierende und Studierende zur Verwaltung und Bereitstellung von OpenStack-VMs und AppStore-Templates.
- **Auth & Tokens:** OIDC Tokens liegen aus XSS-Schutzgründen ausschließlich im Arbeitsspeicher (`InMemoryWebStorage` in `composables/useKeycloak.ts`).
- **CI:** Type Check (`vue-tsc -b`), Tests (Vitest), Security Scans (Trivy), Docker Build & Image Scan.

---

## 2. In Arbeit & Nächste Schritte
- [x] **OpenAPI-Typengenerierung:** `openapi-typescript` als Dev-Dependency installiert und Skript `npm run openapi:generate` integriert; `src/types/api.generated.d.ts` erfolgreich generiert.
- [ ] **PR #2 & PR #3 konsolidieren:** Security-Fixes und modernisierte `claude_docs/` zusammenführen.
- [ ] **Error-Handling UX:** 403-Response-Handling im Axios-Interceptor mit Feedback via `toast.store.ts` versehen.

---

## 3. Bekannte Fallstricke & Blocker
1. **Token niemals persistieren:** Weder `localStorage` noch `sessionStorage` für Auth-Tokens verwenden (Verletzung des Sicherheitskonzepts).
2. **Type Check im Build:** `npm run build` führt `vue-tsc -b` aus und bricht bei kleinsten Typfehlern hart ab — vor jedem Commit lokal `vue-tsc -b` laufen lassen.
3. **Veraltete Typen vs. Backend:** Backend-Änderungen an Pydantic-Schemas müssen im Frontend nachgezogen werden (wird durch `npm run openapi:generate` automatisiert).

---

## 4. Letzte Übergaben (Historie)
- **2026-09-18:** OpenAPI-Typengenerierung via `openapi-typescript` eingerichtet (`npm run openapi:generate`); `src/types/api.generated.d.ts` generiert.
- **2026-09-18:** Wochenlog durch lebendes `claude_docs/HANDOVER.md` abgelöst; `CLAUDE.md` aktualisiert; Security-Audit-Fixes (`js-yaml`, `nanoid`) gemergt.
- **2026-09-16:** `claude_docs/architecture/` (`overview`, `state`, `api-client`, `routing`), `decisions/`, `debugging/` und lokaler Graphify-Graph aufgesetzt.
