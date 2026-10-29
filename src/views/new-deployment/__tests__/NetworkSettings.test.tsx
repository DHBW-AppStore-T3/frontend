import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import NetworkSettings from '../NetworkSettings'

const base = {
  scope: null,
  studentIds: [],
  groupNames: ['A', 'B'],
  groupCount: 2,
  networkChoices: { internet: { default: false }, podNetwork: { default: true } },
  network: { internet: false, podNetwork: true },
} as any

describe('NetworkSettings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de')
  })

  it('renders nothing when the app allows nothing', () => {
    const { container } = render(<NetworkSettings draft={{ ...base, networkChoices: {}, network: {} }} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is closed by default and opens on click', () => {
    render(<NetworkSettings draft={base} onChange={vi.fn()} />)
    expect(screen.getByText('Experteneinstellungen')).toBeInTheDocument()
    expect(screen.queryByTestId('network-settings-body')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Experteneinstellungen/ }))
    expect(screen.getByTestId('network-settings-body')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /Experteneinstellungen/ })
    expect(button.getAttribute('aria-controls')).toBe(screen.getByTestId('network-settings-body').id)
  })

  it('starts the switches at the defaults', () => {
    render(<NetworkSettings draft={base} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Experteneinstellungen/ }))
    expect(screen.getByRole('switch', { name: 'Internetzugriff' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Vernetzte Pods' })).toHaveAttribute('aria-checked', 'true')
  })

  it('hides networked pods with fewer than two workloads', () => {
    render(<NetworkSettings draft={{ ...base, groupNames: ['A'], groupCount: 1 }} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Experteneinstellungen/ }))
    expect(screen.getByRole('switch', { name: 'Internetzugriff' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Vernetzte Pods' })).toBeNull()
  })

  it('warns when internet is switched on and reports the change', () => {
    const onChange = vi.fn()
    const { rerender } = render(<NetworkSettings draft={base} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Experteneinstellungen/ }))
    expect(screen.queryByTestId('network-internet-warning')).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'Internetzugriff' }))
    expect(onChange).toHaveBeenCalledWith({ internet: true, podNetwork: true })
    rerender(<NetworkSettings draft={{ ...base, network: { internet: true, podNetwork: true } }} onChange={onChange} />)
    expect(screen.getByTestId('network-internet-warning')).toBeInTheDocument()
  })
})
