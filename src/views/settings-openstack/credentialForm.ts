import type { ParsedCloudsYaml } from '@/utils/clouds-yaml'
import type { OpenStackAuthType, OpenStackCredentialUpsert } from '@/types/openstack-credential'

export type CredentialTab = 'app' | 'password'

export interface AppCredentialForm {
  auth_url: string
  region_name: string
  identifier: string
  secret: string
}

export interface PasswordCredentialForm extends AppCredentialForm {
  project_id: string
  project_name: string
  user_domain_name: string
  project_domain_name: string
}

const DEFAULT_USER_DOMAIN = 'Default'
const PUBLIC_INTERFACE = 'public'
const IDENTITY_API_VERSION = '3'

export const emptyAppForm = (): AppCredentialForm => ({
  auth_url: '',
  region_name: '',
  identifier: '',
  secret: '',
})

export const emptyPasswordForm = (): PasswordCredentialForm => ({
  ...emptyAppForm(),
  project_id: '',
  project_name: '',
  user_domain_name: DEFAULT_USER_DOMAIN,
  project_domain_name: '',
})

const emptyToNull = (value: string) => value || null

function buildAppPayload(form: AppCredentialForm): OpenStackCredentialUpsert | null {
  if (!form.auth_url || !form.identifier || !form.secret) return null
  return {
    auth_type: 'v3applicationcredential' as OpenStackAuthType,
    auth_url: form.auth_url,
    region_name: emptyToNull(form.region_name),
    interface: PUBLIC_INTERFACE,
    identity_api_version: IDENTITY_API_VERSION,
    identifier: form.identifier,
    secret: form.secret,
  }
}

function buildPasswordPayload(form: PasswordCredentialForm): OpenStackCredentialUpsert | null {
  const hasCoreFields = form.auth_url && form.identifier && form.secret && form.user_domain_name
  const hasProject = form.project_id || form.project_name
  if (!hasCoreFields || !hasProject) return null
  return {
    auth_type: 'password' as OpenStackAuthType,
    auth_url: form.auth_url,
    region_name: emptyToNull(form.region_name),
    interface: PUBLIC_INTERFACE,
    identity_api_version: IDENTITY_API_VERSION,
    identifier: form.identifier,
    secret: form.secret,
    project_id: emptyToNull(form.project_id),
    project_name: emptyToNull(form.project_name),
    user_domain_name: form.user_domain_name,
    project_domain_name: emptyToNull(form.project_domain_name),
  }
}

/** Payload for the active tab, or ``null`` while required fields are missing. */
export function buildPayload(
  tab: CredentialTab,
  app: AppCredentialForm,
  password: PasswordCredentialForm,
): OpenStackCredentialUpsert | null {
  return tab === 'app' ? buildAppPayload(app) : buildPasswordPayload(password)
}

export interface FormsState {
  tab: CredentialTab
  app: AppCredentialForm
  password: PasswordCredentialForm
}

/** Fill the form of the matching tab from an imported ``clouds.yaml``. */
export function formsFromYaml(parsed: ParsedCloudsYaml): FormsState {
  const common = {
    auth_url: parsed.auth_url,
    region_name: parsed.region_name,
    identifier: parsed.identifier,
    secret: parsed.secret,
  }
  if (parsed.auth_type === 'v3applicationcredential') {
    return { tab: 'app', app: common, password: emptyPasswordForm() }
  }
  return {
    tab: 'password',
    app: emptyAppForm(),
    password: {
      ...common,
      project_id: parsed.project_id,
      project_name: parsed.project_name,
      user_domain_name: parsed.user_domain_name || DEFAULT_USER_DOMAIN,
      project_domain_name: parsed.project_domain_name,
    },
  }
}
