import { describe, it, expect } from 'vitest'
import { chooseQuotaCredential, projectLabel } from '../quotaCredential'
import type { OpenStackCredential } from '@/types/openstack-credential'

const credential = (id: string, overrides: Partial<OpenStackCredential> = {}) =>
  ({ credentialId: id, project_id: `p-${id}`, project_name: `Project ${id}`, ...overrides }) as OpenStackCredential

describe('chooseQuotaCredential', () => {
  const usable = [credential('a'), credential('b')]

  it('keeps the current credential while it is usable', () => {
    expect(chooseQuotaCredential('b', usable)).toBe('b')
  })

  it('moves to the first usable one when the current is gone or none was chosen', () => {
    expect(chooseQuotaCredential('deleted', usable)).toBe('a')
    expect(chooseQuotaCredential(null, usable)).toBe('a')
  })

  it('is null without a usable credential', () => {
    expect(chooseQuotaCredential('a', [])).toBeNull()
  })
})

describe('projectLabel', () => {
  it('prefers the project name, then the id', () => {
    expect(projectLabel(credential('a'))).toBe('Project a')
    expect(projectLabel(credential('a', { project_name: null }))).toBe('p-a')
  })
})
