import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Badge from '@/components/ui/Badge'

const root = (c: HTMLElement) => c.firstElementChild as HTMLElement

describe('Badge', () => {
  it('defaults to the neutral variant', () => {
    const { container } = render(<Badge>x</Badge>)
    expect(root(container).className).toContain('bg-surfaceMuted')
  })

  it.each([
    ['success', 'bg-successTint'],
    ['warning', 'bg-warningTint'],
    ['danger', 'bg-dangerTint'],
    ['info', 'bg-infoTint'],
    ['brand', 'bg-brandAccentSoft'],
  ] as const)('renders the %s variant with its tint background', (variant, expectedClass) => {
    const { container } = render(<Badge variant={variant}>x</Badge>)
    expect(root(container).className).toContain(expectedClass)
  })

  it('adds a border when bordered is set', () => {
    const { container } = render(<Badge variant="success" bordered>x</Badge>)
    expect(root(container)).toHaveClass('border')
  })

  it('has no border by default', () => {
    const { container } = render(<Badge variant="success">x</Badge>)
    expect(root(container)).not.toHaveClass('border')
  })

  it('never uses raw Tailwind palette classes', () => {
    const { container } = render(<Badge variant="brand">x</Badge>)
    expect(root(container).className).not.toMatch(/\b(green|red|blue|purple|yellow|gray)-\d/)
  })
})
