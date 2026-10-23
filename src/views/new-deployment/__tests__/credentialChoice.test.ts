import { describe, it, expect } from 'vitest'
import { chooseCredentialId } from '../credentialChoice'
import type { OpenStackCredential } from '@/types/openstack-credential'

const cred = (id: string) => ({ credentialId: id }) as OpenStackCredential

describe('chooseCredentialId', () => {
  it('a pod app deploys without a credential, whatever was left in the draft', () => {
    expect(chooseCredentialId(false, 'c-1', [cred('c-1')])).toBeNull()
  })

  it('keeps the current choice while it is usable', () => {
    expect(chooseCredentialId(true, 'c-2', [cred('c-1'), cred('c-2')])).toBe('c-2')
  })

  it('takes the only usable credential by default', () => {
    expect(chooseCredentialId(true, null, [cred('c-1')])).toBe('c-1')
  })

  it('drops a choice that is no longer usable, and replaces it by the only one', () => {
    expect(chooseCredentialId(true, 'gone', [cred('c-1')])).toBe('c-1')
    expect(chooseCredentialId(true, 'gone', [cred('c-1'), cred('c-2')])).toBeNull()
  })

  it('leaves the choice to the teacher when several are usable', () => {
    expect(chooseCredentialId(true, null, [cred('c-1'), cred('c-2')])).toBeNull()
  })

  it('has nothing to choose without a usable credential', () => {
    expect(chooseCredentialId(true, 'c-1', [])).toBeNull()
  })
})
