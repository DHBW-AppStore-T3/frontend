import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Drawer from '@/components/ui/Drawer.vue'

describe('Drawer', () => {
  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('renders nothing when show is false', () => {
    const wrapper = mount(Drawer, { props: { show: false } })
    expect(wrapper.find('.fixed').exists()).toBe(false)
  })

  it('defaults to sliding in from the left', () => {
    const wrapper = mount(Drawer, { props: { show: true } })
    expect(wrapper.find('[data-drawer-panel]').classes().join(' ')).toContain('left-0')
  })

  it('slides in from the right when side="right"', () => {
    const wrapper = mount(Drawer, { props: { show: true, side: 'right' } })
    expect(wrapper.find('[data-drawer-panel]').classes().join(' ')).toContain('right-0')
  })

  it('renders slot content', () => {
    const wrapper = mount(Drawer, { props: { show: true }, slots: { default: 'Drawer content' } })
    expect(wrapper.text()).toContain('Drawer content')
  })

  it('emits close on backdrop click', async () => {
    const wrapper = mount(Drawer, { props: { show: true } })
    await wrapper.find('.fixed').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes on Escape and locks scroll while open (via useOverlay)', async () => {
    const wrapper = mount(Drawer, { props: { show: true }, attachTo: document.body })
    await Promise.resolve()
    expect(document.body.style.overflow).toBe('hidden')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
