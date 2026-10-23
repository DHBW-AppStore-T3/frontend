import { describe, it, expect } from 'vitest'
import {
  emptyAppForm,
  emptyPasswordForm,
  buildPayload,
  formsFromYaml,
} from '../credentialForm'

describe('buildPayload', () => {
  it('builds an application-credential payload', () => {
    const form = { ...emptyAppForm(), auth_url: 'https://c', identifier: 'id', secret: 's' }
    expect(buildPayload('app', form, emptyPasswordForm())).toEqual({
      auth_type: 'v3applicationcredential',
      auth_url: 'https://c',
      region_name: null,
      interface: 'public',
      identity_api_version: '3',
      identifier: 'id',
      secret: 's',
    })
  })

  it('returns null while a required application field is missing', () => {
    expect(buildPayload('app', { ...emptyAppForm(), auth_url: 'https://c', identifier: 'id' }, emptyPasswordForm())).toBeNull()
  })

  it('builds a password payload with null for empty optional fields', () => {
    const pwd = {
      ...emptyPasswordForm(),
      auth_url: 'https://c',
      identifier: 'admin',
      secret: 's',
      project_id: 'p1',
    }
    expect(buildPayload('password', emptyAppForm(), pwd)).toMatchObject({
      auth_type: 'password',
      project_id: 'p1',
      project_name: null,
      user_domain_name: 'Default',
      project_domain_name: null,
    })
  })

  it('requires a project id or project name for password credentials', () => {
    const pwd = { ...emptyPasswordForm(), auth_url: 'https://c', identifier: 'a', secret: 's' }
    expect(buildPayload('password', emptyAppForm(), pwd)).toBeNull()
    expect(buildPayload('password', emptyAppForm(), { ...pwd, project_name: 'proj' })).not.toBeNull()
  })

  it('requires a user domain for password credentials', () => {
    const pwd = { ...emptyPasswordForm(), auth_url: 'u', identifier: 'a', secret: 's', project_id: 'p', user_domain_name: '' }
    expect(buildPayload('password', emptyAppForm(), pwd)).toBeNull()
  })
})

describe('formsFromYaml', () => {
  it('maps an application credential including its secret', () => {
    const r = formsFromYaml({
      auth_type: 'v3applicationcredential',
      auth_url: 'u',
      region_name: 'R',
      identifier: 'i',
      secret: 's',
    } as any)
    expect(r.tab).toBe('app')
    expect(r.app).toEqual({ auth_url: 'u', region_name: 'R', identifier: 'i', secret: 's' })
  })

  it('maps a password credential and defaults the user domain', () => {
    const r = formsFromYaml({
      auth_type: 'password',
      auth_url: 'u',
      region_name: '',
      identifier: 'i',
      secret: 's',
      project_id: 'p',
      project_name: '',
      user_domain_name: '',
      project_domain_name: 'pd',
    } as any)
    expect(r.tab).toBe('password')
    expect(r.password.user_domain_name).toBe('Default')
    expect(r.password.project_domain_name).toBe('pd')
  })
})
