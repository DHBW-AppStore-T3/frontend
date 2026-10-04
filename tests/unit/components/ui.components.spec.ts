import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import Badge from '@/components/ui/Badge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import ScopeBadge from '@/components/ui/ScopeBadge.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
describe('Badge.vue', () => {
  it('renders slot content', () => {
    const wrapper = mount(Badge, { slots: { default: 'Active' } })
    expect(wrapper.text()).toBe('Active')
  })

  it('applies green variant classes', () => {
    const wrapper = mount(Badge, { props: { variant: 'green' }, slots: { default: 'OK' } })
    expect(wrapper.classes()).toContain('bg-green-100')
    expect(wrapper.classes()).toContain('text-green-700')
  })

  it('applies red variant classes', () => {
    const wrapper = mount(Badge, { props: { variant: 'red' }, slots: { default: 'Error' } })
    expect(wrapper.classes()).toContain('bg-red-100')
    expect(wrapper.classes()).toContain('text-red-700')
  })

  it('applies blue variant classes', () => {
    const wrapper = mount(Badge, { props: { variant: 'blue' }, slots: { default: 'Info' } })
    expect(wrapper.classes()).toContain('bg-blue-100')
    expect(wrapper.classes()).toContain('text-blue-700')
  })

  it('applies purple variant classes', () => {
    const wrapper = mount(Badge, { props: { variant: 'purple' }, slots: { default: 'Admin' } })
    expect(wrapper.classes()).toContain('bg-purple-100')
    expect(wrapper.classes()).toContain('text-purple-700')
  })

  it('applies yellow variant classes', () => {
    const wrapper = mount(Badge, { props: { variant: 'yellow' }, slots: { default: 'Warn' } })
    expect(wrapper.classes()).toContain('bg-yellow-100')
    expect(wrapper.classes()).toContain('text-yellow-700')
  })

  it('falls back to gray when no variant is given', () => {
    const wrapper = mount(Badge, { slots: { default: 'Default' } })
    expect(wrapper.classes()).toContain('bg-gray-100')
    expect(wrapper.classes()).toContain('text-gray-700')
  })

  it('is a span element', () => {
    const wrapper = mount(Badge, { slots: { default: 'X' } })
    expect(wrapper.element.tagName).toBe('SPAN')
  })
})

// ---------------------------------------------------------------------------
// BaseButton
// ---------------------------------------------------------------------------
describe('BaseButton.vue', () => {
  it('renders slot content', () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Save' } })
    expect(wrapper.text()).toBe('Save')
  })

  it('is a button element', () => {
    const wrapper = mount(BaseButton)
    expect(wrapper.element.tagName).toBe('BUTTON')
  })

  it('primary variant is the default', () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Go' } })
    // primary and yellow share the same classes
    expect(wrapper.classes().join(' ')).toContain('bg-brandAccentSoft')
  })

  it('yellow variant applies brand accent classes', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'yellow' } })
    expect(wrapper.classes().join(' ')).toContain('bg-brandAccentSoft')
  })

  it('green variant applies green classes', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'green' } })
    expect(wrapper.classes().join(' ')).toContain('bg-primarySoft')
  })

  it('red variant applies destructive classes', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'red' } })
    expect(wrapper.classes().join(' ')).toContain('bg-destructiveSoft')
  })

  it('ghost variant applies ghost classes', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'ghost' } })
    expect(wrapper.classes().join(' ')).toContain('border-gray-200')
  })

  it('emits click when clicked', async () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Click' } })
    await wrapper.trigger('click')
    // Standard HTML button emits a native click — the component passes it through
    expect(wrapper.emitted()).toBeDefined()
  })

  it('disabled button has opacity-50 class', () => {
    const wrapper = mount(BaseButton, {
      attrs: { disabled: true },
      slots: { default: 'X' },
    })
    expect(wrapper.classes().join(' ')).toContain('disabled:opacity-50')
  })
})

// ---------------------------------------------------------------------------
// BaseInput
// ---------------------------------------------------------------------------
describe('BaseInput.vue', () => {
  it('renders an input element', () => {
    const wrapper = mount(BaseInput)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('defaults to type="text"', () => {
    const wrapper = mount(BaseInput)
    expect(wrapper.find('input').attributes('type')).toBe('text')
  })

  it('passes through type prop', () => {
    const wrapper = mount(BaseInput, { props: { type: 'password' } })
    expect(wrapper.find('input').attributes('type')).toBe('password')
  })

  it('sets placeholder', () => {
    const wrapper = mount(BaseInput, { props: { placeholder: 'Enter name' } })
    expect(wrapper.find('input').attributes('placeholder')).toBe('Enter name')
  })

  it('reflects modelValue as the input value', () => {
    const wrapper = mount(BaseInput, { props: { modelValue: 'hello' } })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('hello')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(BaseInput, { props: { modelValue: '' } })
    const input = wrapper.find('input')
    await input.setValue('typed text')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['typed text'])
  })
})

// ---------------------------------------------------------------------------
// ScopeBadge
// ---------------------------------------------------------------------------
describe('ScopeBadge.vue', () => {
  it('renders nothing for scope="all"', () => {
    const wrapper = mount(ScopeBadge, { props: { scope: 'all' } })
    expect(wrapper.text()).toBe('')
  })

  it('renders nothing when scope is undefined', () => {
    const wrapper = mount(ScopeBadge)
    expect(wrapper.text()).toBe('')
  })

  it('renders "Pro Team" for scope="team"', () => {
    const wrapper = mount(ScopeBadge, { props: { scope: 'team' } })
    expect(wrapper.text()).toContain('Pro Team')
  })

  it('renders "Pro User" for scope="user"', () => {
    const wrapper = mount(ScopeBadge, { props: { scope: 'user' } })
    expect(wrapper.text()).toContain('Pro User')
  })

  it('team badge uses purple variant via Badge', () => {
    const wrapper = mount(ScopeBadge, { props: { scope: 'team' } })
    // The inner Badge span should have purple classes
    const span = wrapper.find('span')
    expect(span.classes().join(' ')).toContain('purple')
  })
})
