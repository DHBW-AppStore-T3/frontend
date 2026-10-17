import { useTranslation } from 'react-i18next'
import BaseButton from '@/components/ui/BaseButton'
import Modal from '@/components/ui/Modal'
import { translateHtml } from '@/i18n/html'
import type { User } from '@/types'

export interface RemoveMemberModalProps {
  member: User | null
  isRemoving: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function RemoveMemberModal({ member, isRemoving, onClose, onConfirm }: RemoveMemberModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      show={member !== null}
      onClose={onClose}
      header={<h2 className="text-xl font-semibold text-red-700">{t('CourseDetailView.removeModal.title')}</h2>}
      body={
        <div className="space-y-3">
          <p
            className="text-textMuted"
            dangerouslySetInnerHTML={{
              __html: translateHtml(
                'CourseDetailView.removeModal.confirmPrompt',
                { username: member?.username ?? '' },
                t,
              ),
            }}
          />
          <p className="text-sm text-textMuted">{t('CourseDetailView.removeModal.warning')}</p>
        </div>
      }
      footer={
        <div className="flex justify-end gap-3">
          <BaseButton variant="text" onClick={onClose} disabled={isRemoving}>
            {t('CourseDetailView.removeModal.cancel')}
          </BaseButton>
          <BaseButton variant="destructive" onClick={onConfirm} disabled={isRemoving}>
            {isRemoving ? t('CourseDetailView.removeModal.removing') : t('CourseDetailView.removeModal.remove')}
          </BaseButton>
        </div>
      }
    />
  )
}
