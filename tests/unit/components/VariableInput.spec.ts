import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import VariableInput from '@/components/VariableInput.vue'
import { isOsResourceVar, type AppVariable } from '@/types'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const variable = (overrides: Partial<AppVariable> = {}): AppVariable => ({
  name: 'size',
  type: 'string',
  description: null,
  default: null,
  required: false,
  source: 'terraform',
  osType: null,
  ...overrides,
} as AppVariable)

const mountInput = (v: AppVariable, modelValue: unknown = '') =>
  mount(VariableInput, {
    props: { variable: v, modelValue },
    global: { stubs: { OpenStackResourcePicker: { props: ['osType'], template: '<div class="os-picker">{{ osType }}</div>' } } },
  })

describe('VariableInput.vue', () => {
  describe('enum (pod apps: one of the values appstore.yaml declares)', () => {
    it('is a select over the declared values, not an OpenStack picker', () => {
      const wrapper = mountInput(variable({ osType: 'enum', values: ['s', 'm', 'l'], default: 'm' }), 'm')

      const select = wrapper.get('[data-testid="enum-input"]')
      expect(select.findAll('option').map((o) => o.text())).toEqual(['s', 'm', 'l'])
      expect((select.element as HTMLSelectElement).value).toBe('m')
      expect(wrapper.find('.os-picker').exists()).toBe(false)
    })

    it('emits the chosen value', async () => {
      const wrapper = mountInput(variable({ osType: 'enum', values: ['s', 'm', 'l'], default: 'm' }), 'm')

      await wrapper.get('[data-testid="enum-input"]').setValue('l')

      expect(wrapper.emitted('update:modelValue')).toEqual([['l']])
    })

    it('without a default it asks for a choice first', () => {
      const wrapper = mountInput(variable({ osType: 'enum', values: ['a', 'b'] }), '')

      const first = wrapper.get('[data-testid="enum-input"]').findAll('option')[0]!
      expect(first.text()).toBe('variableInput.choose')
      expect(first.attributes('disabled')).toBeDefined()
    })

    it('can be disabled', () => {
      const wrapper = mount(VariableInput, {
        props: { variable: variable({ osType: 'enum', values: ['a'] }), modelValue: '', disabled: true },
      })

      expect(wrapper.get('[data-testid="enum-input"]').attributes('disabled')).toBeDefined()
    })
  })

  it('an OpenStack resource variable gets the resource picker', () => {
    const wrapper = mountInput(variable({ name: 'image', osType: 'image', osMode: 'name' }))

    expect(wrapper.get('.os-picker').text()).toBe('image')
    expect(wrapper.find('[data-testid="enum-input"]').exists()).toBe(false)
  })

  it('a plain string variable is a text input', async () => {
    const wrapper = mountInput(variable({ name: 'greeting', default: 'hi' }))

    const input = wrapper.get('input[type="text"]')
    await input.setValue('hello')

    expect(wrapper.emitted('update:modelValue')).toEqual([['hello']])
  })

  it('isOsResourceVar: files and enums are no OpenStack resources', () => {
    expect(isOsResourceVar({ osType: 'enum' })).toBe(false)
    expect(isOsResourceVar({ osType: 'file' })).toBe(false)
    expect(isOsResourceVar({ osType: null })).toBe(false)
    expect(isOsResourceVar({ osType: 'flavor' })).toBe(true)
  })
})
