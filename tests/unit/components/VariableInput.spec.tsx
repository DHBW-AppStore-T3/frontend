import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const picker = vi.hoisted(() => ({ props: null as any }))
vi.mock('@/components/OpenStackResourcePicker', () => ({
  default: (props: any) => {
    picker.props = props
    return <div data-testid="os-picker" />
  },
}))

import VariableInput from '@/components/VariableInput'
import { renderWithProviders } from '../../helpers/render'

const variable = (over: Record<string, unknown> = {}) =>
  ({ name: 'size', type: 'string', source: 'terraform', ...over }) as any

describe('VariableInput', () => {
  it('renders a text input for strings, with the default as placeholder', async () => {
    const onChange = vi.fn()
    renderWithProviders(<VariableInput variable={variable({ default: 'abc' })} value="" onChange={onChange} />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('placeholder', 'variableInput.defaultPlaceholder')
    await userEvent.type(input, 'x')
    expect(onChange).toHaveBeenCalledWith('x')
  })

  it('uses the variable name as id unless inputId is given', () => {
    const { unmount } = renderWithProviders(<VariableInput variable={variable()} value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'size')
    unmount()
    renderWithProviders(<VariableInput variable={variable()} value="" onChange={() => {}} inputId="size-team-1" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'size-team-1')
  })

  it.each(['number', 'int', 'integer'])('renders a numeric input for %s and emits a number', (type) => {
    const onChange = vi.fn()
    renderWithProviders(<VariableInput variable={variable({ type })} value={1} onChange={onChange} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } })

    expect(onChange).toHaveBeenCalledWith(7)
  })

  it.each(['bool', 'boolean'])('renders a toggle for %s', async (type) => {
    const onChange = vi.fn()
    renderWithProviders(<VariableInput variable={variable({ type })} value={false} onChange={onChange} />)

    expect(screen.getByText('variableInput.off')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('shows the on label for a true boolean', () => {
    renderWithProviders(<VariableInput variable={variable({ type: 'bool' })} value onChange={() => {}} />)
    expect(screen.getByText('variableInput.on')).toBeInTheDocument()
  })

  it.each(['list(string)', 'set(string)', 'array'])('renders a textarea for %s', (type) => {
    renderWithProviders(<VariableInput variable={variable({ type })} value="a" onChange={() => {}} />)
    expect(screen.getByPlaceholderText('variableInput.listPlaceholder').tagName).toBe('TEXTAREA')
  })

  it('applies the accent colours', () => {
    const { unmount } = renderWithProviders(<VariableInput variable={variable()} value="" onChange={() => {}} accent="purple" />)
    expect(screen.getByRole('textbox').className).toContain('border-purple-200')
    unmount()
    renderWithProviders(<VariableInput variable={variable()} value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox').className).toContain('border-info/30')
  })

  it('disables the field', () => {
    renderWithProviders(<VariableInput variable={variable()} value="" onChange={() => {}} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  describe('OpenStack pickers', () => {
    it('delegates to the picker with mode, multi and free text', () => {
      renderWithProviders(
        <VariableInput
          variable={variable({ osType: 'flavor', osMode: 'id', osMulti: true })}
          value={['a']}
          onChange={() => {}}
        />,
      )

      expect(screen.getByTestId('os-picker')).toBeInTheDocument()
      expect(picker.props).toMatchObject({ osType: 'flavor', osMode: 'id', multi: true, allowFreeText: true, value: ['a'] })
    })

    it('defaults to name mode and only filters subnets by network', () => {
      renderWithProviders(
        <VariableInput variable={variable({ osType: 'subnet' })} value="" filterNetworkId="net-1" onChange={() => {}} />,
      )
      expect(picker.props).toMatchObject({ osMode: 'name', filterNetworkId: 'net-1' })

      renderWithProviders(
        <VariableInput variable={variable({ osType: 'flavor' })} value="" filterNetworkId="net-1" onChange={() => {}} />,
      )
      expect(picker.props.filterNetworkId).toBeNull()
    })

    it('never renders a picker for file variables', () => {
      renderWithProviders(<VariableInput variable={variable({ osType: 'file' })} value="" onChange={() => {}} />)
      expect(screen.queryByTestId('os-picker')).not.toBeInTheDocument()
    })
  })

  describe('enum (pod apps: one of the values appstore.yaml declares)', () => {
    const enumVar = (over: Record<string, unknown> = {}) => variable({ osType: 'enum', values: ['s', 'm', 'l'], ...over })

    it('is a select over the declared values, not an OpenStack picker', () => {
      renderWithProviders(<VariableInput variable={enumVar({ default: 'm' })} value="m" onChange={() => {}} />)

      const select = screen.getByTestId('enum-input') as HTMLSelectElement
      expect(Array.from(select.options).map((o) => o.text)).toEqual(['s', 'm', 'l'])
      expect(select.value).toBe('m')
      expect(screen.queryByTestId('os-picker')).not.toBeInTheDocument()
    })

    it('emits the chosen value', async () => {
      const onChange = vi.fn()
      renderWithProviders(<VariableInput variable={enumVar({ default: 'm' })} value="m" onChange={onChange} />)

      await userEvent.selectOptions(screen.getByTestId('enum-input'), 'l')

      expect(onChange).toHaveBeenCalledWith('l')
    })

    it('without a default it asks for a choice first', () => {
      renderWithProviders(<VariableInput variable={enumVar({ values: ['a', 'b'] })} value="" onChange={() => {}} />)

      const first = (screen.getByTestId('enum-input') as HTMLSelectElement).options[0]!
      expect(first.text).toBe('variableInput.choose')
      expect(first.disabled).toBe(true)
    })

    it('can be disabled', () => {
      renderWithProviders(<VariableInput variable={enumVar()} value="" onChange={() => {}} disabled />)

      expect(screen.getByTestId('enum-input')).toBeDisabled()
    })
  })
})
