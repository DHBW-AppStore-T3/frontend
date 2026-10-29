import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDeploymentStore } from '../deployment.store'
import { deploymentApi } from '@/api/deployment.api'
import type { AppVariable, DeploymentDraft, DeploymentFile } from '@/types'

/**
 * Golden tests for ``submitDraft`` (frontend#85).
 *
 * They pin the payload that is POSTed today, through the real store
 * interface, against literals worked out by hand from the current code.
 * They are the safety net for moving the payload logic out of the store:
 * they must pass unchanged before and after the move. Where the current
 * behaviour looks odd (``assignments`` as a plain object is ignored,
 * release tags are not trimmed, ...) the test records it as it is; it is
 * not a recommendation.
 *
 * The expectations are written out literally (``toStrictEqual``), never
 * generated from the implementation's output.
 */

vi.mock('@/api/deployment.api', () => ({
  deploymentApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  },
}))

const createMock = vi.mocked(deploymentApi.create)

/** Runs ``submitDraft`` with the default draft plus ``patch`` and returns the payload sent to the API. */
async function submit(patch: Partial<DeploymentDraft> = {}): Promise<unknown> {
  const store = useDeploymentStore.getState()
  store.resetDraft()
  store.updateDraft({ appId: 'app-1', name: 'Demo', releaseTag: 'v1.2.3', ...patch })
  await useDeploymentStore.getState().submitDraft()
  expect(createMock).toHaveBeenCalledTimes(1)
  return createMock.mock.calls[0][0]
}

/** The payload the API gets for a draft without teams, variables, files, resources or network. */
const basePayload = {
  name: 'Demo',
  appId: 'app-1',
  releaseTag: 'v1.2.3',
  userInputVar: { terraform: {} },
  teams: [],
}

const file = (name: string): DeploymentFile => ({ name, content_b64: 'QUJD', size: 3, content_type: 'text/plain' })
const emptyFile: DeploymentFile = { name: '', content_b64: '', size: 0 }

const def = (over: Partial<AppVariable> & { name: string }): AppVariable => ({ type: 'string', ...over })

describe('submitDraft golden payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMock.mockResolvedValue({ data: { deploymentId: 'd-1' } } as never)
    useDeploymentStore.setState(useDeploymentStore.getInitialState(), true)
  })

  describe('validation', () => {
    it.each([
      ['appId is null', { appId: null }],
      ['appId is empty', { appId: '' }],
      ['name is empty', { name: '' }],
    ])('throws "App und Name sind Pflichtfelder" when %s and sends nothing', async (_label, patch) => {
      const store = useDeploymentStore.getState()
      store.resetDraft()
      store.updateDraft({ appId: 'app-1', name: 'Demo', ...patch })
      await expect(useDeploymentStore.getState().submitDraft()).rejects.toThrow('App und Name sind Pflichtfelder')
      expect(createMock).not.toHaveBeenCalled()
    })

    it('throws on the untouched default draft', async () => {
      useDeploymentStore.getState().resetDraft()
      await expect(useDeploymentStore.getState().submitDraft()).rejects.toThrow('App und Name sind Pflichtfelder')
      expect(createMock).not.toHaveBeenCalled()
    })
  })

  describe('result', () => {
    it('sends exactly name, appId, releaseTag, userInputVar and teams, and returns the created deployment', async () => {
      const store = useDeploymentStore.getState()
      store.resetDraft()
      store.updateDraft({ appId: 'app-1', name: 'Demo', releaseTag: 'v1.2.3' })
      const created = await useDeploymentStore.getState().submitDraft()

      expect(created).toStrictEqual({ deploymentId: 'd-1' })
      expect(createMock.mock.calls[0][0]).toStrictEqual(basePayload)
      expect(useDeploymentStore.getState().deployments).toStrictEqual([{ deploymentId: 'd-1' }])
    })

    it('does not send runtime, scope, version or credentialId (the current code has no such path)', async () => {
      const payload = await submit({ runtime: 'kubevirt-vm', scope: 'user', version: '9.9' })
      expect(payload).toStrictEqual(basePayload)
    })
  })

  describe('releaseTag', () => {
    it.each([
      ['a string', 'v1.2.3', 'v1.2.3'],
      ['a string that is not trimmed', ' v2 ', ' v2 '],
      ['an empty string', '', 'latest'],
      ['a blank string', '   ', 'latest'],
      ['an object with version and name (version wins)', { version: '2.0', name: 'rc1' }, '2.0'],
      ['an object with only a name', { name: 'rc1' }, 'rc1'],
      ['an object with an empty version (name wins)', { version: '', name: 'rc1' }, 'rc1'],
      ['an object with neither', {}, 'latest'],
      ['an object whose version is a number (skipped, name wins)', { version: 2, name: 'rc1' }, 'rc1'],
      ['an object whose only version is a number', { version: 2 }, 'latest'],
      ['an object whose name is an object', { name: { x: 1 } }, 'latest'],
      ['an object with a blank version (skipped, name wins)', { version: '  ', name: 'rc1' }, 'rc1'],
      ['an object with empty version and name', { version: '', name: '' }, 'latest'],
      ['an array', ['v1'], 'latest'],
      ['null', null, 'latest'],
      ['undefined', undefined, 'latest'],
      ['a number', 5, 'latest'],
    ])('resolves %s', async (_label, releaseTag, expected) => {
      const payload = await submit({ releaseTag: releaseTag as unknown as string })
      expect(payload).toStrictEqual({ ...basePayload, releaseTag: expected })
    })
  })

  describe('teams from groupNames and assignments', () => {
    it('pairs each group name with its assignment', async () => {
      const payload = await submit({
        groupNames: ['Alpha', 'Beta'],
        assignments: [['u1', 'u2'], ['u3']] as unknown as DeploymentDraft['assignments'],
        studentIds: ['u1', 'u2', 'u3'],
        groupCount: 2,
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [
          { name: 'Alpha', userIds: ['u1', 'u2'] },
          { name: 'Beta', userIds: ['u3'] },
        ],
      })
    })

    it('gives a group without an array assignment an empty member list', async () => {
      const payload = await submit({
        groupNames: ['A', 'B', 'C'],
        assignments: [['u1'], 'u2'] as unknown as DeploymentDraft['assignments'],
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [
          { name: 'A', userIds: ['u1'] },
          { name: 'B', userIds: [] },
          { name: 'C', userIds: [] },
        ],
      })
    })

    it('keeps group names with empty members when assignments is the empty default (no fallback)', async () => {
      const payload = await submit({ groupNames: ['Red'], studentIds: ['s1', 's2'], groupCount: 2 })
      expect(payload).toStrictEqual({ ...basePayload, teams: [{ name: 'Red', userIds: [] }] })
    })

    it('ignores assignments entries beyond the group names', async () => {
      const payload = await submit({
        groupNames: ['A'],
        assignments: [['u1'], ['u2']] as unknown as DeploymentDraft['assignments'],
      })
      expect(payload).toStrictEqual({ ...basePayload, teams: [{ name: 'A', userIds: ['u1'] }] })
    })

    it('converts member ids that are not strings to strings', async () => {
      const payload = await submit({
        groupNames: ['A', 'B'],
        assignments: [[1, 2], [3]] as unknown as DeploymentDraft['assignments'],
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [
          { name: 'A', userIds: ['1', '2'] },
          { name: 'B', userIds: ['3'] },
        ],
      })
    })
  })

  describe('automatic teams from studentIds and groupCount', () => {
    it('sends no teams without group names and without students', async () => {
      expect(await submit({ groupCount: 3 })).toStrictEqual(basePayload)
    })

    it('puts everyone in Team-1 for the default groupCount of 1', async () => {
      const payload = await submit({ studentIds: ['s1', 's2', 's3'] })
      expect(payload).toStrictEqual({ ...basePayload, teams: [{ name: 'Team-1', userIds: ['s1', 's2', 's3'] }] })
    })

    it('splits evenly', async () => {
      const payload = await submit({ studentIds: ['s1', 's2', 's3', 's4'], groupCount: 2 })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [
          { name: 'Team-1', userIds: ['s1', 's2'] },
          { name: 'Team-2', userIds: ['s3', 's4'] },
        ],
      })
    })

    it('hands the remainder out to the first groups (5 students, 3 groups: 2, 2, 1)', async () => {
      const payload = await submit({ studentIds: ['s1', 's2', 's3', 's4', 's5'], groupCount: 3 })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [
          { name: 'Team-1', userIds: ['s1', 's2'] },
          { name: 'Team-2', userIds: ['s3', 's4'] },
          { name: 'Team-3', userIds: ['s5'] },
        ],
      })
    })

    it('creates empty teams when there are more groups than students (2 students, 3 groups: 1, 1, 0)', async () => {
      const payload = await submit({ studentIds: ['s1', 's2'], groupCount: 3 })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [
          { name: 'Team-1', userIds: ['s1'] },
          { name: 'Team-2', userIds: ['s2'] },
          { name: 'Team-3', userIds: [] },
        ],
      })
    })

    it('uses the fallback when assignments is a plain object (not what the type says any more, issue 144), with names from groupNames and Team-n for the rest', async () => {
      const payload = await submit({
        groupNames: ['A'],
        assignments: { 0: ['x'], 1: ['y'] } as unknown as DeploymentDraft['assignments'],
        studentIds: ['s1', 's2', 's3'],
        groupCount: 2,
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [
          { name: 'A', userIds: ['s1', 's2'] },
          { name: 'Team-2', userIds: ['s3'] },
        ],
      })
    })

    it('converts student ids that are not strings to strings', async () => {
      const payload = await submit({ studentIds: [10, 20] as unknown as string[] })
      expect(payload).toStrictEqual({ ...basePayload, teams: [{ name: 'Team-1', userIds: ['10', '20'] }] })
    })
  })

  describe('variables with definitions', () => {
    it('sends only defined variables, with their values untouched', async () => {
      const payload = await submit({
        variableDefinitions: [def({ name: 'region' }), def({ name: 'count', type: 'number' }), def({ name: 'tags', type: 'list' })],
        variables: { region: 'eu', count: 3, tags: ['a', 'b'], undeclared: 'dropped' },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        userInputVar: { terraform: { region: 'eu', count: 3, tags: ['a', 'b'] } },
      })
    })

    it('keeps values that are falsy but not empty (0, false, empty list, empty object, padded string)', async () => {
      const payload = await submit({
        variableDefinitions: [
          def({ name: 'zero', type: 'number' }),
          def({ name: 'off', type: 'bool' }),
          def({ name: 'list', type: 'list' }),
          def({ name: 'map', type: 'map' }),
          def({ name: 'padded' }),
        ],
        variables: { zero: 0, off: false, list: [], map: {}, padded: '  x ' },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        userInputVar: { terraform: { zero: 0, off: false, list: [], map: {}, padded: '  x ' } },
      })
    })

    it('leaves out undefined, null, empty and blank values so the HCL default wins', async () => {
      const payload = await submit({
        variableDefinitions: [
          def({ name: 'missing' }),
          def({ name: 'nothing' }),
          def({ name: 'empty' }),
          def({ name: 'blank' }),
          def({ name: 'kept' }),
        ],
        variables: { nothing: null, empty: '', blank: '   ', kept: 'yes' },
      })
      expect(payload).toStrictEqual({ ...basePayload, userInputVar: { terraform: { kept: 'yes' } } })
    })

    it('leaves out empty maps of team and user scoped variables only', async () => {
      const payload = await submit({
        variableDefinitions: [
          def({ name: 'team', type: 'map', varScope: 'team' }),
          def({ name: 'user', type: 'map', varScope: 'user' }),
          def({ name: 'shared', type: 'map', varScope: 'all' }),
          def({ name: 'plain', type: 'map' }),
          def({ name: 'filled', type: 'map', varScope: 'team' }),
        ],
        variables: { team: {}, user: {}, shared: {}, plain: {}, filled: { Alpha: 'x' } },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        userInputVar: { terraform: { shared: {}, plain: {}, filled: { Alpha: 'x' } } },
      })
    })

    it('sends packer variables next to terraform ones under the same terraform key', async () => {
      const payload = await submit({
        variableDefinitions: [def({ name: 'image', source: 'packer' }), def({ name: 'size', source: 'terraform' })],
        variables: { image: 'ubuntu', size: 's' },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        userInputVar: { terraform: { image: 'ubuntu', size: 's' } },
      })
    })

    it('does not send the variables of an empty definition list (the default draft)', async () => {
      const payload = await submit({ variableDefinitions: [], variables: { a: 1 } })
      expect(payload).toStrictEqual(basePayload)
    })

    it('does not send file variables as plain variables', async () => {
      const payload = await submit({
        variableDefinitions: [def({ name: 'cert', osType: 'file', osScope: 'all' }), def({ name: 'name' })],
        variables: { cert: 'ignored', name: 'n' },
      })
      expect(payload).toStrictEqual({ ...basePayload, userInputVar: { terraform: { name: 'n' } } })
    })
  })

  describe('variables without usable definitions', () => {
    it('copies all variables, including empty ones, when variableDefinitions is not an array', async () => {
      const payload = await submit({
        variableDefinitions: undefined,
        variables: { a: 'x', b: null, c: '', d: [1] },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        userInputVar: { terraform: { a: 'x', b: null, c: '', d: [1] } },
      })
    })

    it('treats an object as variableDefinitions the same way', async () => {
      const payload = await submit({
        variableDefinitions: { name: 'a' } as unknown as AppVariable[],
        variables: { a: 'x' },
      })
      expect(payload).toStrictEqual({ ...basePayload, userInputVar: { terraform: { a: 'x' } } })
    })

    it('sends an empty terraform object when variables is null', async () => {
      const payload = await submit({
        variables: null as unknown as DeploymentDraft['variables'],
        variableDefinitions: [def({ name: 'a' })],
      })
      expect(payload).toStrictEqual(basePayload)
    })
  })

  describe('fileUploads', () => {
    it('sends filled slots under files, keeping the file objects as they are', async () => {
      const cert = file('a.pem')
      const payload = await submit({ fileUploads: { cert: { all: cert } } })
      expect(payload).toStrictEqual({ ...basePayload, files: { cert: { all: cert } } })
    })

    it('drops empty slots, empty variables and null slot maps', async () => {
      const teamA = file('a.txt')
      const payload = await submit({
        fileUploads: {
          cert: { all: file('c.pem') },
          blank: { all: emptyFile },
          none: {},
          gone: null as unknown as Record<string, DeploymentFile>,
          perTeam: { Alpha: teamA, Beta: emptyFile },
        },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        files: { cert: { all: file('c.pem') }, perTeam: { Alpha: teamA } },
      })
    })

    it('omits files when no slot is filled', async () => {
      const payload = await submit({ fileUploads: { cert: { all: emptyFile }, other: {} } })
      expect(payload).toStrictEqual(basePayload)
    })

    it('omits files when fileUploads is undefined', async () => {
      expect(await submit({ fileUploads: undefined })).toStrictEqual(basePayload)
    })

    it('sends a file variable only under files, not under userInputVar', async () => {
      const cert = file('c.pem')
      const payload = await submit({
        variableDefinitions: [def({ name: 'cert', osType: 'file', osScope: 'all' }), def({ name: 'name' })],
        variables: { cert: 'x', name: 'n' },
        fileUploads: { cert: { all: cert } },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        userInputVar: { terraform: { name: 'n' } },
        files: { cert: { all: cert } },
      })
    })
  })

  describe('resources', () => {
    it('sends the chosen cpu and memory under userInputVar.resources', async () => {
      const resources = { web: { cpu: '500m', memory: '512Mi' }, db: { cpu: '1', memory: '1Gi' } }
      const payload = await submit({ resources })
      expect(payload).toStrictEqual({ ...basePayload, userInputVar: { terraform: {}, resources } })
    })

    it.each([
      ['an empty map', {}],
      ['undefined', undefined],
    ])('sends no resources for %s', async (_label, resources) => {
      expect(await submit({ resources })).toStrictEqual(basePayload)
    })
  })

  describe('network', () => {
    const twoGroups = { groupNames: ['A', 'B'] }

    it('sends the author default when nothing was chosen', async () => {
      const payload = await submit({
        ...twoGroups,
        networkChoices: { internet: { default: true }, podNetwork: { default: false } },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [
          { name: 'A', userIds: [] },
          { name: 'B', userIds: [] },
        ],
        userInputVar: { terraform: {}, network: { internet: true, podNetwork: false } },
      })
    })

    it('sends the choice made over the default, only for the allowed keys', async () => {
      const payload = await submit({
        ...twoGroups,
        networkChoices: { internet: { default: true } },
        network: { internet: false, podNetwork: true },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [
          { name: 'A', userIds: [] },
          { name: 'B', userIds: [] },
        ],
        userInputVar: { terraform: {}, network: { internet: false } },
      })
    })

    it('leaves out pod networking with a single workload', async () => {
      const payload = await submit({
        groupNames: ['A'],
        networkChoices: { internet: { default: false }, podNetwork: { default: true } },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [{ name: 'A', userIds: [] }],
        userInputVar: { terraform: {}, network: { internet: false } },
      })
    })

    it('counts one workload per student for scope user', async () => {
      const payload = await submit({
        scope: 'user',
        studentIds: ['s1', 's2'],
        groupNames: ['A'],
        networkChoices: { podNetwork: { default: true } },
      })
      expect(payload).toStrictEqual({
        ...basePayload,
        teams: [{ name: 'A', userIds: [] }],
        userInputVar: { terraform: {}, network: { podNetwork: true } },
      })
    })

    it('sends no network when the app offers nothing', async () => {
      expect(await submit({ networkChoices: {}, network: { internet: true } })).toStrictEqual(basePayload)
    })
  })

  describe('everything together', () => {
    it('builds the complete payload', async () => {
      const cert = file('c.pem')
      const payload = await submit({
        name: 'Full',
        releaseTag: { version: '3.1', name: 'ignored' } as unknown as string,
        groupNames: ['Alpha', 'Beta'],
        assignments: [['u1'], [2]] as unknown as DeploymentDraft['assignments'],
        variableDefinitions: [
          def({ name: 'region' }),
          def({ name: 'cert', osType: 'file', osScope: 'all' }),
          def({ name: 'unset' }),
        ],
        variables: { region: 'eu', cert: 'x' },
        fileUploads: { cert: { all: cert } },
        resources: { web: { cpu: '1', memory: '1Gi' } },
        networkChoices: { internet: { default: false }, podNetwork: { default: true } },
        network: { internet: true },
      })
      expect(payload).toStrictEqual({
        name: 'Full',
        appId: 'app-1',
        releaseTag: '3.1',
        teams: [
          { name: 'Alpha', userIds: ['u1'] },
          { name: 'Beta', userIds: ['2'] },
        ],
        userInputVar: {
          terraform: { region: 'eu' },
          resources: { web: { cpu: '1', memory: '1Gi' } },
          network: { internet: true, podNetwork: true },
        },
        files: { cert: { all: cert } },
      })
    })
  })
})

describe('submitDraft: scope the person chose', () => {
  it('sends the scope only where the app lets the person choose', async () => {
    const chosen = (await submit({ groupNames: ['A'], scope: 'team', scopeChoice: true })) as { userInputVar: unknown }
    expect(chosen.userInputVar).toStrictEqual({ terraform: {}, scope: 'team' })
    const fixed = (await submit({ groupNames: ['A'], scope: 'user', scopeChoice: false })) as { userInputVar: unknown }
    expect(fixed.userInputVar).toStrictEqual({ terraform: {} })
  })
})
