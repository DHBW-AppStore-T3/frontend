import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '@/components/ui/BaseButton.vue'

describe('BaseButton', () => {
  it('defaults to the primary variant', () => {
    const wrapper = mount(BaseButton)
    expect(wrapper.classes()).toContain('bg-brandAccentSoft')
  })

  it('renders the secondary variant', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'secondary' } })
    expect(wrapper.classes().join(' ')).toContain('bg-primarySoft')
  })

  it('renders the outline variant', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'outline' } })
    const classes = wrapper.classes().join(' ')
    expect(classes).toContain('border')
    expect(classes).toContain('bg-transparent')
  })

  it('renders the text variant', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'text' } })
    const classes = wrapper.classes().join(' ')
    expect(classes).toContain('bg-transparent')
    expect(classes).not.toContain('border')
  })

  it('renders the destructive variant', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'destructive' } })
    expect(wrapper.classes().join(' ')).toContain('bg-destructiveSoft')
  })
})
