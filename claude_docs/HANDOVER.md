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

- **2026-09-28 (T3-Redesign, frontend#21):** Drei-Phasen-Redesign auf einem Feature-Branch, ein
  finaler PR gegen `dev`. **Phase 1:** `src/styles/tokens.css` (Radius/Shadow/Spacing/Typografie,
  theme-unabhängig), Tailwind-Bindung dafür in `tailwind.config.js`, Allowlist-Guardrail gegen
  arbitrary Radius/Shadow-Werte, kontextbezogene WCAG-Kontrastprüfung für Status-Farben
  (`tests/unit/styles/contrast.helper.ts`), `t3` as the canonical and default theme,
  in `src/theme/index.ts`, `resolveTheme()`-Fallback jetzt `t3` for missing and unknown selections). **Phase 2:**
  `BaseButton` (primary/secondary/outline/text/destructive), `BaseInput`-Fokusring auf
  `primaryAction`, `Card`/`Toast`/`EntityListState` auf Radius/Shadow-Tokens, `Badge` konsolidiert
  (neutral/success/warning/danger/info/brand + `bordered`), `ScopeBadge`/`AppVersionStatusBadge`
  jetzt dünne Wrapper, `useOverlay.ts` (Focus-Trap/Escape/Scroll-Lock/Fokus-Rückgabe) aus `Modal.vue`
  extrahiert, neue `Drawer.vue` darauf aufgebaut, `AppLayout.vue` in `AppSidebar.vue`/`AppHeader.vue`
  aufgeteilt (Sidebar jetzt hell mit Primary-Akzent nur auf Aktiv-Item, `Drawer`-basierter
  Mobile-Modus < 768px, `.header-title` `position: fixed` durch Flex-Layout ersetzt). **Phase 3:**
  alle Views im Scope (Login bis Forbidden/Empty/Loading/Error) von rohen Tailwind-Paletten-Klassen
  auf die Farb-Tokens migriert, Fachverhalten unverändert. **Abweichungen vom Spec:** `useOverlay`
  war komplett neue Funktionalität (Modal hatte vorher keinen Focus-Trap/Escape/Scroll-Lock, nichts
  zum "Extrahieren"); `InfrastructureVmDrawer.vue`/`OpenStackResourcePicker.vue` bewusst nicht auf
  `Drawer`/`useOverlay` umgebaut (strukturell kein Overlay, nur Token-Migration); einige
  Nicht-Marken-Farbstellen (Quota-Balken in `useQuotas.ts`, JSON-Viewer-Syntax-Highlighting in
  `json-view.ts`, vereinzelte Status-Punkte) bleiben auf rohen Tailwind-Farben, da sie
  Werttyp-/Zustands-Unterscheidung statt Markenfarbe transportieren. Details:
  `claude_docs/decisions/2026-white-label-theming.md`.
- **2026-09-26 (White-Label-Theming, frontend#18):** `src/theme/` (Typen, Registry, `default` + `t3` as the canonical and default theme,
- **2026-09-24 (CSS-Farbvariablen, frontend#13):** Alle Farben zentral in `src/styles/colors.css` (RGB-Kanäle), `tailwind.config.js` referenziert sie via `rgb(var(--color-…) / <alpha-value>)`; Guard-Test `tests/unit/styles/colors.spec.ts` verhindert neue Literale. Tailwind-`white` bleibt unberührt (Token `on-dark`).
- **2026-09-18 (Harness 2-Flow Reengineering):** `ci.yml` auf `dev`-Trunk umgestellt; Test Coverage Gate für `main` eingeführt; `CLAUDE.md` und `HANDOVER.md` standardisiert.
- **2026-09-17:** Security Audit Fixes (js-yaml, nanoid) über PR #3 gemergt.
