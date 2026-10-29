import { defineConfig } from '@playwright/test'

// E2E smoke tests (issue 149), see e2e/README.md. Not part of the CI workflow.
//
// Default: starts the Vite dev server and runs against it with a fully mocked API
// (hermetic, no account, no network). With E2E_BASE_URL set, only the tests that need
// no login run, against that deployment (e.g. Staging).
const baseURL = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: baseURL ?? 'http://localhost:5173',
    // The browser of the machine; `E2E_CHANNEL=chromium` uses the one `npx playwright install` fetches.
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: baseURL
    ? undefined
    : {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 60_000,
      },
})
