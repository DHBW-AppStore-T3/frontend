import { describe, it, expect } from 'vitest'
import { isMultiImagePackerLayout, packerValueFor } from '../draft-variables'

describe('isMultiImagePackerLayout', () => {
  it('is true for a non-empty packer map whose entries are all objects', () => {
    expect(isMultiImagePackerLayout({ packer: { web: { a: 1 }, db: {} } })).toBe(true)
  })

  it.each([
    [undefined],
    [null],
    [{}],
    [{ packer: {} }],
    [{ packer: [] }],
    [{ packer: { a: 'x' } }],
    [{ packer: { a: [] } }],
    [{ packer: 'nope' }],
  ])('is false for %j', (variables) => {
    expect(isMultiImagePackerLayout(variables as any)).toBe(false)
  })
})

describe('packerValueFor', () => {
  const def = { name: 'region', template_key: 'web' } as any

  it('reads the nested value in multi-image layout', () => {
    expect(packerValueFor(def, { packer: { web: { region: 'eu' } } })).toBe('eu')
  })

  it('falls back to the flat value and then undefined', () => {
    expect(packerValueFor(def, { packer: { web: {} }, region: 'us' })).toBe('us')
    expect(packerValueFor(def, {})).toBeUndefined()
  })

  it("uses the 'default' template key when none is set", () => {
    expect(packerValueFor({ name: 'x' } as any, { packer: { default: { x: 1 } } })).toBe(1)
  })
})
