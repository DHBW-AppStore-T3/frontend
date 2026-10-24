import { describe, expect, it } from 'vitest'
import de from '../locales/de'
import en from '../locales/en'

// The app configures i18next with `{name}` interpolation, so `{{name}}` would be shown literally.
describe('deployment.resources messages', () => {
  it.each([
    ['de', de],
    ['en', en],
  ])('%s uses single-brace placeholders only', (_name, messages) => {
    const m = (messages as any).deployment.resources
    expect(m.vcpu).toMatch(/^\{count\} vCPU$/)
    expect(m.range).toContain('{min}')
    expect(m.range).toContain('{max}')
    expect(m.range).toContain('{default}')
    for (const text of Object.values<string>(m)) expect(text).not.toMatch(/\{\{|\}\}/)
  })
})
