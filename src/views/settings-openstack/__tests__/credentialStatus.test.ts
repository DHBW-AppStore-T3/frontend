import { describe, it, expect } from 'vitest'
import { credentialHealth, isDeletable, safeAppPath } from '../credentialStatus'
import type { OpenStackCredential } from '@/types/openstack-credential'

const credential = (over: Partial<OpenStackCredential> = {}) =>
  ({ project_verified: true, last_validation_error: null, active_deployments: 0, ...over }) as OpenStackCredential

describe('credentialHealth', () => {
  it('is unverified until Keystone named the project, whatever the last error says', () => {
    expect(credentialHealth(credential({ project_verified: false }))).toBe('unverified')
    expect(credentialHealth(credential({ project_verified: false, last_validation_error: 'x' }))).toBe('unverified')
  })

  it('is failing for a verified credential with an error, else ok', () => {
    expect(credentialHealth(credential({ last_validation_error: 'rejected' }))).toBe('failing')
    expect(credentialHealth(credential())).toBe('ok')
  })
})

describe('isDeletable', () => {
  it('is false while deployments use the credential', () => {
    expect(isDeletable(credential({ active_deployments: 2 }))).toBe(false)
    expect(isDeletable(credential())).toBe(true)
  })
})

describe('safeAppPath', () => {
  it.each(['/deployment/new/config', '/apps?x=1'])('follows %s', (path) => {
    expect(safeAppPath(path)).toBe(path)
  })

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '', null, undefined, 42])(
    'refuses %s',
    (value) => {
      expect(safeAppPath(value)).toBeNull()
    },
  )
})
