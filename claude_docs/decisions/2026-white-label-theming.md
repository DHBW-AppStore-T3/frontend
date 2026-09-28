# Theme architecture

The frontend resolves `VITE_THEME` before mounting the app. Missing or unknown IDs select `t3`.
`applyTheme()` writes the color channels to the document root and updates the title and favicon.
The same active theme supplies the login branding and the shared login/dashboard image.

The current contract and extension steps are documented in [docs/themes.md](../../docs/themes.md).
