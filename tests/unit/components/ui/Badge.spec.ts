import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Badge from '@/components/ui/Badge.vue'

describe('Badge', () => {
  it('defaults to the neutral variant', () => {
    const wrapper = mount(Badge)
    expect(wrapper.classes().join(' ')).toContain('bg-surfaceMuted')
  })

  it.each([
    ['success', 'bg-successTint'],
    ['warning', 'bg-warningTint'],
    ['danger', 'bg-dangerTint'],
    ['info', 'bg-infoTint'],
    ['brand', 'bg-brandAccentSoft'],
  ] as const)('renders the %s variant with its tint background', (variant, expectedClass) => {
    const wrapper = mount(Badge, { props: { variant } })
    expect(wrapper.classes().join(' ')).toContain(expectedClass)
  })

  it('adds a border when bordered is set', () => {
    const wrapper = mount(Badge, { props: { variant: 'success', bordered: true } })
    expect(wrapper.classes()).toContain('border')
  })

  it('has no border by default', () => {
    const wrapper = mount(Badge, { props: { variant: 'success' } })
    expect(wrapper.classes()).not.toContain('border')
  })

  it('never uses raw Tailwind palette classes', () => {
    const wrapper = mount(Badge, { props: { variant: 'brand' } })
    expect(wrapper.classes().join(' ')).not.toMatch(/\b(green|red|blue|purple|yellow|gray)-\d/)
  })
})
