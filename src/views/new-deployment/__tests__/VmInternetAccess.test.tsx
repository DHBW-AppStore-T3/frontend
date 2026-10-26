import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import VmInternetAccess from '../VmInternetAccess'
import { renderWithProviders } from '../../../../tests/helpers/render'

const base = {
  scope: 'user',
  studentIds: ['u1', 'u2'],
  groupNames: [],
  groupCount: 0,
  networkChoices: { internet: { default: true }, podNetwork: { default: false } },
  network: { internet: true, podNetwork: false },
} as any

const label = 'deployment.vm.internet.label'

describe('VmInternetAccess', () => {
  it('renders nothing when the app does not release internet access', () => {
    const { container } = renderWithProviders(
      <VmInternetAccess draft={{ ...base, networkChoices: { podNetwork: { default: false } }, network: {} }} onChange={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the switch right away, at the default of the app', () => {
    renderWithProviders(<VmInternetAccess draft={base} onChange={vi.fn()} />)
    expect(screen.getByTestId('vm-internet-access')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: label })).toHaveAttribute('aria-checked', 'true')
  })

  it('follows the default of the app when nothing was chosen yet', () => {
    renderWithProviders(
      <VmInternetAccess draft={{ ...base, networkChoices: { internet: { default: false } }, network: {} }} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('switch', { name: label })).toHaveAttribute('aria-checked', 'false')
  })

  it('says what the choice means: allowed, with a caution', () => {
    renderWithProviders(<VmInternetAccess draft={base} onChange={vi.fn()} />)
    expect(screen.getByTestId('vm-internet-state')).toHaveTextContent('deployment.vm.internet.stateOn')
    const note = screen.getByTestId('vm-internet-note')
    expect(note).toHaveTextContent('deployment.vm.internet.noteOn')
    expect(note).toHaveAttribute('data-tone', 'warn')
    expect(note).toHaveAttribute('role', 'status')
  })

  it('says what the choice means: blocked, calmly', () => {
    renderWithProviders(<VmInternetAccess draft={{ ...base, network: { internet: false, podNetwork: false } }} onChange={vi.fn()} />)
    expect(screen.getByTestId('vm-internet-state')).toHaveTextContent('deployment.vm.internet.stateOff')
    const note = screen.getByTestId('vm-internet-note')
    expect(note).toHaveTextContent('deployment.vm.internet.noteOff')
    expect(note).toHaveAttribute('data-tone', 'calm')
  })

  it('reports the change and keeps the other setting', () => {
    const onChange = vi.fn()
    renderWithProviders(<VmInternetAccess draft={{ ...base, network: { internet: true, podNetwork: true } }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: label }))
    expect(onChange).toHaveBeenCalledWith({ internet: false, podNetwork: true })
  })
})
