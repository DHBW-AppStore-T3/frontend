import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensureVariableDefinitions, resolveNeedsVariablesStep } from '@/views/new-deployment/variableDefinitions'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'

const def = (name: string) => ({ name, type: 'string', source: 'terraform' })
const draft = () => useDeploymentStore.getState().draft

let fetchAppVariables: ReturnType<typeof vi.fn>

/** A fetch the test releases by hand, to look at the state while the backend is still working. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  useDeploymentStore.getState().resetDraft()
  useDeploymentStore.getState().updateDraft({ appId: 'app-1', releaseTag: '1.2.0' })
  fetchAppVariables = vi.fn().mockResolvedValue([def('region')])
  useAppStore.setState({ fetchAppVariables } as never)
})

describe('ensureVariableDefinitions', () => {
  it('starts out as not loaded: the default draft has no definitions at all', () => {
    expect(draft().variableDefinitions).toBeUndefined()
  })

  it('loads the definitions of the draft app and version into the draft', async () => {
    const defs = await ensureVariableDefinitions()

    expect(fetchAppVariables).toHaveBeenCalledExactlyOnceWith('app-1', '1.2.0')
    expect(defs).toEqual([def('region')])
    expect(draft().variableDefinitions).toEqual([def('region')])
  })

  it('drops duplicate definitions', async () => {
    fetchAppVariables.mockResolvedValue([def('a'), def('b'), { ...def('a'), default: 'later' }])

    await ensureVariableDefinitions()

    expect(draft().variableDefinitions).toEqual([def('a'), def('b')])
  })

  it('asks for "latest" when the draft has no release tag', async () => {
    useDeploymentStore.getState().updateDraft({ releaseTag: '' })

    await ensureVariableDefinitions()

    expect(fetchAppVariables).toHaveBeenCalledWith('app-1', 'latest')
  })

  it('remembers a loaded empty answer, and does not ask again', async () => {
    fetchAppVariables.mockResolvedValue([])

    await ensureVariableDefinitions()
    await ensureVariableDefinitions()

    expect(draft().variableDefinitions).toEqual([])
    expect(fetchAppVariables).toHaveBeenCalledTimes(1)
  })

  it('treats a missing body as an empty answer', async () => {
    fetchAppVariables.mockResolvedValue(undefined)

    expect(await ensureVariableDefinitions()).toEqual([])
    expect(draft().variableDefinitions).toEqual([])
  })

  it('returns definitions that are already in the draft without a request', async () => {
    useDeploymentStore.getState().updateDraft({ variableDefinitions: [def('cached')] as never })

    expect(await ensureVariableDefinitions()).toEqual([def('cached')])
    expect(fetchAppVariables).not.toHaveBeenCalled()
  })

  it('joins parallel calls into one request', async () => {
    const pending = deferred<unknown[]>()
    fetchAppVariables.mockReturnValue(pending.promise)

    const first = ensureVariableDefinitions()
    const second = ensureVariableDefinitions()
    pending.resolve([def('region')])

    expect(await first).toBe(await second)
    expect(fetchAppVariables).toHaveBeenCalledTimes(1)
  })

  it('rejects when the backend fails, leaves the draft "not loaded" and can be retried', async () => {
    fetchAppVariables.mockRejectedValueOnce(new Error('boom'))

    await expect(ensureVariableDefinitions()).rejects.toThrow('boom')
    expect(draft().variableDefinitions).toBeUndefined()

    await ensureVariableDefinitions()
    expect(fetchAppVariables).toHaveBeenCalledTimes(2)
    expect(draft().variableDefinitions).toEqual([def('region')])
  })

  it('rejects without a request when no app is selected', async () => {
    useDeploymentStore.getState().updateDraft({ appId: null })

    await expect(ensureVariableDefinitions()).rejects.toThrow()
    expect(fetchAppVariables).not.toHaveBeenCalled()
  })

  it('does not write an answer into a draft that moved on to another app meanwhile', async () => {
    const pending = deferred<unknown[]>()
    fetchAppVariables.mockReturnValue(pending.promise)

    const stale = ensureVariableDefinitions()
    useDeploymentStore.getState().resetDraft()
    useDeploymentStore.getState().updateDraft({ appId: 'app-2', releaseTag: '1.2.0' })
    pending.resolve([def('region')])
    await stale

    expect(draft().variableDefinitions).toBeUndefined()
  })

  it('does not join a request for another app', async () => {
    const pending = deferred<unknown[]>()
    fetchAppVariables.mockReturnValueOnce(pending.promise)

    const first = ensureVariableDefinitions()
    useDeploymentStore.getState().resetDraft()
    useDeploymentStore.getState().updateDraft({ appId: 'app-2', releaseTag: '1.2.0' })
    fetchAppVariables.mockResolvedValueOnce([def('other')])
    await ensureVariableDefinitions()
    pending.resolve([def('region')])
    await first

    expect(fetchAppVariables).toHaveBeenCalledTimes(2)
    expect(draft().variableDefinitions).toEqual([def('other')])
  })
})

describe('resolveNeedsVariablesStep', () => {
  it('answers false for a loaded app that has nothing to set', async () => {
    fetchAppVariables.mockResolvedValue([])

    expect(await resolveNeedsVariablesStep()).toBe(false)
  })

  it('answers true for an app with variables', async () => {
    expect(await resolveNeedsVariablesStep()).toBe(true)
  })

  it('answers without a request when the draft already knows', async () => {
    useDeploymentStore.getState().updateDraft({ variableDefinitions: [] })

    expect(await resolveNeedsVariablesStep()).toBe(false)
    expect(fetchAppVariables).not.toHaveBeenCalled()
  })

  it('does not ask the backend when resource choices already make the step necessary', async () => {
    useDeploymentStore.getState().updateDraft({
      resourceChoices: [{ container: 'vm', cpu: { default: '2', min: '1', max: '4' }, memory: { default: '4Gi', min: '2Gi', max: '8Gi' } }],
    })

    expect(await resolveNeedsVariablesStep()).toBe(true)
    expect(fetchAppVariables).not.toHaveBeenCalled()
  })

  it('stays unknown (null) when loading fails, so the step is not skipped', async () => {
    fetchAppVariables.mockRejectedValue(new Error('boom'))

    expect(await resolveNeedsVariablesStep()).toBeNull()
  })
})
