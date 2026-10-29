import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { needsVariablesStep, useNeedsVariablesStep } from '@/views/new-deployment/variablesStep'
import { useDeploymentStore } from '@/stores/deployment.store'
import type { DeploymentDraft } from '@/types'

const def = (name: string) => ({ name, type: 'string', source: 'terraform' })
const resourceChoices = [
  {
    container: 'web',
    cpu: { default: '1', min: '1', max: '2' },
    memory: { default: '1Gi', min: '1Gi', max: '2Gi' },
  },
]

const draft = (over: Partial<DeploymentDraft> = {}): DeploymentDraft => {
  useDeploymentStore.getState().resetDraft()
  useDeploymentStore.getState().updateDraft({ appId: 'app-1', studentIds: ['u1', 'u2'], groupCount: 2, ...over } as never)
  return useDeploymentStore.getState().draft
}

describe('needsVariablesStep', () => {
  it('is unknown (null) while the definitions are not loaded', () => {
    expect(needsVariablesStep(draft())).toBeNull()
  })

  it('is false when the definitions are loaded and empty and nothing else can be set', () => {
    expect(needsVariablesStep(draft({ variableDefinitions: [] }))).toBe(false)
  })

  it('is false for empty choices and an empty network offer', () => {
    expect(
      needsVariablesStep(draft({ variableDefinitions: [], resourceChoices: [], networkChoices: {} })),
    ).toBe(false)
  })

  it('is true when the app has a variable', () => {
    expect(needsVariablesStep(draft({ variableDefinitions: [def('region')] as never }))).toBe(true)
  })

  it('is true when the app offers resource choices', () => {
    expect(needsVariablesStep(draft({ variableDefinitions: [], resourceChoices } as never))).toBe(true)
  })

  it('is true when the app offers a network switch that is visible', () => {
    expect(
      needsVariablesStep(draft({ variableDefinitions: [], networkChoices: { internet: { default: false } } })),
    ).toBe(true)
  })

  it('ignores pod networking while there is only one workload', () => {
    const one = draft({
      variableDefinitions: [],
      networkChoices: { podNetwork: { default: false } },
      studentIds: ['u1'],
      groupCount: 1,
    })
    expect(needsVariablesStep(one)).toBe(false)
  })

  it('counts pod networking once there are two workloads', () => {
    const two = draft({ variableDefinitions: [], networkChoices: { podNetwork: { default: false } }, groupCount: 2 })
    expect(needsVariablesStep(two)).toBe(true)
  })

  it('does not wait for the definitions when choices already make the step necessary', () => {
    expect(needsVariablesStep(draft({ resourceChoices } as never))).toBe(true)
    expect(needsVariablesStep(draft({ networkChoices: { internet: { default: true } } }))).toBe(true)
  })
})

describe('useNeedsVariablesStep', () => {
  beforeEach(() => {
    draft()
  })

  it('follows the draft in the store', () => {
    const { result } = renderHook(() => useNeedsVariablesStep())
    expect(result.current).toBeNull()

    act(() => useDeploymentStore.getState().updateDraft({ variableDefinitions: [] }))
    expect(result.current).toBe(false)

    act(() => useDeploymentStore.getState().updateDraft({ variableDefinitions: [def('a')] as never }))
    expect(result.current).toBe(true)
  })
})
