import { useTranslation } from 'react-i18next'
import type { AppCredentialForm, PasswordCredentialForm } from './credentialForm'

const INPUT_BASE = 'w-full border rounded-md px-3 py-2 text-sm'

interface FieldProps {
  label: string
  testId: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'url' | 'password'
  mono?: boolean
  placeholder?: string
}

function Field({ label, testId, value, onChange, type = 'text', mono, placeholder }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-textMuted mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        type={type}
        placeholder={placeholder}
        className={`${INPUT_BASE}${mono ? ' font-mono' : ''}`}
      />
    </div>
  )
}

interface FormProps<T> {
  form: T
  onChange: (form: T) => void
}

export function AppCredentialFields({ form, onChange }: FormProps<AppCredentialForm>) {
  const { t } = useTranslation()
  const set = (patch: Partial<AppCredentialForm>) => onChange({ ...form, ...patch })

  return (
    <div className="p-6 space-y-4">
      <Field
        label={t('SettingsOpenStackView.fields.authUrl')}
        testId="app-auth-url"
        type="url"
        placeholder={t('SettingsOpenStackView.placeholders.authUrl')}
        value={form.auth_url}
        onChange={(auth_url) => set({ auth_url })}
      />
      <Field
        label={t('SettingsOpenStackView.fields.region')}
        testId="app-region"
        placeholder={t('SettingsOpenStackView.placeholders.region')}
        value={form.region_name}
        onChange={(region_name) => set({ region_name })}
      />
      <Field
        label={t('SettingsOpenStackView.fields.appCredentialId')}
        testId="app-identifier"
        mono
        value={form.identifier}
        onChange={(identifier) => set({ identifier })}
      />
      <Field
        label={t('SettingsOpenStackView.fields.appCredentialSecret')}
        testId="app-secret"
        type="password"
        mono
        value={form.secret}
        onChange={(secret) => set({ secret })}
      />
    </div>
  )
}

export function PasswordCredentialFields({ form, onChange }: FormProps<PasswordCredentialForm>) {
  const { t } = useTranslation()
  const set = (patch: Partial<PasswordCredentialForm>) => onChange({ ...form, ...patch })
  const pair = 'grid grid-cols-1 md:grid-cols-2 gap-4'

  return (
    <div className="p-6 space-y-4">
      <Field
        label={t('SettingsOpenStackView.fields.authUrl')}
        testId="pwd-auth-url"
        type="url"
        value={form.auth_url}
        onChange={(auth_url) => set({ auth_url })}
      />
      <div className={pair}>
        <Field
          label={t('SettingsOpenStackView.fields.region')}
          testId="pwd-region"
          value={form.region_name}
          onChange={(region_name) => set({ region_name })}
        />
        <Field
          label={t('SettingsOpenStackView.fields.userDomain')}
          testId="pwd-user-domain"
          value={form.user_domain_name}
          onChange={(user_domain_name) => set({ user_domain_name })}
        />
      </div>
      <div className={pair}>
        <Field
          label={t('SettingsOpenStackView.fields.username')}
          testId="pwd-identifier"
          value={form.identifier}
          onChange={(identifier) => set({ identifier })}
        />
        <Field
          label={t('SettingsOpenStackView.fields.password')}
          testId="pwd-secret"
          type="password"
          value={form.secret}
          onChange={(secret) => set({ secret })}
        />
      </div>
      <div className={pair}>
        <Field
          label={t('SettingsOpenStackView.fields.projectId')}
          testId="pwd-project-id"
          mono
          value={form.project_id}
          onChange={(project_id) => set({ project_id })}
        />
        <Field
          label={t('SettingsOpenStackView.fields.projectName')}
          testId="pwd-project-name"
          value={form.project_name}
          onChange={(project_name) => set({ project_name })}
        />
      </div>
      <Field
        label={t('SettingsOpenStackView.fields.projectDomain')}
        testId="pwd-project-domain"
        value={form.project_domain_name}
        onChange={(project_domain_name) => set({ project_domain_name })}
      />
    </div>
  )
}
