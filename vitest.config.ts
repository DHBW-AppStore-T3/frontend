import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['tests/setup.ts'],
    // Node 22–24: --no-experimental-webstorage suppresses the broken global
    // localStorage stub. On Node 25+ the stub is gone without the flag, but
    // tests/setup.ts patches localStorage unconditionally, so all Node
    // versions get a working in-memory store regardless.
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
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
