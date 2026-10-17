// @vitest-environment jsdom
// DOMPurify needs a spec-complete DOM; happy-dom drops tags and keeps handlers.
import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { renderWithProviders } from '../../helpers/render'

describe('MarkdownRenderer', () => {
  afterEach(() => {
    delete (HTMLElement.prototype as any).scrollHeight
  })

  it('renders nothing for empty or whitespace-only source', () => {
    const { container, rerender } = renderWithProviders(<MarkdownRenderer source={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<MarkdownRenderer source="   " />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders markdown to HTML (headings, emphasis, lists)', () => {
    const { container } = renderWithProviders(
      <MarkdownRenderer source={'# Title\n\n**bold** and *it*\n\n- a\n- b'} />,
    )
    expect(container.querySelector('h1')?.textContent).toBe('Title')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('sanitises dangerous markup', () => {
    const { container } = renderWithProviders(
      <MarkdownRenderer source={'hi <img src=x onerror="alert(1)"> <script>alert(2)</script>'} />,
    )
    expect(container.innerHTML).not.toContain('onerror')
    expect(container.querySelector('script')).toBeNull()
  })

  it('uses prose styling for the full variant', () => {
    const { container } = renderWithProviders(<MarkdownRenderer source="x" />)
    expect(container.querySelector('.prose')).not.toBeNull()
  })

  it('collapses headings and code blocks in the compact variant', () => {
    const { container } = renderWithProviders(
      <MarkdownRenderer variant="compact" source={'# Big\n\n```\ncode\n```'} />,
    )
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('Big')
    expect(container.querySelector('pre')).toBeNull()
    expect(container.querySelector('code')?.textContent).toContain('code')
    expect(container.querySelector('.prose')).toBeNull()
  })

  it('escapes html inside compact headings', () => {
    const { container } = renderWithProviders(
      <MarkdownRenderer variant="compact" source={'# <b>x</b>'} />,
    )
    expect(container.querySelector('strong')?.innerHTML).not.toContain('<b>')
  })

  it('clamps via inline style when clamp > 0', () => {
    const { container } = renderWithProviders(<MarkdownRenderer source="x" clamp={3} />)
    const content = container.querySelector('.prose') as HTMLElement
    expect(content.style.webkitLineClamp).toBe('3')
    expect(content.style.overflow).toBe('hidden')
  })

  it('does not clamp by default', () => {
    const { container } = renderWithProviders(<MarkdownRenderer source="x" />)
    expect((container.querySelector('.prose') as HTMLElement).style.overflow).toBe('')
  })

  it('shows a toggle only when the content is truncated, and expands on click', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 200 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 40 })

    const { container } = renderWithProviders(
      <MarkdownRenderer source="long text" clamp={2} expandable />,
    )
    const toggle = await screen.findByRole('button', { name: 'markdownRenderer.more' })

    await userEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'markdownRenderer.less' })).toBeInTheDocument()
    expect((container.querySelector('.prose') as HTMLElement).style.overflow).toBe('')

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 0 })
  })

  it('shows no toggle when the content fits', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, value: 40 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 40 })

    renderWithProviders(<MarkdownRenderer source="short" clamp={2} expandable />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 0 })
  })
})
