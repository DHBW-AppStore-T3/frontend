import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'

import VariableInput from '@/components/VariableInput'
import { renderWithProviders } from '../../helpers/render'

// Characterization of what VariableInput shows and emits for every kind of value
// (frontend#89). Written against the code BEFORE the any -> typed refactor and kept
// unchanged afterwards. Results that look like quirks are marked "quirk"; none is a fix.

const variable = (over: Record<string, unknown> = {}) =>
  ({ name: 'size', type: 'string', source: 'terraform', ...over }) as any

// The component takes `any` today; the tests deliberately hand it unusual values.
const renderInput = (over: Record<string, unknown>, value: unknown, onChange: (v: unknown) => void = () => {}) =>
  renderWithProviders(<VariableInput variable={variable(over)} value={value as never} onChange={onChange} />)

describe('VariableInput characterization: what is shown', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    ['', ''],
    ['hello', 'hello'],
    [0, '0'],
    [5, '5'],
    [true, 'true'],
    [false, 'false'],
    [['a', 'b'], 'a,b'],
  ])('a text input shows %j as %j', (value, shown) => {
    renderInput({}, value)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(shown)
  })

  it.each([
    [null, ''],
    [undefined, ''],
    [0, '0'],
    [7, '7'],
    [-1.5, '-1.5'],
  ])('a number input shows %j as %j', (value, shown) => {
    renderInput({ type: 'number' }, value)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe(shown)
  })

  it.each([
    [null, ''],
    [undefined, ''],
    ['a, b', 'a, b'],
    [['a', 'b'], 'a,b'], // quirk: an array is shown with String(), not joined with ", "
  ])('a list textarea shows %j as %j', (value, shown) => {
    renderInput({ type: 'list(string)' }, value)
    expect((screen.getByPlaceholderText('variableInput.listPlaceholder') as HTMLTextAreaElement).value).toBe(shown)
  })

  it('an enum select shows the chosen value, and the first option for null when there is a default', () => {
    const over = { osType: 'enum', values: ['s', 'm'], default: 's' }
    const { unmount } = renderInput(over, 'm')
    expect((screen.getByTestId('enum-input') as HTMLSelectElement).value).toBe('m')
    unmount()
    renderInput(over, null)
    // with a default there is no placeholder option, so nothing matches and the first option shows
    expect((screen.getByTestId('enum-input') as HTMLSelectElement).value).toBe('s')
  })
})

describe('VariableInput characterization: booleans use truthiness', () => {
  const checked = () => screen.getByRole('switch').getAttribute('aria-checked')

  it.each([
    [true, 'true'],
    [1, 'true'],
    ['yes', 'true'],
    ['false', 'true'], // quirk: any non-empty string is on
    [[], 'true'], // quirk: even an empty array
    [false, 'false'],
    [0, 'false'],
    ['', 'false'],
    [null, 'false'],
    [undefined, 'false'],
  ])('shows %j as aria-checked=%s', (value, expected) => {
    renderInput({ type: 'bool' }, value)
    expect(checked()).toBe(expected)
    expect(screen.getByText(expected === 'true' ? 'variableInput.on' : 'variableInput.off')).toBeInTheDocument()
  })

  it.each([
    [true, false],
    ['false', false],
    [1, false],
    [false, true],
    ['', true],
    [0, true],
    [null, true],
    [undefined, true],
  ])('a click on %j emits %j (the negated truthiness)', (value, emitted) => {
    const onChange = vi.fn()
    renderInput({ type: 'boolean' }, value, onChange)

    fireEvent.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(emitted)
  })
})

describe('VariableInput characterization: numbers emit valueAsNumber', () => {
  const emitFor = (typed: string) => {
    const onChange = vi.fn()
    renderInput({ type: 'number' }, 1, onChange)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: typed } })
    return onChange
  }

  it.each([
    ['7', 7],
    ['0', 0],
    ['-3', -3],
    ['1.5', 1.5],
    ['1e2', 100],
  ])('typing %j emits the number %j', (typed, expected) => {
    const onChange = emitFor(typed)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(expected)
  })

  it('quirk: clearing the field emits NaN, not "" or null', () => {
    const onChange = emitFor('')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toBeNaN()
  })
})

describe('VariableInput characterization: text, list and enum emit strings', () => {
  it('a text input emits what was typed, untrimmed', () => {
    const onChange = vi.fn()
    renderInput({}, '', onChange)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  padded  ' } })
    expect(onChange).toHaveBeenCalledWith('  padded  ')
  })

  it('a list textarea emits the raw text, it does not split into an array', () => {
    const onChange = vi.fn()
    renderInput({ type: 'list(string)' }, '', onChange)
    fireEvent.change(screen.getByPlaceholderText('variableInput.listPlaceholder'), { target: { value: 'a, b,\n,c' } })
    expect(onChange).toHaveBeenCalledWith('a, b,\n,c')
  })

  it('an enum select emits the chosen option as a string', () => {
    const onChange = vi.fn()
    renderInput({ osType: 'enum', values: ['s', 'm', 'l'], default: 's' }, 's', onChange)
    fireEvent.change(screen.getByTestId('enum-input'), { target: { value: 'l' } })
    expect(onChange).toHaveBeenCalledWith('l')
  })

  it('an enum wins over the HCL type', () => {
    renderInput({ type: 'bool', osType: 'enum', values: ['x'], default: 'x' }, 'x')
    expect(screen.getByTestId('enum-input')).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('the HCL type is matched case-insensitively', () => {
    renderInput({ type: 'BOOL' }, true)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('a missing values array renders an enum without options', () => {
    renderInput({ osType: 'enum' }, '')
    expect(screen.getByTestId('enum-input').querySelectorAll('option').length).toBe(1) // only the placeholder
  })
})
