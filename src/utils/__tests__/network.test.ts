import { describe, it, expect } from 'vitest'
import {
  choiceFits,
  defaultNetwork,
  networkDeviations,
  networkPayload,
  visibleNetworkKeys,
  workloadCount,
} from '../network'
import type { NetworkChoices } from '@/types'

const both: NetworkChoices = { internet: { default: false }, podNetwork: { default: false } }

const draft = (over: Record<string, unknown> = {}) =>
  ({
    scope: null,
    studentIds: [],
    groupNames: ['A', 'B'],
    groupCount: 2,
    networkChoices: both,
    network: defaultNetwork(both),
    ...over,
  }) as any

describe('network expert settings', () => {
  it('starts at the author default of every allowed key only', () => {
    expect(defaultNetwork({ internet: { default: true } })).toEqual({ internet: true })
    expect(defaultNetwork(both)).toEqual({ internet: false, podNetwork: false })
    expect(defaultNetwork({})).toEqual({})
    expect(defaultNetwork(undefined)).toEqual({})
  })

  it('counts workloads per team, or per person for scope user', () => {
    expect(workloadCount(draft())).toBe(2)
    expect(workloadCount(draft({ groupNames: [], groupCount: 3 }))).toBe(3)
    expect(workloadCount(draft({ scope: 'user', studentIds: ['a', 'b', 'c'] }))).toBe(3)
  })

  it('hides pod networking with fewer than two workloads', () => {
    expect(visibleNetworkKeys(draft())).toEqual(['internet', 'podNetwork'])
    expect(visibleNetworkKeys(draft({ groupNames: ['A'], groupCount: 1 }))).toEqual(['internet'])
    expect(visibleNetworkKeys(draft({ scope: 'user', studentIds: ['a'] }))).toEqual(['internet'])
  })

  it('has nothing to send without a choice from the app', () => {
    expect(networkPayload(draft({ networkChoices: {}, network: {} }))).toBeUndefined()
    expect(networkPayload(draft({ networkChoices: undefined, network: undefined }))).toBeUndefined()
  })

  it('sends only the allowed keys', () => {
    const only = { internet: { default: false } }
    expect(networkPayload(draft({ networkChoices: only, network: { internet: true, podNetwork: true } }))).toEqual({
      internet: true,
    })
    expect(networkPayload(draft({ networkChoices: { podNetwork: { default: true } }, network: {} }))).toEqual({
      podNetwork: true,
    })
  })

  it('does not send pod networking with a single workload', () => {
    const one = draft({ groupNames: ['A'], groupCount: 1, network: { internet: false, podNetwork: true } })
    expect(networkPayload(one)).toEqual({ internet: false })
  })

  it('reports only deviations from the default', () => {
    expect(networkDeviations(draft())).toEqual([])
    expect(networkDeviations(draft({ network: { internet: true, podNetwork: false } }))).toEqual([
      { key: 'internet', value: true },
    ])
    const on = { internet: { default: true } }
    expect(networkDeviations(draft({ networkChoices: on, network: { internet: false } }))).toEqual([
      { key: 'internet', value: false },
    ])
    // A hidden setting never shows up.
    expect(
      networkDeviations(draft({ groupNames: ['A'], groupCount: 1, network: { podNetwork: true } })),
    ).toEqual([])
  })

  it('keeps a choice with the same keys and defaults, resets otherwise', () => {
    const chosen = { internet: true, podNetwork: false }
    expect(choiceFits(chosen, both, both)).toBe(true)
    expect(choiceFits(chosen, both, { internet: { default: true }, podNetwork: { default: false } })).toBe(false)
    expect(choiceFits(chosen, both, { internet: { default: false } })).toBe(false)
    expect(choiceFits(undefined, undefined, both)).toBe(false)
  })
})
