import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import ResourcePicker from '@/views/new-deployment/ResourcePicker'
import { renderWithProviders } from '../../helpers/render'

const choice = {
  container: 'win',
  cpu: { default: '2', min: '1', max: '4' },
  memory: { default: '4Gi', min: '2Gi', max: '8Gi' },
}

describe('ResourcePicker', () => {
  it('zeigt die Defaults der App als Vorauswahl', () => {
    renderWithProviders(
      <ResourcePicker choices={[choice]} value={{ win: { cpu: '2', memory: '4Gi' } }} onChange={vi.fn()} />,
    )
    expect(screen.getByTestId('cpu-win')).toHaveTextContent(/2 vCPU|vcpu/)
    expect(screen.getByTestId('memory-win')).toHaveTextContent('4Gi')
  })

  it('meldet eine neue Auswahl in der Notation der appstore.yaml', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <ResourcePicker choices={[choice]} value={{ win: { cpu: '2', memory: '4Gi' } }} onChange={onChange} />,
    )
    const [cpu, memory] = screen.getAllByRole('slider')
    fireEvent.change(cpu!, { target: { value: '3500' } })
    expect(onChange).toHaveBeenLastCalledWith({ win: { cpu: '3500m', memory: '4Gi' } })
    fireEvent.change(memory!, { target: { value: '8192' } })
    expect(onChange).toHaveBeenLastCalledWith({ win: { cpu: '2', memory: '8Gi' } })
  })

  it('begrenzt die Regler auf den erlaubten Bereich', () => {
    renderWithProviders(<ResourcePicker choices={[choice]} value={{}} onChange={vi.fn()} />)
    const [cpu, memory] = screen.getAllByRole('slider')
    expect([cpu!.getAttribute('min'), cpu!.getAttribute('max')]).toEqual(['1000', '4000'])
    expect([memory!.getAttribute('min'), memory!.getAttribute('max')]).toEqual(['2048', '8192'])
  })
})
