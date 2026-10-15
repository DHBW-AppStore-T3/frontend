import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScopeBadge from '@/components/ui/ScopeBadge'

describe('ScopeBadge', () => {
  it('shows "Pro Team" for team scope', () => {
    render(<ScopeBadge scope="team" />)
    expect(screen.getByText('Pro Team')).toBeInTheDocument()
  })

  it('shows "Pro User" for user scope', () => {
    render(<ScopeBadge scope="user" />)
    expect(screen.getByText('Pro User')).toBeInTheDocument()
  })

  it.each([['all'], [undefined]] as const)('renders nothing for %s', (scope) => {
    const { container } = render(<ScopeBadge scope={scope} />)
    expect(container).toBeEmptyDOMElement()
  })
})
