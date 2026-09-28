# Frontend themes

`src/theme/types.ts` defines the `Theme` contract and `THEME_COLOR_KEYS`. Every registered theme supplies all listed RGB channel triples (`"226 0 26"`), a brand name/title, a main logo, and a favicon. A separate `authLogo` and `loginBackground` are optional; the main logo is used on the login page when `authLogo` is absent. The dashboard uses `loginBackground` when present.

Global radius, shadow, spacing, and typography scales live in `src/styles/tokens.css`. Theme colors live in each `src/theme/themes/<id>.ts`; product icon brand colors remain in `src/styles/colors.css`; status and semantic colors are theme tokens. Layout-specific geometry lives in `src/theme/auth.css` and `src/theme/workspace.css`. Views use the color roles through Tailwind or `--color-*` variables.

To add a theme:

1. Copy `src/theme/themes/t3.ts` to `src/theme/themes/<id>.ts`; set a new `id`, branding, and every required color channel. Keep image assets in `src/theme/assets/` and the favicon in `public/themes/<id>/`.
2. Import and register it in `THEMES` in `src/theme/index.ts`.
3. Select it locally with `VITE_THEME=<id> npm run dev` (PowerShell: `$env:VITE_THEME='<id>'; npm run dev`). In a container, pass `VITE_THEME=<id>`; `env-config.js` receives it at startup.
4. Run `npm run lint`, `npx vue-tsc -b --noEmit`, `npm run test`, and `npm run build`.

For example, a new campus theme could use `id: 'campus'`, its own logo/background/favicon, and `colors: { ...t3Theme.colors, primary: '0 85 140', 'primary-dark': '0 65 110' }`. Replace all inherited colors that should differ. Register `campusTheme` under its ID. No view changes are needed.

Without `VITE_THEME`, `t3` is selected. Unknown IDs also select `t3` and log a warning. There are no compatibility aliases.
