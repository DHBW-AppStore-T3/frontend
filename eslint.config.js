import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'

// Flat config. `tsc -b` already covers types; ESLint adds what a type-checker
// cannot see, notably the rules of hooks and effect dependency arrays.
// Type-aware linting (`projectService`) is not enabled: it roughly triples
// the run time and overlaps with what `tsc -b --noEmit` reports in CI.
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.d.ts',
      'src/__snapshots__/**',
      // Runtime config written by docker-entrypoint.sh, not source.
      'public/**',
      // Generated from the backend schema; see README.
      'src/types/api.generated.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,


  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // `_`-prefixed names are the established opt-out for a binding that
      // exists for its position (destructuring, catch params) rather than
      // its value.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      // An explicit `any` switches the type checker off for whatever flows
      // through it. The API types come from the OpenAPI schema now, so production
      // code has no reason left for one: use a real type, or `unknown` and narrow
      // it. A line that truly needs `any` gets an `eslint-disable-next-line` with
      // the reason, like the `no-restricted-syntax` exceptions below.
      '@typescript-eslint/no-explicit-any': 'error',

      ...reactHooks.configs.recommended.rules,

      // Stored XSS (.github#7 J): a message with a user-controlled parameter
      // never goes into HTML (use `BoldSlot` or plain text). The few sites that
      // remain (DOMPurify'd Markdown, the escaping JSON highlighter, static
      // translations) are allowed one by one, with a reason.
      'no-restricted-syntax': ['error', {
        selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        message: 'Raw HTML needs a reason: sanitise it and allow this one line with an eslint-disable comment.',
      }],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },

  // Accessibility (#141, #154). The plugin's `recommended` set, including the
  // three rules about click handlers on non-interactive elements. Cards and rows
  // are real buttons or `role="checkbox"` now. What remains is allowed one by
  // one with a reason next to the line: mouse shortcuts next to a keyboard path
  // (backdrops, toast card, label focus) and pointer-only drag-and-drop targets.
  //
  // eslint-plugin-jsx-a11y 6.10 lists ESLint up to ^9 as a peer, so package.json
  // carries an `overrides` entry to let `npm ci` resolve it next to ESLint 10.
  // It runs (tests/unit/infra/eslint-a11y.spec.ts lints fixtures and expects the
  // rules to fire), but this combination is not covered by the plugin's own
  // tests: re-check on every ESLint or plugin upgrade.
  //
  // `label-has-associated-control` only sees literal label text: it stays
  // silent on `<label>{t('key')}</label>`, which is every label here. The
  // form specs (`getByLabelText`) are what guards the label wiring.
  {
    files: ['src/**/*.tsx'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/label-has-associated-control': ['error', {
        controlComponents: ['BaseInput', 'MarkdownEditor'],
        depth: 3,
      }],
    },
  },

  // Tests run in a vitest environment with its globals enabled. They keep `any`
  // allowed on purpose: specs build partial fixtures, stores and mocks and feed
  // the code deliberately malformed values, which would need a cast per line.
  // The rule protects production code only.
  {
    files: ['tests/**/*.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Build tooling runs in Node.
  {
    files: ['*.config.{ts,js}', 'vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
)
