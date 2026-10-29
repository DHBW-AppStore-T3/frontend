import { test, expect } from '@playwright/test'

// Smoke test of a deployed build that needs no account (issue 149): the sign-in page,
// the language switch and the hand-over to the identity provider. It signs in nowhere,
// so there is no credential in this repository and nothing on the server changes.
//
//   E2E_BASE_URL=https://<host> npm run e2e
test.skip(!process.env.E2E_BASE_URL, 'set E2E_BASE_URL to run it against a deployment')

test('the sign-in page renders and switches language', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByTestId('locale-de')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /anmelden/i })).toBeVisible()

  await page.getByTestId('locale-en').click()
  await expect(page.getByTestId('locale-en')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('locale-en')).toHaveAttribute('aria-pressed', 'true')
})

test('a foreign returnUrl is replaced and the sign-in is handed to the identity provider', async ({ page }) => {
  await page.goto(`/login?returnUrl=${encodeURIComponent('//evil.example')}`)
  // Stop at the hand-over: the identity provider is answered with an empty page, and the
  // tab goes back to the app to read what it stored for after the sign-in.
  let handedOver = ''
  await page.route('**/realms/**', (route) => {
    handedOver = route.request().url()
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>idp</title>' })
  })
  await page.locator('.login-button').click()
  await expect.poll(() => handedOver).toContain('/realms/')
  await page.goBack()

  expect(await page.evaluate(() => sessionStorage.getItem('returnUrl'))).toBe('/dashboard')
})
