import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      // istanbul, not v8. The v8 provider reports coverage on the
      // compiled SFC output and remaps it back through source maps,
      // and for Vue `<script setup>` that remapping collapses the
      // whole setup body onto the module-level statements that run at
      // import time. The practical effect was that three views whose
      // entire test suites are `describe.skip` still reported 100%
      // line coverage -- 687 lines counted as covered purely because a
      // skipped spec file imported them. istanbul instruments the
      // source directly, so a file that is never mounted reads as
      // uncovered.
      provider: 'istanbul',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/**/*.{test,spec}.ts',
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
