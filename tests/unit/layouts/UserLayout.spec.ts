import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserLayout from '@/layouts/UserLayout.vue'

describe('UserLayout', () => {
  it('delegates to AppLayout and renders the slot content', () => {
    const wrapper = mount(UserLayout, {
      global: { stubs: { AppLayout: { template: '<div class="app-layout-stub"><slot /></div>' } } },
      slots: { default: '<p>user content</p>' },
    })

    expect(wrapper.find('.app-layout-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('user content')
  })
})
