import { useTranslation } from 'react-i18next'
import type { AppCredentialForm, PasswordCredentialForm } from './credentialForm'

const INPUT_BASE = 'w-full border rounded-md px-3 py-2 text-sm disabled:bg-surfaceMuted disabled:cursor-not-allowed'

interface FieldProps {
  label: string
  testId: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  type?: 'text' | 'url' | 'password'
  mono?: boolean
  placeholder?: string
}

function Field({ label, testId, value, onChange, disabled, type = 'text', mono, placeholder }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-textMuted mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className={`${INPUT_BASE}${mono ? ' font-mono' : ''}`}
      />
    </div>
  )
}

interface FormProps<T> {
  form: T
  onChange: (form: T) => void
  disabled: boolean
}

export function AppCredentialFields({ form, onChange, disabled }: FormProps<AppCredentialForm>) {
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
        disabled={disabled}
      />
      <Field
        label={t('SettingsOpenStackView.fields.region')}
        testId="app-region"
        placeholder={t('SettingsOpenStackView.placeholders.region')}
        value={form.region_name}
        onChange={(region_name) => set({ region_name })}
        disabled={disabled}
      />
      <Field
        label={t('SettingsOpenStackView.fields.appCredentialId')}
        testId="app-identifier"
        mono
        value={form.identifier}
        onChange={(identifier) => set({ identifier })}
        disabled={disabled}
      />
      <Field
        label={t('SettingsOpenStackView.fields.appCredentialSecret')}
        testId="app-secret"
        type="password"
        mono
        value={form.secret}
        onChange={(secret) => set({ secret })}
        disabled={disabled}
      />
    </div>
  )
}

export function PasswordCredentialFields({ form, onChange, disabled }: FormProps<PasswordCredentialForm>) {
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
        disabled={disabled}
      />
      <div className={pair}>
        <Field
          label={t('SettingsOpenStackView.fields.region')}
          testId="pwd-region"
          value={form.region_name}
          onChange={(region_name) => set({ region_name })}
          disabled={disabled}
        />
        <Field
          label={t('SettingsOpenStackView.fields.userDomain')}
          testId="pwd-user-domain"
          value={form.user_domain_name}
          onChange={(user_domain_name) => set({ user_domain_name })}
          disabled={disabled}
        />
      </div>
      <div className={pair}>
        <Field
          label={t('SettingsOpenStackView.fields.username')}
          testId="pwd-identifier"
          value={form.identifier}
          onChange={(identifier) => set({ identifier })}
          disabled={disabled}
        />
        <Field
          label={t('SettingsOpenStackView.fields.password')}
          testId="pwd-secret"
          type="password"
          value={form.secret}
          onChange={(secret) => set({ secret })}
          disabled={disabled}
        />
      </div>
      <div className={pair}>
        <Field
          label={t('SettingsOpenStackView.fields.projectId')}
          testId="pwd-project-id"
          mono
          value={form.project_id}
          onChange={(project_id) => set({ project_id })}
          disabled={disabled}
        />
        <Field
          label={t('SettingsOpenStackView.fields.projectName')}
          testId="pwd-project-name"
          value={form.project_name}
          onChange={(project_name) => set({ project_name })}
          disabled={disabled}
        />
      </div>
      <Field
        label={t('SettingsOpenStackView.fields.projectDomain')}
        testId="pwd-project-domain"
        value={form.project_domain_name}
        onChange={(project_domain_name) => set({ project_domain_name })}
        disabled={disabled}
      />
    </div>
  )
}
