import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Modal from '@/components/ui/Modal.vue'

describe('Modal', () => {
  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('renders nothing when show is false', () => {
    const wrapper = mount(Modal, { props: { show: false } })
    expect(wrapper.find('.fixed').exists()).toBe(false)
  })

  it('renders #header slot, falling back to #title, falling back to "Modal"', () => {
    const withHeader = mount(Modal, {
      props: { show: true },
      slots: { header: 'Header Slot' },
    })
    expect(withHeader.text()).toContain('Header Slot')

    const withTitle = mount(Modal, {
      props: { show: true },
      slots: { title: 'Title Slot' },
    })
    expect(withTitle.text()).toContain('Title Slot')

    const withNeither = mount(Modal, { props: { show: true } })
    expect(withNeither.text()).toContain('Modal')
  })

  it('renders default/#body slot content and optional #footer', () => {
    const wrapper = mount(Modal, {
      props: { show: true },
      slots: { default: 'Body content', footer: 'Footer content' },
    })
    expect(wrapper.text()).toContain('Body content')
    expect(wrapper.text()).toContain('Footer content')
  })

  it('emits close on backdrop click and on the close button', async () => {
    const wrapper = mount(Modal, { props: { show: true } })
    await wrapper.find('.fixed').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.find('button[aria-label="Close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('locks body scroll while open via useOverlay', async () => {
    mount(Modal, { props: { show: true }, attachTo: document.body })
    await Promise.resolve()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('closes on Escape via useOverlay', async () => {
    const wrapper = mount(Modal, { props: { show: true }, attachTo: document.body })
    await Promise.resolve()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
