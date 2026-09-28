import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Flat config. `vue-tsc` already covers types, so this deliberately does not
// re-check what the compiler checks. What it adds is the class of mistake a
// type-checker cannot see: a `<template>` that references something the
// `<script setup>` never declared, a `v-for` without `:key`, a mutated prop,
// an unreachable `v-if`/`v-else` pair, an unused import left behind by a
// refactor.
//
// Type-aware linting (`projectService`) is not enabled: it roughly triples
// the run time on this codebase and the rules it unlocks overlap heavily with
// what `vue-tsc -b --noEmit` already reports in CI.
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
  ...vue.configs['flat/recommended'],

  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
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

      // Single-word view names (DashboardView, AppsView) are the convention
      // here and match the router entries.
      'vue/multi-word-component-names': 'off',

      // Formatting is not this config's job; it would fight the existing
      // style for no benefit.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/v-on-event-hyphenation': 'off',
      'vue/first-attribute-linebreak': 'off',

      // Every v-html site here runs through DOMPurify (MarkdownRenderer,
      // the JSON highlighter). Left as a warning rather than off so a new
      // one still has to be looked at.
      'vue/no-v-html': 'warn',

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },

  // Tests run in a vitest environment with its globals enabled.
  {
    files: ['tests/**/*.ts', 'src/**/*.{test,spec}.ts'],
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
