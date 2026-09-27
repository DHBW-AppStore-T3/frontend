import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useOverlay } from '@/composables/useOverlay'

function makeHost(show: ReturnType<typeof ref<boolean>>, onClose: () => void) {
  return defineComponent({
    setup() {
      const { containerRef } = useOverlay({ show, onClose })
      return () =>
        show.value
          ? h('div', { ref: containerRef, tabindex: '-1' }, [
              h('button', { id: 'first' }, 'first'),
              h('button', { id: 'second' }, 'second'),
            ])
          : null
    },
  })
}

describe('useOverlay', () => {
  let trigger: HTMLButtonElement

  beforeEach(() => {
    trigger = document.createElement('button')
    trigger.id = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()
    document.body.style.overflow = ''
  })

  afterEach(() => {
    trigger.remove()
    document.body.style.overflow = ''
  })

  it('calls onClose on Escape while open', async () => {
    const show = ref(true)
    let closed = false
    mount(makeHost(show, () => { closed = true }), { attachTo: document.body })
    await nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closed).toBe(true)
  })

  it('locks body scroll while open and releases it on close', async () => {
    const show = ref(true)
    const wrapper = mount(makeHost(show, () => {}), { attachTo: document.body })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')

    show.value = false
    await nextTick()
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('returns focus to the previously focused element on close', async () => {
    const show = ref(true)
    const wrapper = mount(makeHost(show, () => {}), { attachTo: document.body })
    await nextTick()

    show.value = false
    await nextTick()
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })
})
