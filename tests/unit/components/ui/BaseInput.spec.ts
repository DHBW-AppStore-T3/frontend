import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from '@/components/ui/BaseInput.vue'

describe('BaseInput', () => {
  it('uses the primaryAction token for the focus ring, not a hardcoded blue', () => {
    const wrapper = mount(BaseInput)
    const classes = wrapper.find('input').classes().join(' ')
    expect(classes).toContain('focus:ring-primaryAction')
    expect(classes).toContain('focus:border-primaryAction')
    expect(classes).not.toContain('blue-500')
  })
})
