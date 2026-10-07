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

  it('emits click when clicked', async () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Click' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted()).toBeDefined()
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
})
