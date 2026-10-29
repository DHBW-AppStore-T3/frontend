import { describe, it, expectTypeOf } from 'vitest'
import type { components } from '../api.generated'
import type {
  App,
  AppCreate,
  AppUpdate,
  AppVersionApproval,
  AppVersionApprovalStatus,
  AppVersionApprovalWithApp,
  AppWithUser,
  Course,
  CourseCreate,
  CourseUpdate,
  CourseWithUsers,
  DeploymentRuntime,
  DeploymentWithRelations,
  User,
} from '..'
import type { AppDetail } from '@/views/app-detail/versionInfo'

type Schemas = components['schemas']

/**
 * The course, app and version-approval types are derived from the OpenAPI schema
 * (frontend#87). Compile-time checks (``tsc -b`` is the proof), like the ones for
 * the deployment types in ``schema-derived.test.ts``.
 */
describe('schema-derived course, app and version-approval types', () => {
  it('uses the schema type where the types agree', () => {
    expectTypeOf<Course>().toEqualTypeOf<Schemas['CourseResponse']>()
    expectTypeOf<CourseWithUsers>().toEqualTypeOf<Schemas['CourseWithUsers']>()
    expectTypeOf<CourseCreate>().toEqualTypeOf<Schemas['CourseCreate']>()
    expectTypeOf<CourseUpdate>().toEqualTypeOf<Schemas['CourseUpdate']>()
    expectTypeOf<App>().toEqualTypeOf<Schemas['AppResponse']>()
    expectTypeOf<AppCreate>().toEqualTypeOf<Schemas['AppCreate']>()
    expectTypeOf<AppUpdate>().toEqualTypeOf<Schemas['AppUpdate']>()
    expectTypeOf<AppVersionApprovalStatus>().toEqualTypeOf<Schemas['AppVersionApprovalStatus']>()
  })

  it('App has no releaseTag: the API never returns one on an app', () => {
    expectTypeOf<App>().not.toHaveProperty('releaseTag')
    expectTypeOf<AppCreate>().not.toHaveProperty('releaseTag')
  })

  it('AppCreate requires name, is_private and submit_all_versions (schema defaults)', () => {
    expectTypeOf<AppCreate['name']>().toEqualTypeOf<string>()
    expectTypeOf<AppCreate['is_private']>().toEqualTypeOf<boolean>()
    expectTypeOf<AppCreate['submit_all_versions']>().toEqualTypeOf<boolean>()
    expectTypeOf<{ name: string }>().not.toExtend<AppCreate>()
  })

  it('AppWithUser adds the owner to the app', () => {
    expectTypeOf<AppWithUser['user']>().toEqualTypeOf<User>()
    expectTypeOf<AppWithUser>().toExtend<App>()
  })

  it('narrows the approval runtime to the known values', () => {
    expectTypeOf<AppVersionApproval['runtime']>().toEqualTypeOf<DeploymentRuntime>()
    expectTypeOf<Schemas['AppVersionApprovalResponse']['runtime']>().toEqualTypeOf<string>()
    expectTypeOf<AppVersionApproval['status']>().toEqualTypeOf<'pending' | 'approved' | 'rejected'>()
  })

  it('AppVersionApprovalWithApp carries the app', () => {
    expectTypeOf<AppVersionApprovalWithApp['app']>().toEqualTypeOf<App>()
    expectTypeOf<AppVersionApprovalWithApp>().toExtend<AppVersionApproval>()
  })

  it('DeploymentWithRelations.app is the same App', () => {
    expectTypeOf<DeploymentWithRelations['app']>().toEqualTypeOf<App>()
  })

  it('AppDetail is the app with everything but appId and name optional', () => {
    expectTypeOf<AppDetail['appId']>().toEqualTypeOf<string>()
    expectTypeOf<AppDetail['name']>().toEqualTypeOf<string>()
    expectTypeOf<AppDetail['deploy_version']>().toEqualTypeOf<App['deploy_version']>()
    expectTypeOf<App>().toExtend<AppDetail>()
  })
})
