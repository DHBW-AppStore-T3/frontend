import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HelpView from '@/views/HelpView'
import i18n from '@/i18n'
import en from '@/i18n/locales/en'
import de from '@/i18n/locales/de'
import { renderWithProviders } from '../../helpers/render'

const locales = { en, de } as const

// The snapshot of the Vue version was replaced with explicit assertions: it
// pinned markup details (comment nodes, attribute order) rather than behaviour.
for (const [lng, msgs] of Object.entries(locales)) {
  describe(`HelpView (${lng})`, () => {
    let container: HTMLElement

    beforeEach(async () => {
      await i18n.changeLanguage(lng)
      container = renderWithProviders(<HelpView />, { realI18n: true }).container
    })

    it('renders main texts', () => {
      const text = container.textContent
      expect(text).toContain(msgs.HelpView.title)
      expect(text).toContain(msgs.HelpView.subtitle)
      expect(text).toContain(msgs.HelpView.quickHelp.step1)
      expect(text).toContain(msgs.HelpView.resources.frontendRepo)
    })

    it('renders no eyebrow above the heading', () => {
      expect(container.querySelector('.page-eyebrow')).toBeNull()
    })

    it('renders all quickHelp steps (5)', () => {
      expect(container.querySelectorAll('ol li')).toHaveLength(5)
    })

    it('contains resource links with correct hrefs, opened safely in a new tab', () => {
      for (const repo of ['frontend', 'backend', 'deployment', 'worker']) {
        const a = container.querySelector(`a[href="https://github.com/DHBW-AppStore-T3/${repo}"]`)
        expect(a).not.toBeNull()
        expect(a).toHaveAttribute('target', '_blank')
        expect(a!.getAttribute('rel')).toContain('noopener')
        expect(a!.getAttribute('rel')).toContain('noreferrer')
      }
    })

    it('renders the section icons', () => {
      for (const icon of ['lucide-circle-question-mark', 'lucide-layers', 'lucide-book-open']) {
        expect(container.querySelector(`.${icon}`)).not.toBeNull()
      }
    })

    it('renders three troubleshooting items', () => {
      const text = container.textContent
      for (const s of [
        msgs.HelpView.troubleshooting.item1,
        msgs.HelpView.troubleshooting.item2,
        msgs.HelpView.troubleshooting.item3,
      ]) {
        expect(text).toContain(s)
      }
    })

    it('does not render the removed filler texts', () => {
      const help = msgs.HelpView as Record<string, unknown>
      const quickHelp = msgs.HelpView.quickHelp as Record<string, unknown>
      expect(help.intro).toBeUndefined()
      expect(help.loggedInUsers).toBeUndefined()
      expect(quickHelp.pagesTitle).toBeUndefined()
      expect(container.textContent).not.toContain('HelpView.')
    })

    it('uses no red text', () => {
      expect(container.querySelector('.text-primary')).toBeNull()
    })

    it('has the page title as the single h1', () => {
      const h1 = container.querySelectorAll('h1')
      expect(h1).toHaveLength(1)
      expect(h1[0]!.textContent).toBe(msgs.HelpView.title)
    })
  })
}

describe('HelpView search', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de')
  })

  it('hides sections that do not match the query', async () => {
    const { container } = renderWithProviders(<HelpView />, { realI18n: true })
    const sections = () => [...container.querySelectorAll<HTMLElement>('details.help-section')]
    expect(sections().every((s) => s.style.display !== 'none')).toBe(true)

    await userEvent.type(screen.getByRole('searchbox'), 'zzz-no-such-text')

    expect(sections().every((s) => s.style.display === 'none')).toBe(true)
  })

  it('keeps matching sections visible, case-insensitively', async () => {
    const { container } = renderWithProviders(<HelpView />, { realI18n: true })

    await userEvent.type(screen.getByRole('searchbox'), de.workspace.help.support.toUpperCase())

    const sections = [...container.querySelectorAll<HTMLElement>('details.help-section')]
    expect(sections.filter((s) => s.style.display !== 'none')).toHaveLength(1)
  })
})

describe('HelpView locale parity', () => {
  const paths = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? paths(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    )

  it('en and de have same HelpView key paths', () => {
    expect(paths(en.HelpView).sort()).toEqual(paths(de.HelpView).sort())
  })
})
