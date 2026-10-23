import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppLogo from '@/components/ui/AppLogo'

describe('AppLogo', () => {
  it('prefers an uploaded image over the catalog presentation', () => {
    render(<AppLogo name="JupyterHub" image="/up.png" />)
    expect(screen.getByRole('img', { name: 'JupyterHub' })).toHaveAttribute('src', '/up.png')
  })

  it('renders a masked logo for known apps without an image', () => {
    const { container } = render(<AppLogo name="GitLab" />)
    expect(container.querySelector('.app-logo-mask')).not.toBeNull()
    expect(container.querySelector('.app-logo')).toHaveAttribute('data-tone', 'orange')
  })

  it('renders a full-colour img for fullColor entries', () => {
    render(<AppLogo name="VS Code" />)
    expect(screen.getByRole('img', { name: 'VS Code' }).tagName).toBe('IMG')
  })

  it('falls back to an icon for unknown apps', () => {
    const { container } = render(<AppLogo name="Zzz" />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})
