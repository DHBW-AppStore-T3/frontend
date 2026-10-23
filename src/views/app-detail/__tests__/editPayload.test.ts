import { describe, it, expect } from 'vitest'
import { buildEditPayload } from '../editPayload'

const app = { name: 'App', description: 'Desc' } as any

describe('buildEditPayload', () => {
  it('sends only the fields that changed', async () => {
    expect(await buildEditPayload(app, { name: 'New', description: 'Desc' }, null)).toEqual({ name: 'New' })
    expect(await buildEditPayload(app, { name: 'App', description: 'Other' }, null)).toEqual({ description: 'Other' })
  })

  it('is empty when nothing changed', async () => {
    expect(await buildEditPayload(app, { name: 'App', description: 'Desc' }, null)).toEqual({})
  })

  it('treats a missing server description as an empty string', async () => {
    expect(await buildEditPayload({ name: 'A' } as any, { name: 'A', description: '' }, null)).toEqual({})
  })

  it("sends '' to clear the image and a data URL for a new file", async () => {
    expect(await buildEditPayload(app, { name: 'App', description: 'Desc' }, 'remove')).toEqual({ image: '' })

    const file = new File(['x'], 'l.png', { type: 'image/png' })
    const payload = await buildEditPayload(app, { name: 'App', description: 'Desc' }, file)
    expect(payload.image).toMatch(/^data:image\/png;base64,/)
  })
})
