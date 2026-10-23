import { useTranslation } from 'react-i18next'
import type { OpenStackCredential } from '@/types/openstack-credential'

export interface CredentialPickerProps {
  /** Credentials a VM deployment can be created with. */
  credentials: OpenStackCredential[]
  value: string | null
  onChange: (credentialId: string | null) => void
}

/** VM apps: the OpenStack project (credential) the deployment is created in. */
export default function CredentialPicker({ credentials, value, onChange }: CredentialPickerProps) {
  const { t } = useTranslation()

  return (
    <div className="mb-8" data-testid="credential-picker">
      <label className="block text-xl font-bold text-textHeading mb-3" htmlFor="deployment-credential">
        {t('deployment.config.credentialLabel')}
      </label>
      <select
        id="deployment-credential"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        data-testid="deployment-credential"
        className="w-full px-4 py-3 rounded-full border-2 border-borderSubtle focus:border-primary outline-none bg-white"
      >
        <option value="" disabled>
          {t('deployment.config.credentialPlaceholder')}
        </option>
        {credentials.map((c) => (
          <option key={c.credentialId} value={c.credentialId}>
            {c.project_name || c.project_id}
          </option>
        ))}
      </select>
      <p className="text-sm text-textMuted mt-2">{t('deployment.config.credentialHint')}</p>
    </div>
  )
}
