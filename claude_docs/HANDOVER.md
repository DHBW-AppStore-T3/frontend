# Handover — Frontend

Lebendes Übergabedokument gemäß [HARNESS.md](https://github.com/DHBW-AppStore-T3/.github/blob/main/docs/HARNESS.md) Abschnitt 1.2.
Jede Session liest dieses Dokument zu Beginn und aktualisiert es vor dem Abschluss.

---

## 1. Status & Fokus

- **Stack:** Vue 3, Pinia, Tailwind CSS, Vite, TypeScript, Vitest.
- **Die 2 Flows (Harness Engineering):**
  - **Flow 1 (`/user-story`):** Vorab-Spezifikation von UI/UX-Komponenten, Store-State und OpenAPI-Typen im Issue.
  - **Flow 2 (`/harness-workflow`):** Autonomer Feature-Bau gegen `dev` -> TDD (Vitest) -> PR auf `dev` -> CI grün -> Auto-Merge -> Automatisches Staging Deployment -> Hermes Discord Statusmeldung.
  - **Push auf `main`:** Bleibt rein menschlich! Abgesichert durch automatisiertes **Test Coverage Gate**.
- **CI/CD:** `ci.yml` unterstützt jetzt `main` und `dev`. Push auf `dev` baut Images und stößt Staging Deployment an.

---

## 2. In Arbeit & Nächste Schritte

- [x] Reengineering auf 2 Flows: `ci.yml` auf `dev`-Trunk und Test Coverage Gate für `main` umgestellt.
- [x] Staging-Deploy-Trigger korrigiert auf `DHBW-AppStore-T3/deployment --ref dev`.
- [ ] Typensichere API-Client-Integration mit generierten Typen (`api.generated.ts`) fortführen.

---

## 3. Bekannte Fallstricke & Blocker

1. **Typensicherheit:** `vue-tsc -b` schlägt bei fehlerhaften Typen im CI Build fehl; Typen vor dem Commit immer lokal prüfen.
2. **Coverage Gate:** PRs auf `main` verlangen mindestens 60% Zeilen-Abdeckung.
3. **Security-Audit:** `js-yaml` und `nanoid` wurden über PR #3 gepatcht; `npm audit` regelmäßig prüfen.

---

## 4. Letzte Übergaben (Historie)

- **2026-09-26 (White-Label-Theming, frontend#18):** `src/theme/` (Typen, Registry, `default` + `t3-demo`, `applyTheme` vor `app.mount()`), Auswahl via `VITE_THEME`. Brand-Tokens sind jetzt Rollennamen (`primarySoft`, `primaryAction`, `brandAccent`, `destructive` …) und leben nur im Theme. Details: `claude_docs/decisions/2026-white-label-theming.md`. **Offen:** `deployment` reicht `VITE_THEME` in den Compose-Dateien noch nicht durch (separates Issue); ohne Variable greift `default`.
- **2026-09-24 (CSS-Farbvariablen, frontend#13):** Alle Farben zentral in `src/styles/colors.css` (RGB-Kanäle), `tailwind.config.js` referenziert sie via `rgb(var(--color-…) / <alpha-value>)`; Guard-Test `tests/unit/styles/colors.spec.ts` verhindert neue Literale. Tailwind-`white` bleibt unberührt (Token `on-dark`).
- **2026-09-18 (Harness 2-Flow Reengineering):** `ci.yml` auf `dev`-Trunk umgestellt; Test Coverage Gate für `main` eingeführt; `CLAUDE.md` und `HANDOVER.md` standardisiert.
- **2026-09-17:** Security Audit Fixes (js-yaml, nanoid) über PR #3 gemergt.
