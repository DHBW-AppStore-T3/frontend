import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Card from '@/components/ui/Card.vue'

describe('Card', () => {
  it('uses the shared surface and preserves content and caller attributes', () => {
    const wrapper = mount(Card, { attrs: { class: 'catalog-card', 'aria-label': 'Application' }, slots: { default: '<h2>JupyterLab</h2>' } })
    expect(wrapper.classes()).toContain('ui-card')
    expect(wrapper.classes()).toContain('catalog-card')
    expect(wrapper.attributes('aria-label')).toBe('Application')
    expect(wrapper.get('h2').text()).toBe('JupyterLab')
  })
})
