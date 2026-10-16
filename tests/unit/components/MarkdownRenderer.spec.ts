// @vitest-environment jsdom
// DOMPurify does not work on happy-dom (see utils/markdown-html.ts).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

// App descriptions and READMEs are written by app owners and read by
// everybody, inside the AppStore's own page.
const render = (source: string) => mount(MarkdownRenderer, { props: { source } })

describe('MarkdownRenderer.vue', () => {
  it('renders Markdown, tables and task lists', () => {
    const wrapper = render('# Titel\n\n[Doku](https://docs.example.org/)\n\n| a | b |\n|:-:|--:|\n| 1 | 2 |\n\n- [x] fertig')

    expect(wrapper.find('h1').text()).toBe('Titel')
    expect(wrapper.find('a').attributes('href')).toBe('https://docs.example.org/')
    expect(wrapper.find('th').attributes('align')).toBe('center')
    expect(wrapper.find('input[type="checkbox"]').attributes()).toHaveProperty('disabled')
  })

  it('removes script and javascript: links', () => {
    const wrapper = render('<img src=x onerror="alert(1)"><script>alert(2)</script>[x](javascript:alert(3))')

    expect(wrapper.html()).not.toMatch(/onerror|<script|javascript:/i)
  })

  it('never gives a page opened from a link a handle on the AppStore window', () => {
    const wrapper = render('<a href="https://evil.example/" target="_blank" rel="opener">Doku</a>')

    const link = wrapper.find('a')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('cannot restyle or overlay the page around it', () => {
    const wrapper = render(
      '<style>body { display: none }</style>'
      + '<div style="position: fixed; inset: 0; z-index: 9999">Anmeldung abgelaufen</div>',
    )

    expect(wrapper.find('style').exists()).toBe(false)
    expect(wrapper.find('[style*="fixed"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Anmeldung abgelaufen')
  })

  it('renders no forms', () => {
    const wrapper = render(
      '<form action="/api/auth" method="post"><input name="password" type="password">'
      + '<textarea></textarea><select></select><button>Anmelden</button></form>',
    )

    for (const tag of ['form', 'textarea', 'select', 'button']) {
      expect(wrapper.find(`.prose ${tag}`).exists()).toBe(false)
    }
  })
})
