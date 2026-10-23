import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Card from '@/components/ui/Card'

describe('Card', () => {
  it('uses the shared surface and preserves content and caller attributes', () => {
    render(
      <Card className="catalog-card" aria-label="Application">
        <h2>JupyterLab</h2>
      </Card>,
    )
    const card = screen.getByLabelText('Application')
    expect(card).toHaveClass('ui-card')
    expect(card).toHaveClass('catalog-card')
    expect(screen.getByRole('heading', { name: 'JupyterLab' })).toBeInTheDocument()
  })
})
