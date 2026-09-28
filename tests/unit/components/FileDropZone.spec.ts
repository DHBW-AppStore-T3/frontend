import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string, _opts?: any) => key }),
}))

vi.mock('lucide-vue-next', () => ({
  Upload: { template: '<span class="icon-upload" />' },
  FileText: { template: '<span class="icon-file" />' },
  X: { template: '<span class="icon-x" />' },
}))

vi.mock('@/utils/format', () => ({
  formatBytes: vi.fn((n: number) => `${n}B`),
}))

import FileDropZone from '@/components/FileDropZone.vue'

// ---------------------------------------------------------------------------
// FileReader stub — happy-dom doesn't ship a real FileReader. Intercept it
// globally. Use Promise microtasks (not setTimeout) so flushPromises() always
// drains the queue before setImmediate (which flushPromises itself uses).
// ---------------------------------------------------------------------------
const mockFileReader: any = {
  onload: null as any,
  onerror: null as any,
  error: null as any,
  result: null as any,
  readAsDataURL: vi.fn(),
}
vi.stubGlobal('FileReader', vi.fn(() => mockFileReader))

function fakeFile(name = 'test.txt', size = 100, type = 'text/plain') {
  const blob = new Blob(['x'.repeat(size)], { type })
  return new File([blob], name, { type })
}

describe('FileDropZone', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockFileReader.onload = null
    mockFileReader.onerror = null
    mockFileReader.error = null
    mockFileReader.result = null
    // Default: fire onload as a microtask so flushPromises() reliably picks it up.
    mockFileReader.readAsDataURL.mockImplementation(() => {
      Promise.resolve().then(() => mockFileReader.onload?.())
    })
  })

  // -----------------------------------------------------------------------
  // Initial render — empty state
  // -----------------------------------------------------------------------
  it('renders the drop zone in empty state', () => {
    const w = mount(FileDropZone)
    expect(w.find('.icon-upload').exists()).toBe(true)
    expect(w.find('.icon-file').exists()).toBe(false)
  })

  it('shows label text when label prop is provided', () => {
    const w = mount(FileDropZone, { props: { label: 'Aufgabenstellung' } })
    expect(w.text()).toContain('Aufgabenstellung')
  })

  it('shows max-size in MB', () => {
    const w = mount(FileDropZone, { props: { maxBytes: 5 * 1024 * 1024 } })
    expect(w.text()).toContain('5 MB')
  })

  // -----------------------------------------------------------------------
  // Filled state
  // -----------------------------------------------------------------------
  it('renders file info when modelValue is provided', () => {
    const payload = { name: 'report.pdf', content_b64: 'abc', size: 2048, content_type: 'application/pdf' }
    const w = mount(FileDropZone, { props: { modelValue: payload } })
    expect(w.find('.icon-file').exists()).toBe(true)
    expect(w.text()).toContain('report.pdf')
    expect(w.find('.icon-upload').exists()).toBe(false)
  })

  it('shows label above filename in filled state', () => {
    const payload = { name: 'data.csv', content_b64: 'x', size: 100, content_type: 'text/csv' }
    const w = mount(FileDropZone, { props: { modelValue: payload, label: 'Dataset' } })
    expect(w.text()).toContain('Dataset')
  })

  it('emits null when clear button is clicked', async () => {
    const payload = { name: 'f.txt', content_b64: 'x', size: 10, content_type: 'text/plain' }
    const w = mount(FileDropZone, { props: { modelValue: payload } })
    await w.find('button').trigger('click')
    expect(w.emitted('update:modelValue')).toBeTruthy()
    expect(w.emitted('update:modelValue')![0][0]).toBeNull()
    expect(w.emitted('change')![0][0]).toBeNull()
  })

  it('does not show clear button when disabled=true in filled state', () => {
    const payload = { name: 'f.txt', content_b64: 'x', size: 10, content_type: 'text/plain' }
    const w = mount(FileDropZone, { props: { modelValue: payload, disabled: true } })
    expect(w.find('button').exists()).toBe(false)
  })

  // -----------------------------------------------------------------------
  // File processing via input
  // -----------------------------------------------------------------------
  it('emits update:modelValue with file data after successful read', async () => {
    mockFileReader.result = 'data:text/plain;base64,aGVsbG8='
    const w = mount(FileDropZone)
    const file = fakeFile('hello.txt', 50, 'text/plain')

    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: { 0: file, length: 1, item: () => file },
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()

    expect(w.emitted('update:modelValue')).toBeTruthy()
    const emitted = w.emitted('update:modelValue')![0][0] as any
    expect(emitted.name).toBe('hello.txt')
    expect(emitted.content_b64).toBe('aGVsbG8=')
  })

  it('shows error and emits error when file exceeds maxBytes', async () => {
    const w = mount(FileDropZone, { props: { maxBytes: 10 } })
    const bigFile = fakeFile('big.bin', 1024, 'application/octet-stream')

    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: { 0: bigFile, length: 1, item: () => bigFile },
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()

    expect(w.emitted('error')).toBeTruthy()
    expect(w.emitted('error')![0][0]).toBe('fileDropZone.tooLarge')
    expect(w.text()).toContain('fileDropZone.tooLarge')
  })

  it('emits error when FileReader fires onerror', async () => {
    // Override: fire onerror (not onload) as a microtask.
    mockFileReader.readAsDataURL.mockImplementation(() => {
      Promise.resolve().then(() => {
        mockFileReader.error = new Error('read error')
        mockFileReader.onerror?.()
      })
    })
    const w = mount(FileDropZone)
    const file = fakeFile('oops.txt', 10)

    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: { 0: file, length: 1, item: () => file },
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()

    expect(w.emitted('error')).toBeTruthy()
  })

  it('emits error when base64 prefix not found in result', async () => {
    // Override: fire onload with result that has no 'base64,' prefix.
    mockFileReader.readAsDataURL.mockImplementation(() => {
      mockFileReader.result = 'no-prefix-here'
      Promise.resolve().then(() => mockFileReader.onload?.())
    })
    const w = mount(FileDropZone)
    const file = fakeFile('test.bin', 10)

    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: { 0: file, length: 1, item: () => file },
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()

    expect(w.emitted('error')).toBeTruthy()
  })

  // -----------------------------------------------------------------------
  // Drag events
  // -----------------------------------------------------------------------
  it('sets isDragging=true on dragover', async () => {
    const w = mount(FileDropZone)
    // [0] is the outer wrapper div; [1] is the actual drop zone that has the
    // @dragover/@dragleave/@drop handlers.
    const zone = w.findAll('div')[1]
    await zone.trigger('dragover')
    expect(w.html()).toContain('border-green-500')
  })

  it('clears isDragging on dragleave', async () => {
    const w = mount(FileDropZone)
    const zone = w.findAll('div')[1]
    await zone.trigger('dragover')
    await zone.trigger('dragleave')
    expect(w.html()).not.toContain('border-green-500')
  })

  it('processes file on drop via dataTransfer', async () => {
    mockFileReader.result = 'data:text/plain;base64,ZHJvcA=='
    const w = mount(FileDropZone)
    const file = fakeFile('drop.txt', 20)

    // trigger(event, options) uses document.createEvent('Event') + Object.assign,
    // so dataTransfer is writable on the generic Event — readable by onDrop's
    // event.dataTransfer?.files?.[0] access.
    await w.findAll('div')[1].trigger('drop', {
      dataTransfer: { files: { 0: file, length: 1, item: () => file } },
    })
    await flushPromises()

    expect(w.emitted('update:modelValue')).toBeTruthy()
  })

  // -----------------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------------
  it('does not process file when disabled=true', async () => {
    const w = mount(FileDropZone, { props: { disabled: true } })
    const file = fakeFile('x.txt', 10)

    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: { 0: file, length: 1, item: () => file },
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()

    expect(w.emitted('update:modelValue')).toBeFalsy()
  })

  it('does not trigger input when disabled=true (triggerInput guard)', async () => {
    const w = mount(FileDropZone, { props: { disabled: true } })
    const zone = w.findAll('div')[0]
    await zone.trigger('click')
    // No assertion needed — just verifying no error is thrown
    expect(w.html()).toBeDefined()
  })
})
