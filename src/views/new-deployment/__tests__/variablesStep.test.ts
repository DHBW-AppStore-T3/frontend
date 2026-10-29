import { describe, it, expect } from 'vitest'
import { needsVariablesStep } from '../variablesStep'
import type { DeploymentDraft } from '@/types'

const draftOf = (over: Partial<DeploymentDraft> = {}) => ({ variableDefinitions: [], ...over }) as DeploymentDraft

describe('needsVariablesStep with a scope choice', () => {
  it('is needed where the person chooses what one environment is, even without any variable', () => {
    expect(needsVariablesStep(draftOf({ scope: 'user', scopeChoice: true }))).toBe(true)
  })

  it('does not wait for the definitions then', () => {
    expect(needsVariablesStep(draftOf({ scopeChoice: true, variableDefinitions: undefined }))).toBe(true)
  })

  it('is left out when the scope is fixed and there is nothing else to set', () => {
    expect(needsVariablesStep(draftOf({ scope: 'user', scopeChoice: false }))).toBe(false)
  })
})
