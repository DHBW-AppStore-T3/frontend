import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BaseButton from '@/components/ui/BaseButton'
import Modal from '@/components/ui/Modal'

export interface SubmitVersionModalProps {
  /** Version being submitted; the modal is shown while this is set. */
  versionTag: string | null
  isSubmitting: boolean
  /** Why the version cannot be submitted (its appstore.yaml), one line each. */
  specErrors: string[]
  onClose: () => void
  onSubmit: (notes: string) => void
}

export default function SubmitVersionModal({
  versionTag,
  isSubmitting,
  specErrors,
  onClose,
  onSubmit,
}: SubmitVersionModalProps) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState('')
  const notesId = useId()

  // Fresh notes for every version the modal is opened for.
  const [lastTag, setLastTag] = useState(versionTag)
  if (lastTag !== versionTag) {
    setLastTag(versionTag)
    setNotes('')
  }

  return (
    <Modal
      show={versionTag !== null}
      onClose={onClose}
      title={t('AppsDetailView.submitModal.title')}
      body={
        <div className="space-y-4">
          <p className="text-sm text-textMuted">
            {t('AppsDetailView.submitModal.description')}
            <span className="font-mono bg-surfaceMuted px-1.5 py-0.5 rounded text-xs ml-1">{versionTag}</span>
          </p>
          <div>
            <label htmlFor={notesId} className="block text-sm font-medium text-textMuted mb-1.5">
              {t('AppsDetailView.submitModal.notesLabel')}
            </label>
            <textarea
              id={notesId}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('AppsDetailView.submitModal.notesPlaceholder')}
              rows={3}
              className="w-full rounded-lg border border-borderSubtle px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
            />
          </div>

          {specErrors.length > 0 ? (
            <div className="rounded-lg border border-danger/30 bg-dangerTint p-3">
              <p className="text-xs font-semibold text-red-700 mb-2">
                {t('AppsDetailView.submitModal.specErrorTitle')}
              </p>
              <ul className="space-y-1.5">
                {specErrors.map((line) => (
                  <li key={line} className="text-xs text-danger font-mono">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      }
      footer={
        <div className="flex justify-end gap-3">
          <BaseButton variant="text" onClick={onClose} disabled={isSubmitting}>
            {t('AppsDetailView.cancelButton')}
          </BaseButton>
          <BaseButton variant="primary" onClick={() => onSubmit(notes)} disabled={isSubmitting}>
            {isSubmitting ? '...' : t('AppsDetailView.submitModal.submit')}
          </BaseButton>
        </div>
      }
    />
  )
}
