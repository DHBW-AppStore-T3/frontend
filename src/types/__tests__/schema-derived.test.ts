import { describe, it, expectTypeOf } from 'vitest'
import type { components } from '../api.generated'
import type {
  Deployment,
  DeploymentCreate,
  DeploymentFile,
  DeploymentPermissions,
  DeploymentResourceListResponse,
  DeploymentStatus,
  DeploymentTeam,
  DeploymentWithRelations,
  PodSetupProgress,
  PodWorkload,
  Task,
  TaskStatus,
  TaskType,
} from '..'

type Schemas = components['schemas']

/**
 * The deployment, task and pod types are derived from the OpenAPI schema
 * (frontend#86). These checks are compile-time (``tsc -b`` is the proof): they
 * fail when a type drifts from the schema or when one of the documented
 * differences (see HANDOVER) is changed by accident.
 */
describe('schema-derived deployment, task and pod types', () => {
  it('uses the schema type where the types agree', () => {
    expectTypeOf<DeploymentPermissions>().toEqualTypeOf<Schemas['DeploymentPermissions']>()
    expectTypeOf<DeploymentTeam>().toEqualTypeOf<Schemas['DeploymentTeamResponse']>()
    expectTypeOf<DeploymentFile>().toEqualTypeOf<Schemas['DeploymentFileUpload']>()
    expectTypeOf<PodWorkload>().toEqualTypeOf<Schemas['PodWorkloadSchema']>()
    expectTypeOf<PodSetupProgress>().toEqualTypeOf<Schemas['PodSetupProgress']>()
    expectTypeOf<DeploymentResourceListResponse>().toEqualTypeOf<Schemas['DeploymentResourceListResponse']>()
    expectTypeOf<TaskType>().toEqualTypeOf<Schemas['TaskType']>()
    expectTypeOf<TaskStatus>().toEqualTypeOf<Schemas['TaskStatus']>()
  })

  it('reads the user input as the object the schema describes, not as a string', () => {
    expectTypeOf<Deployment['userInputVar']>().toEqualTypeOf<{ [key: string]: unknown } | null | undefined>()
    expectTypeOf<DeploymentCreate['userInputVar']>().toEqualTypeOf<{ [key: string]: unknown } | null | undefined>()
  })

  it('keeps the outputs as the schema type instead of any', () => {
    expectTypeOf<DeploymentWithRelations['outputs']>().toEqualTypeOf<Schemas['DeploymentOutputs'] | null | undefined>()
  })

  it('keeps the narrower literal types the UI relies on (the schema says string)', () => {
    expectTypeOf<Deployment['status']>().toEqualTypeOf<DeploymentStatus>()
    expectTypeOf<DeploymentWithRelations['status']>().toEqualTypeOf<DeploymentStatus>()
    expectTypeOf<Deployment['runtime']>().toEqualTypeOf<'kubernetes' | 'kubevirt-vm' | undefined>()
  })

  it('types task logs as the schema does: text, never an object (#145)', () => {
    expectTypeOf<Task['logs']>().toEqualTypeOf<string | null | undefined>()
  })

  it('does not offer fields the backend request schema does not have', () => {
    expectTypeOf<DeploymentCreate>().not.toHaveProperty('commitHash')
    expectTypeOf<DeploymentCreate>().not.toHaveProperty('commitInfo')
  })
})
