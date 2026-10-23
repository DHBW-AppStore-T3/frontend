import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const openapi = JSON.parse(
  readFileSync(resolve(__dirname, '../../../src/types/openapi.json'), 'utf8'),
) as { paths: Record<string, Record<string, unknown>> }

// The routes the pod frontend calls (frontend#36). They come from the
// backend's OpenAPI document (spike/dev); if a regenerated document drops or
// renames one, this fails before a view does.
const REQUIRED_OPERATIONS: Array<[method: string, path: string]> = [
  ['get', '/apps/{app_id}/runtime'],
  ['get', '/me/openstack-credentials'],
  ['post', '/me/openstack-credentials'],
  ['post', '/me/openstack-credentials/from-yaml'],
  ['post', '/me/openstack-credentials/{credential_id}/test'],
  ['delete', '/me/openstack-credentials/{credential_id}'],
  ['get', '/me/openstack-credentials/{credential_id}/resources/networks'],
  ['post', '/deployments/{deployment_id}/workloads/{workload}/restart'],
  ['post', '/deployments/{deployment_id}/workloads/{workload}/reset'],
  ['get', '/deployments/{deployment_id}/my-access'],
]

const REMOVED_PATH_PREFIXES = ['/me/openstack/resources']

describe('OpenAPI contract of the backend', () => {
  const { paths } = openapi

  it.each(REQUIRED_OPERATIONS)('serves %s %s', (method, path) => {
    expect(paths[path]?.[method]).toBeDefined()
  })

  it.each(REMOVED_PATH_PREFIXES)('no longer serves %s (resources are per credential)', (prefix) => {
    expect(Object.keys(paths).filter((p) => p.startsWith(prefix))).toEqual([])
  })

  it('no longer serves resend-access', () => {
    expect(Object.keys(paths).filter((p) => p.includes('resend-access'))).toEqual([])
  })
})
