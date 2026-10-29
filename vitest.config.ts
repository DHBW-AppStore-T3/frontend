import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Playwright specs (npm run e2e) are not unit tests.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    // Node 22+ ships an experimental global `localStorage` that is unusable
    // without `--localstorage-file` (it has no `.clear`/`.setItem` etc.) and
    // shadows happy-dom's working `window.localStorage`. Disable it so tests
    // get happy-dom's implementation instead of Node's broken stub.
    // (Vitest 4 removed `poolOptions`; `execArgv` is a top-level option now.)
    execArgv: ['--no-experimental-webstorage'],
    coverage: {
      // istanbul instruments the source directly, so a file that is never
      // rendered by any test reads as uncovered (the v8 provider can report
      // such files as covered via source-map remapping).
      provider: 'istanbul',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/main.ts',
        'src/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: [
      // Exactly `@/i18n`: the app instance with both languages registered (#148).
      { find: /^@\/i18n$/, replacement: path.resolve(__dirname, 'tests/helpers/i18n-eager.ts') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
})
