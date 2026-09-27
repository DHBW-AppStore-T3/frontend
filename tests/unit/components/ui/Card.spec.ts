import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Card from '@/components/ui/Card.vue'

describe('Card', () => {
  it('uses the token radius/shadow scale', () => {
    const wrapper = mount(Card)
    const classes = wrapper.classes().join(' ')
    expect(classes).toContain('rounded-xl')
    expect(classes).toContain('shadow-sm')
    expect(classes).toContain('hover:shadow-md')
    expect(classes).not.toContain('rounded-2xl')
  })
})
