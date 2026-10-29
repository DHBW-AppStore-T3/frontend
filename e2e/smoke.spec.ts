import { test, expect, type Page } from '@playwright/test'

// Hermetic smoke test of the critical path: sign in -> list -> detail (issue 149).
//
// Sign-in is the dev bridge (`?sso_handoff=<email>`, only in the Vite dev build): it
// skips Keycloak, so no account and no secret is involved. Every API call is answered
// here; nothing leaves the machine, and only reading calls exist on this path.
// The real Keycloak redirect is covered by e2e/staging.spec.ts.
test.skip(!!process.env.E2E_BASE_URL, 'needs the dev build with the sign-in bridge')

const API = /^http:\/\/localhost:8000\//

const deployment = {
  deploymentId: 'dep-1',
  name: 'Smoke Lab',
  status: 'success',
  appId: 'app-1',
  releaseTag: 'v1',
  runtime: 'kubernetes',
  created_at: '2026-06-01T10:00:00Z',
  permissions: { owner_view: true, operate: true, member: false },
  actions: ['delete'],
  teams: [],
  userInputVar: null,
  outputs: null,
  latest_task: null,
}

async function mockApi(page: Page) {
  await page.route(API, (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const respond = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        body: JSON.stringify(body),
      })

    if (request.method() === 'OPTIONS') return respond({}, 204)
    // Reading only: anything that would change data is refused so a test can never do harm.
    if (request.method() !== 'GET') return respond({ detail: 'refused by the E2E mock' }, 405)

    if (path === '/users/me') {
      return respond({ userId: 'u-1', username: 'smoke', email: 'smoke@example.org', role: 'teacher', created_at: '2026-01-01T00:00:00Z' })
    }
    if (path === '/deployments/') return respond([deployment])
    if (path === '/deployments/dep-1') return respond(deployment)
    if (path === '/deployments/dep-1/resources') return respond({ resources: [], workloads: [], live: true })
    if (path === '/tasks/deployment/dep-1') {
      return respond([{ taskId: 't-1', deploymentId: 'dep-1', type: 'deploy', status: 'success', created_at: '2026-06-01T10:00:00Z', logs: null }])
    }
    return respond([])
  })
}

test('sign in, see the deployment in the list, open its detail page', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mockApi(page)

  // Sign in through the dev bridge; the profile answer makes the user a teacher.
  await page.goto('/dashboard?sso_handoff=smoke%40example.org')
  await expect(page).toHaveURL(/\/dashboard/)

  // Client-side navigation to the list, as a person would click the menu.
  await page.getByRole('link', { name: /deployments/i }).first().click()
  await expect(page).toHaveURL(/\/deployments$/)
  const card = page.getByRole('link', { name: /Smoke Lab/ })
  await expect(card).toBeVisible()
  await expect(card).toContainText(/success/i)

  await card.click()
  await expect(page).toHaveURL(/\/deployments\/dep-1$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Smoke Lab' })).toBeVisible()

  expect(errors).toEqual([])
})

test('the list is reachable and operable with the keyboard only', async ({ page }) => {
  await mockApi(page)
  await page.goto('/dashboard?sso_handoff=smoke%40example.org')
  await page.getByRole('link', { name: /deployments/i }).first().click()

  const card = page.getByRole('link', { name: /Smoke Lab/ })
  await card.focus()
  await expect(card).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/deployments\/dep-1$/)
})
