import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import CredentialMissingBanner from '@/components/CredentialMissingBanner'
import { renderWithProviders } from '../../helpers/render'

describe('CredentialMissingBanner', () => {
  it('renders title and message', () => {
    renderWithProviders(<CredentialMissingBanner title="T" message="M" />)
    expect(screen.getByText('T')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it.each([
    ['warning', 'bg-amber-50'],
    ['error', 'bg-dangerTint'],
    ['lock', 'bg-infoTint'],
  ] as const)('applies the %s palette', (variant, cls) => {
    const { container } = renderWithProviders(<CredentialMissingBanner variant={variant} title="x" />)
    expect(container.firstElementChild).toHaveClass(cls)
  })

  it('defaults to the warning variant', () => {
    const { container } = renderWithProviders(<CredentialMissingBanner title="x" />)
    expect(container.firstElementChild).toHaveClass('bg-amber-50')
  })

  it('renders the CTA link only with both cta and ctaTo', () => {
    const { rerender } = renderWithProviders(<CredentialMissingBanner cta="Go" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    rerender(<CredentialMissingBanner ctaTo="/user/openstack" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('links to ctaTo, adding ?next= when provided', () => {
    const { unmount } = renderWithProviders(<CredentialMissingBanner cta="Go" ctaTo="/user/openstack" />)
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/user/openstack')
    unmount()

    renderWithProviders(<CredentialMissingBanner cta="Go" ctaTo="/user/openstack" next="/apps/1" />)
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/user/openstack?next=%2Fapps%2F1')
  })
})
