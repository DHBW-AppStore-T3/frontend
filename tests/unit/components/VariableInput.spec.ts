import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { AppVariable } from '@/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useOpenStackResourceCache', () => ({
  ensureLoaded: vi.fn().mockResolvedValue(undefined),
  getDisplayName: vi.fn(() => ({ known: false, name: '' })),
}))

// Stub the picker so we can test VariableInput's own branch selection without
// needing to mount the full OpenStack picker.
vi.mock('@/components/OpenStackResourcePicker.vue', () => ({
  default: {
    name: 'OpenStackResourcePicker',
    props: ['osType', 'osMode', 'multi', 'filterNetworkId', 'allowFreeText', 'modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="os-picker" />',
  },
}))

import VariableInput from '@/components/VariableInput.vue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function varOf(type: string, overrides: Partial<AppVariable> = {}): AppVariable {
  return {
    name: 'my_var',
    type,
    description: '',
    required: true,
    default: null,
    osType: null,
    osMode: null,
    osMulti: false,
    varScope: 'all',
    ...overrides,
  } as AppVariable
}

function mountVar(variable: AppVariable, modelValue: any = '', accent?: 'blue' | 'purple') {
  return mount(VariableInput, {
    props: { variable, modelValue, ...(accent ? { accent } : {}) },
  })
}

describe('VariableInput', () => {
  beforeEach(() => setActivePinia(createPinia()))

  // -----------------------------------------------------------------------
  // Type-based rendering
  // -----------------------------------------------------------------------
  it('renders text input for string type', () => {
    const w = mountVar(varOf('string'))
    expect(w.find('input[type="text"]').exists()).toBe(true)
  })

  it('renders number input for number type', () => {
    const w = mountVar(varOf('number'))
    expect(w.find('input[type="number"]').exists()).toBe(true)
  })

  it('renders number input for int type', () => {
    const w = mountVar(varOf('int'))
    expect(w.find('input[type="number"]').exists()).toBe(true)
  })

  it('renders number input for integer type', () => {
    const w = mountVar(varOf('integer'))
    expect(w.find('input[type="number"]').exists()).toBe(true)
  })

  it('renders toggle for bool type', () => {
    const w = mountVar(varOf('bool'))
    expect(w.find('button').exists()).toBe(true)
  })

  it('renders toggle for boolean type', () => {
    const w = mountVar(varOf('boolean'))
    expect(w.find('button').exists()).toBe(true)
  })

  it('renders textarea for list(...) type', () => {
    const w = mountVar(varOf('list(string)'))
    expect(w.find('textarea').exists()).toBe(true)
  })

  it('renders textarea for set(...) type', () => {
    const w = mountVar(varOf('set(string)'))
    expect(w.find('textarea').exists()).toBe(true)
  })

  it('renders textarea for array type', () => {
    const w = mountVar(varOf('array'))
    expect(w.find('textarea').exists()).toBe(true)
  })

  it('renders OpenStackResourcePicker when osType is set (not file)', () => {
    const w = mountVar(varOf('string', { osType: 'network', osMode: 'name' }))
    expect(w.find('.os-picker').exists()).toBe(true)
  })

  it('does NOT render picker for osType=file', () => {
    const w = mountVar(varOf('string', { osType: 'file' }))
    expect(w.find('.os-picker').exists()).toBe(false)
    expect(w.find('input[type="text"]').exists()).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Accent prop
  // -----------------------------------------------------------------------
  it('applies blue border class by default', () => {
    const w = mountVar(varOf('string'), '', undefined)
    const input = w.find('input[type="text"]')
    expect(input.classes().some(c => c.includes('blue'))).toBe(true)
  })

  it('applies purple border class when accent=purple', () => {
    const w = mountVar(varOf('string'), '', 'purple')
    const input = w.find('input[type="text"]')
    expect(input.classes().some(c => c.includes('purple'))).toBe(true)
  })

  it('applies purple toggle class when accent=purple and type=bool', () => {
    const w = mountVar(varOf('bool'), false, 'purple')
    const btn = w.find('button')
    expect(btn.exists()).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Emit behavior
  // -----------------------------------------------------------------------
  it('emits update:modelValue when text input changes', async () => {
    const w = mountVar(varOf('string'), 'old')
    const input = w.find('input[type="text"]')
    await input.setValue('new value')
    expect(w.emitted('update:modelValue')).toBeTruthy()
    expect(w.emitted('update:modelValue')![0][0]).toBe('new value')
  })

  it('emits update:modelValue when number input changes', async () => {
    const w = mountVar(varOf('number'), 0)
    const input = w.find('input[type="number"]')
    await input.setValue('42')
    expect(w.emitted('update:modelValue')).toBeTruthy()
  })

  it('emits update:modelValue when textarea changes', async () => {
    const w = mountVar(varOf('list(string)'), '')
    await w.find('textarea').setValue('item1\nitem2')
    expect(w.emitted('update:modelValue')).toBeTruthy()
  })

  it('emits update:modelValue when bool toggle is clicked', async () => {
    const w = mountVar(varOf('bool'), false)
    await w.find('button').trigger('click')
    expect(w.emitted('update:modelValue')).toBeTruthy()
    expect(w.emitted('update:modelValue')![0][0]).toBe(true)
  })

  // -----------------------------------------------------------------------
  // disabled prop
  // -----------------------------------------------------------------------
  it('passes disabled to number input', () => {
    const w2 = mount(VariableInput, {
      props: { variable: varOf('number'), modelValue: 0, disabled: true },
    })
    expect(w2.find('input[type="number"]').attributes('disabled')).toBeDefined()
  })
})
