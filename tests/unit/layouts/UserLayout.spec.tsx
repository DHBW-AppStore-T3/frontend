import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import UserLayout from '@/layouts/UserLayout'
import { renderWithProviders } from '../../helpers/render'

describe('UserLayout', () => {
  it('delegates to AppLayout and renders the children', () => {
    const { container } = renderWithProviders(
      <UserLayout>
        <p>user content</p>
      </UserLayout>,
    )
    expect(container.querySelector('.app-shell')).not.toBeNull()
    expect(screen.getByText('user content')).toBeInTheDocument()
  })
})
