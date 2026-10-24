import { useTranslation } from 'react-i18next'
import PageHeader from '@/components/ui/PageHeader'
import Card from '@/components/ui/Card'
import Toggle from '@/views/add-app/Toggle'
import { useRole } from '@/composables/useRole'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminViewStore } from '@/stores/admin-view.store'

export default function AdminSettingsView() {
  const { t } = useTranslation()
  const { isAdminView } = useRole()
  const userId = useAuthStore((s) => s.user?.userId ?? null)

  return (
    <div className="space-y-6">
      <PageHeader title={t('AdminSettingsView.title')} subtitle={t('AdminSettingsView.subtitle')} />
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium">{t('AdminSettingsView.adminView.title')}</p>
            <p className="text-sm text-muted">{t('AdminSettingsView.adminView.description')}</p>
          </div>
          <Toggle
            checked={isAdminView}
            label={t('AdminSettingsView.adminView.title')}
            onChange={(next) => {
              if (userId) useAdminViewStore.getState().setEnabled(userId, next)
            }}
          />
        </div>
      </Card>
    </div>
  )
}
