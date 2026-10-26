import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ResourcePicker from '../ResourcePicker'
import type { ResourceChoice } from '@/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key} ${JSON.stringify(o)}` : key) }),
}))

const VM: ResourceChoice[] = [
  { container: 'vm', cpu: { default: '4', min: '2', max: '8' }, memory: { default: '8Gi', min: '4Gi', max: '16Gi' } },
]
const POD: ResourceChoice[] = [
  { container: 'ide', cpu: { default: '1', min: '500m', max: '2' }, memory: { default: '1Gi', min: '512Mi', max: '4Gi' } },
]

function sliders() {
  return { cpu: screen.getAllByRole('slider')[0] as HTMLInputElement, memory: screen.getAllByRole('slider')[1] as HTMLInputElement }
}

describe('ResourcePicker', () => {
  it('sizes a container in halves of a core and 512 MiB', () => {
    render(<ResourcePicker choices={POD} value={{ ide: { cpu: '1', memory: '1Gi' } }} onChange={() => {}} />)
    expect(sliders().cpu.step).toBe('500')
    expect(sliders().memory.step).toBe('512')
  })

  it('sizes a VM in whole vCPUs and whole GiB', () => {
    render(<ResourcePicker vm choices={VM} value={{ vm: { cpu: '4', memory: '8Gi' } }} onChange={() => {}} />)
    expect(sliders().cpu).toMatchObject({ min: '2000', max: '8000', step: '1000' })
    expect(sliders().memory).toMatchObject({ min: '4096', max: '16384', step: '1024' })
  })

  it('reports the choice of a VM in the notation the API expects', () => {
    const onChange = vi.fn()
    render(<ResourcePicker vm choices={VM} value={{ vm: { cpu: '4', memory: '8Gi' } }} onChange={onChange} />)

    fireEvent.change(sliders().cpu, { target: { value: '6000' } })
    expect(onChange).toHaveBeenLastCalledWith({ vm: { cpu: '6', memory: '8Gi' } })
    fireEvent.change(sliders().memory, { target: { value: '12288' } })
    expect(onChange).toHaveBeenLastCalledWith({ vm: { cpu: '4', memory: '12Gi' } })
  })
})
