import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import VmResourceSliders from '../VmResourceSliders'
import { renderWithProviders } from '../../../../tests/helpers/render'

const choice = {
  container: 'vm',
  cpu: { default: '4', min: '2', max: '8' },
  memory: { default: '8Gi', min: '4Gi', max: '16Gi' },
}
const atDefault = { vm: { cpu: '4', memory: '8Gi' } }
const reset = 'deployment.vm.expert.reset'

describe('VmResourceSliders', () => {
  it('offers whole vCPUs and whole GB within the range of the app', () => {
    renderWithProviders(<VmResourceSliders choices={[choice]} value={atDefault} onChange={vi.fn()} />)
    const [cpu, memory] = screen.getAllByRole('slider')
    expect([cpu!.getAttribute('min'), cpu!.getAttribute('max'), cpu!.getAttribute('step')]).toEqual(['2000', '8000', '1000'])
    expect([memory!.getAttribute('min'), memory!.getAttribute('max'), memory!.getAttribute('step')]).toEqual(['4096', '16384', '1024'])
  })

  it('reads the values out in large numbers', () => {
    renderWithProviders(<VmResourceSliders choices={[choice]} value={atDefault} onChange={vi.fn()} />)
    expect(screen.getByTestId('cpu-vm')).toHaveTextContent('4')
    expect(screen.getByTestId('memory-vm')).toHaveTextContent('8')
  })

  it('has a notch per step and marks the recommendation once per slider', () => {
    renderWithProviders(<VmResourceSliders choices={[choice]} value={atDefault} onChange={vi.fn()} />)
    const cpuTicks = screen.getAllByTestId('tick-cpu-vm')
    const memoryTicks = screen.getAllByTestId('tick-memory-vm')
    expect(cpuTicks).toHaveLength(7)
    expect(memoryTicks).toHaveLength(13)
    const marked = (ticks: HTMLElement[]) => ticks.filter((t) => t.dataset.recommended === 'true')
    expect(marked(cpuTicks)).toHaveLength(1)
    expect(marked(cpuTicks)[0]).toHaveTextContent('4')
    expect(marked(cpuTicks)[0]).toHaveTextContent('deployment.vm.resources.recommendedTick')
    expect(marked(memoryTicks)).toHaveLength(1)
    expect(marked(memoryTicks)[0]).toHaveTextContent('8')
  })

  it('hides the notches from assistive technology', () => {
    renderWithProviders(<VmResourceSliders choices={[choice]} value={atDefault} onChange={vi.fn()} />)
    expect(screen.getAllByTestId('tick-cpu-vm')[0]!.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('says "recommended" in the spoken value only at the recommendation', () => {
    const first = renderWithProviders(<VmResourceSliders choices={[choice]} value={atDefault} onChange={vi.fn()} />)
    expect(screen.getAllByRole('slider')[0]!.getAttribute('aria-valuetext')).toContain('recommendedValue')
    first.unmount()
    renderWithProviders(<VmResourceSliders choices={[choice]} value={{ vm: { cpu: '6', memory: '8Gi' } }} onChange={vi.fn()} />)
    expect(screen.getAllByRole('slider')[0]!.getAttribute('aria-valuetext')).not.toContain('recommendedValue')
    expect(screen.getAllByRole('slider')[1]!.getAttribute('aria-valuetext')).toContain('recommendedValue')
  })

  it('reports a new choice in the notation of the appstore.yaml', () => {
    const onChange = vi.fn()
    renderWithProviders(<VmResourceSliders choices={[choice]} value={atDefault} onChange={onChange} />)
    const [cpu, memory] = screen.getAllByRole('slider')
    fireEvent.change(cpu!, { target: { value: '6000' } })
    expect(onChange).toHaveBeenLastCalledWith({ vm: { cpu: '6', memory: '8Gi' } })
    fireEvent.change(memory!, { target: { value: '12288' } })
    expect(onChange).toHaveBeenLastCalledWith({ vm: { cpu: '4', memory: '12Gi' } })
  })

  it('turns a number red once it differs from the recommendation', () => {
    renderWithProviders(<VmResourceSliders choices={[choice]} value={{ vm: { cpu: '6', memory: '8Gi' } }} onChange={vi.fn()} />)
    expect(screen.getByTestId('dial-cpu-vm')).toHaveAttribute('data-changed', 'true')
    expect(screen.getByTestId('dial-memory-vm')).toHaveAttribute('data-changed', 'false')
  })

  it('offers "reset" only when something differs, and restores the recommendation', () => {
    const onChange = vi.fn()
    const first = renderWithProviders(<VmResourceSliders choices={[choice]} value={atDefault} onChange={onChange} />)
    expect(screen.queryByRole('button', { name: reset })).toBeNull()
    first.unmount()
    renderWithProviders(<VmResourceSliders choices={[choice]} value={{ vm: { cpu: '6', memory: '12Gi' } }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: reset }))
    expect(onChange).toHaveBeenCalledWith({ vm: { cpu: '4', memory: '8Gi' } })
  })

  it('gives the focus back to the first slider after a reset', () => {
    renderWithProviders(<VmResourceSliders choices={[choice]} value={{ vm: { cpu: '6', memory: '8Gi' } }} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: reset }))
    expect(screen.getAllByRole('slider')[0]).toHaveFocus()
  })

  it('adds up what all people get together', () => {
    renderWithProviders(
      <VmResourceSliders choices={[choice]} value={{ vm: { cpu: '6', memory: '12Gi' } }} onChange={vi.fn()} people={3} />,
    )
    const total = screen.getByTestId('vm-total')
    expect(total).toHaveTextContent('18')
    expect(total).toHaveTextContent('36')
  })

  it('shows no total without a number of people', () => {
    renderWithProviders(<VmResourceSliders choices={[choice]} value={atDefault} onChange={vi.fn()} />)
    expect(screen.queryByTestId('vm-total')).toBeNull()
  })

  it('writes the total in German, for one person and for several', () => {
    const one = renderWithProviders(
      <VmResourceSliders choices={[choice]} value={atDefault} onChange={vi.fn()} people={1} />,
      { realI18n: true },
    )
    expect(screen.getByTestId('vm-total')).toHaveTextContent(/Insgesamt für 1 Person\b(?!en)/)
    one.unmount()
    renderWithProviders(<VmResourceSliders choices={[choice]} value={atDefault} onChange={vi.fn()} people={3} />, {
      realI18n: true,
    })
    expect(screen.getByTestId('vm-total')).toHaveTextContent('Insgesamt für 3 Personen')
  })
})
