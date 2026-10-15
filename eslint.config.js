import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
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

      // There are ~100 `any`s in this codebase, most of them forced by the
      // hand-maintained API types in src/types. Warn rather than error so the
      // gate lands when those types are generated from the OpenAPI schema
      // instead, not before.
      '@typescript-eslint/no-explicit-any': 'warn',

      ...reactHooks.configs.recommended.rules,

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },

  // Tests run in a vitest environment with its globals enabled.
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
