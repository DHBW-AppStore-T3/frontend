import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthLayout from '@/layouts/AuthLayout'
import AppLayout from '@/layouts/AppLayout'
import { applyTheme } from '@/theme/applyTheme'
import { THEMES } from '@/theme'
import i18n from '@/i18n'
import { renderWithProviders } from '../../helpers/render'

function renderLayout(Layout: typeof AuthLayout | typeof AppLayout) {
  return renderWithProviders(
    <Layout>
      <p>content</p>
    </Layout>,
    { realI18n: true },
  )
}

describe('layout branding', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de')
  })

  afterEach(() => vi.restoreAllMocks())

  it('keeps the English phrase together when switching languages, even with blocked storage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    const { container } = renderLayout(AuthLayout)
    const title = () => container.querySelector('.auth-title') as HTMLElement

    await userEvent.click(screen.getByTestId('locale-en'))
    expect([...title().querySelectorAll('span')].map((line) => line.textContent)).toEqual([
      'Deploy',
      'applications with',
      'ease',
    ])
    expect(title()).toHaveClass('auth-title--fixed-lines')

    await userEvent.click(screen.getByTestId('locale-de'))
    expect(title().textContent).toContain('Anwendungen einfach')
    expect(title()).not.toHaveClass('auth-title--fixed-lines')
  })

  for (const [id, theme] of Object.entries(THEMES)) {
    it(`AuthLayout renders the active theme (${id})`, () => {
      applyTheme(theme)
      const { container } = renderLayout(AuthLayout)
      const html = container.innerHTML
      expect(html).toContain(theme.authLogo?.src ?? theme.logo.src)
      expect(html).toContain(theme.brand.name)
      expect(html).toContain(theme.brand.tagline)
      expect(html).toContain(theme.loginBackground!)
    })

    it(`AppLayout logo comes from theme ${id}`, () => {
      applyTheme(theme)
      const { container } = renderLayout(AppLayout)
      const img = container.querySelector('aside img')
      expect(img).toHaveAttribute('src', theme.logo.src)
      expect(img).toHaveAttribute('alt', theme.logo.alt)
    })
  }

  it('AuthLayout renders its children inside the main area', () => {
    const { container } = renderLayout(AuthLayout)
    expect(container.querySelector('.auth-main')?.textContent).toContain('content')
  })
})
