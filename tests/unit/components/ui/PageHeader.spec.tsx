import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PageHeader from '@/components/ui/PageHeader'

describe('PageHeader', () => {
  it('renders the title as h1 and omits optional parts', () => {
    const { container } = render(<PageHeader title="Apps" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Apps' })).toBeInTheDocument()
    expect(container.querySelector('.page-subtitle')).toBeNull()
    expect(container.querySelector('.page-actions')).toBeNull()
  })

  it('renders subtitle and actions when provided', () => {
    render(<PageHeader title="Apps" subtitle="All apps" actions={<button>New</button>} />)
    expect(screen.getByText('All apps')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
  })

  it('never renders an eyebrow element', () => {
    // @ts-expect-error eyebrow is no longer part of PageHeaderProps
    const { container } = render(<PageHeader title="Apps" eyebrow="Catalog" subtitle="All apps" />)
    expect(container.querySelector('.page-eyebrow')).toBeNull()
    expect(screen.queryByText('Catalog')).toBeNull()
  })
})
