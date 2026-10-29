import { test, expect, type Page } from '@playwright/test'

// Keyboard and toast behaviour in a real browser (issue 154). Hermetic like smoke.spec.ts:
// dev sign-in bridge, every API answer from the test, GET only.
//
// What this proves: roles, keyboard operation, focus and timing. What it cannot prove is
// what a screen reader says; that needs NVDA / JAWS / VoiceOver by hand (see the issue).
test.skip(!!process.env.E2E_BASE_URL, 'needs the dev build with the sign-in bridge')

const API = /^http:\/\/localhost:8000\//
const course = { courseId: 'c1', name: 'Web Dev' }
const students = [
  { userId: 's1', username: 'ann', email: 'ann@example.org', role: 'student' },
  { userId: 's2', username: 'bob', email: 'bob@example.org', role: 'student' },
]

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
    if (request.method() !== 'GET') return respond({ detail: 'refused by the E2E mock' }, 405)
    if (path === '/users/me') {
      return respond({ userId: 'u-1', username: 'lehrer', email: 'l@example.org', role: 'teacher', created_at: '2026-01-01T00:00:00Z' })
    }
    if (/^\/courses\/c1\/?$/.test(path)) return respond({ ...course, users: students })
    if (path.startsWith('/courses')) return respond([course])
    return respond([])
  })
}

/** Signs in and moves to the first wizard step without a reload (a reload would run the guard before the role is known). */
async function openWizard(page: Page) {
  await mockApi(page)
  await page.goto('/dashboard?sso_handoff=l%40example.org')
  await expect(page).toHaveURL(/\/dashboard/)
  await page.waitForTimeout(500) // the profile answer replaces the stub student with the teacher
  await page.evaluate(() => {
    window.history.pushState({}, '', '/deployment/new/config')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByTestId('course-c1')).toBeVisible()
}

test('a course row is a checkbox that Space and Enter operate', async ({ page }) => {
  await openWizard(page)
  const row = page.getByRole('checkbox', { name: /Web Dev/ })

  await expect(row).toHaveAttribute('aria-checked', 'false')
  await row.focus()
  await page.keyboard.press('Space')
  await expect(row).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Enter')
  await expect(row).toHaveAttribute('aria-checked', 'false')
})

test('a toast is announced, waits while it holds focus, and gives focus back when closed', async ({ page }) => {
  await openWizard(page)

  // Next without a name: a warning toast, announced through the permanent assertive region.
  await page.getByTestId('btn-next').click()
  await expect(page.locator('.toast')).toHaveCount(1)
  await expect(page.getByTestId('toast-live-assertive')).not.toBeEmpty()

  // Focus inside the toast stops the 5 s timer (WCAG 2.2.1).
  await page.getByRole('button', { name: /schließen|close/i }).last().focus()
  await page.waitForTimeout(6500)
  await expect(page.locator('.toast')).toHaveCount(1)

  // Closing by keyboard sends focus back to where it came from, not to <body>.
  await page.keyboard.press('Enter')
  await expect(page.locator('.toast')).toHaveCount(0)
  await expect(page.getByTestId('btn-next')).toBeFocused()
})

test('a toast nobody touches goes away by itself', async ({ page }) => {
  await openWizard(page)
  await page.getByTestId('btn-next').click()
  await expect(page.locator('.toast')).toHaveCount(1)
  await page.mouse.move(2, 2)

  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 8000 })
})
