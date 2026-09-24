import { describe, it, expect } from 'vitest'
import { parseCloudsYaml, CloudsYamlError } from '@/utils/clouds-yaml'

// auth_url must live inside the auth: block (parser reads auth.auth_url)
const APP_CRED_YAML = `
clouds:
  mycloud:
    auth_type: v3applicationcredential
    region_name: RegionOne
    interface: public
    identity_api_version: "3"
    auth:
      auth_url: https://openstack.example.com:5000/v3
      application_credential_id: cred-id-123
      application_credential_secret: super-secret
`

const PASSWORD_YAML = `
clouds:
  mycloud:
    region_name: RegionOne
    auth:
      auth_url: https://openstack.example.com:5000/v3
      username: johndoe
      password: hunter2
      user_domain_name: Default
      project_id: proj-abc
      project_name: my-project
`

const MULTI_CLOUD_YAML = `
clouds:
  first:
    auth_type: v3applicationcredential
    auth:
      auth_url: https://first.example.com
      application_credential_id: first-id
      application_credential_secret: first-secret
  second:
    auth_type: v3applicationcredential
    auth:
      auth_url: https://second.example.com
      application_credential_id: second-id
      application_credential_secret: second-secret
`

describe('parseCloudsYaml', () => {
  describe('Application Credential auth_type', () => {
    it('parses a v3applicationcredential cloud correctly', () => {
      const result = parseCloudsYaml(APP_CRED_YAML)
      expect(result.auth_type).toBe('v3applicationcredential')
      expect(result.auth_url).toBe('https://openstack.example.com:5000/v3')
      expect(result.region_name).toBe('RegionOne')
      expect(result.identifier).toBe('cred-id-123')
      expect(result.secret).toBe('super-secret')
      expect(result.cloud_name).toBe('mycloud')
    })

    it('auto-detects app-credential type from fields when auth_type is absent', () => {
      const yaml = `
clouds:
  cloud:
    auth:
      auth_url: https://os.example.com
      application_credential_id: auto-id
      application_credential_secret: auto-secret
`
      const result = parseCloudsYaml(yaml)
      expect(result.auth_type).toBe('v3applicationcredential')
      expect(result.identifier).toBe('auto-id')
    })

    it('sets empty strings for password-only fields', () => {
      const result = parseCloudsYaml(APP_CRED_YAML)
      expect(result.project_id).toBe('')
      expect(result.project_name).toBe('')
      expect(result.user_domain_name).toBe('')
      expect(result.project_domain_name).toBe('')
    })
  })

  describe('Password auth_type', () => {
    it('parses a password cloud correctly', () => {
      const result = parseCloudsYaml(PASSWORD_YAML)
      expect(result.auth_type).toBe('password')
      expect(result.auth_url).toBe('https://openstack.example.com:5000/v3')
      expect(result.identifier).toBe('johndoe')
      expect(result.secret).toBe('hunter2')
      expect(result.project_id).toBe('proj-abc')
      expect(result.project_name).toBe('my-project')
      expect(result.user_domain_name).toBe('Default')
    })

    it('falls back to "Default" for user_domain_name when absent', () => {
      const yaml = `
clouds:
  cloud:
    auth:
      auth_url: https://os.example.com
      username: bob
      password: pass
      project_id: p1
`
      const result = parseCloudsYaml(yaml)
      expect(result.user_domain_name).toBe('Default')
    })
  })

  describe('fallback values', () => {
    it('falls back to "public" when interface is absent', () => {
      const result = parseCloudsYaml(PASSWORD_YAML)
      expect(result.interface).toBe('public')
    })

    it('falls back to "3" when identity_api_version is absent', () => {
      const result = parseCloudsYaml(PASSWORD_YAML)
      expect(result.identity_api_version).toBe('3')
    })

    it('uses explicit interface and version when provided', () => {
      const result = parseCloudsYaml(APP_CRED_YAML)
      expect(result.interface).toBe('public')
      expect(result.identity_api_version).toBe('3')
    })
  })

  describe('multi-cloud documents', () => {
    it('picks the first cloud when no preferredName is given', () => {
      const result = parseCloudsYaml(MULTI_CLOUD_YAML)
      expect(result.cloud_name).toBe('first')
      expect(result.auth_url).toBe('https://first.example.com')
    })

    it('picks the preferred cloud by name', () => {
      const result = parseCloudsYaml(MULTI_CLOUD_YAML, 'second')
      expect(result.cloud_name).toBe('second')
      expect(result.auth_url).toBe('https://second.example.com')
    })

    it('falls back to the first cloud when preferredName does not exist', () => {
      const result = parseCloudsYaml(MULTI_CLOUD_YAML, 'nonexistent')
      expect(result.cloud_name).toBe('first')
    })
  })

  describe('error cases', () => {
    it('throws CloudsYamlError for invalid YAML syntax', () => {
      expect(() => parseCloudsYaml('bad yaml: {')).toThrow(CloudsYamlError)
    })

    it('throws CloudsYamlError when clouds section is missing', () => {
      expect(() => parseCloudsYaml('no_clouds_here: true')).toThrow(CloudsYamlError)
      expect(() => parseCloudsYaml('no_clouds_here: true')).toThrow('Keine "clouds:" Sektion gefunden.')
    })

    it('throws CloudsYamlError when clouds section is empty', () => {
      expect(() => parseCloudsYaml('clouds: {}')).toThrow(CloudsYamlError)
    })

    it('CloudsYamlError is an instance of Error', () => {
      expect(() => parseCloudsYaml('bad yaml: {')).toThrow(Error)
    })
  })
})
