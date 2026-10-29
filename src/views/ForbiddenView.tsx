import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import BaseButton from '@/components/ui/BaseButton'

/**
 * 403 hint view. Rendered when the router guard blocks a route change due to a
 * missing role. A toast already reported the reason; this page gives the user a
 * way back.
 */
export default function ForbiddenView() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-dangerTint flex items-center justify-center mb-4">
          <ShieldAlert size={32} className="text-danger" />
        </div>
        <h1 className="text-2xl font-bold text-textHeading mb-2">{t('ForbiddenView.title')}</h1>
        <p className="text-textMuted mb-6">{t('ForbiddenView.description')}</p>
        <BaseButton onClick={() => navigate('/dashboard', { replace: true })}>
          {t('ForbiddenView.backToDashboard')}
        </BaseButton>
      </div>
    </div>
  )
}
