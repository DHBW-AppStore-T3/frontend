import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image as ImageIcon } from 'lucide-react'
import BaseButton from '@/components/ui/BaseButton'
import Modal from '@/components/ui/Modal'
import MarkdownEditor from '@/components/MarkdownEditor'
import { useToast } from '@/composables/useToast'
import { MAX_IMAGE_BYTES } from '@/utils/format'
import type { EditFormValues, EditImage } from './editPayload'
import type { AppDetail } from './versionInfo'

export interface EditAppModalProps {
  show: boolean
  app: AppDetail
  isSaving: boolean
  onClose: () => void
  onSave: (form: EditFormValues, image: EditImage) => void
}

const BYTES_PER_MB = 1024 * 1024

/**
 * Edit name / description / image. ``git_link`` is intentionally immutable
 * (the backend rejects it) and privacy has its own toggle in the store tab.
 */
export default function EditAppModal({ show, app, isSaving, onClose, onSave }: EditAppModalProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const [form, setForm] = useState<EditFormValues>({ name: '', description: '' })
  const [image, setImage] = useState<EditImage>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const descId = useId()
  const descHintId = useId()

  // Reset the form from the app each time the modal opens (render-phase).
  const [wasShown, setWasShown] = useState(show)
  if (wasShown !== show) {
    setWasShown(show)
    if (show) {
      setForm({ name: app.name || '', description: app.description || '' })
      setImage(null)
      setPreview(app.image || null)
    }
  }

  // Release object URLs created for previews.
  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const acceptFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('AppsDetailView.toasts.onlyImages'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t('AppsDetailView.toasts.imageTooLarge', { size: Math.round(MAX_IMAGE_BYTES / BYTES_PER_MB) }))
      return
    }
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const dropZoneClass = isDragging
    ? 'border-green-500 bg-successTint border-dashed'
    : 'border-borderSubtle hover:border-borderSubtle border-dashed'

  return (
    <Modal
      show={show}
      onClose={() => {
        if (!isSaving) onClose()
      }}
      title={t('AppsDetailView.editModal.title')}
      body={
        <div className="space-y-4">
          <p className="text-sm text-textMuted">{t('AppsDetailView.editModal.description')}</p>

          <div>
            <label htmlFor={nameId} className="block text-sm font-medium text-textMuted mb-1.5">
              {t('AppsDetailView.editModal.nameLabel')}
            </label>
            <input
              id={nameId}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              type="text"
              className="w-full rounded-lg border border-borderSubtle px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          <div>
            <label htmlFor={descId} className="block text-sm font-medium text-textMuted mb-1.5">
              {t('AppsDetailView.editModal.descLabel')}
            </label>
            <MarkdownEditor
              id={descId}
              aria-describedby={descHintId}
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
              placeholder={t('AppsCreateView.form.descPlaceholder')}
              minHeightPx={120}
              maxHeightPx={320}
            />
            <p id={descHintId} className="mt-1 text-xs text-textMuted">
              {t('AppsCreateView.form.descMarkdownHint')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-textMuted mb-1.5">
              {t('AppsDetailView.editModal.imageLabel')}
            </label>
            <div
              className={`bg-white rounded-lg py-2 px-3 text-textMuted shadow-sm border-2 transition-all cursor-pointer flex items-center min-h-[60px] ${dropZoneClass}`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setIsDragging(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer?.files?.[0]
                if (file) acceptFile(file)
              }}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) acceptFile(file)
                  e.target.value = ''
                }}
              />
              {preview ? (
                <div className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-3">
                    <img src={preview} alt={form.name} className="w-10 h-10 object-contain rounded bg-surfaceMuted" />
                    <span className="text-sm text-textMuted">
                      {image instanceof File ? image.name : t('AppsDetailView.editModal.currentImage')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-textFaint hover:text-danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      setImage('remove')
                      setPreview(null)
                    }}
                  >
                    {t('AppsDetailView.editModal.imageRemove')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-textFaint">
                  <ImageIcon size={18} />
                  <span>{t('AppsDetailView.editModal.imageHint')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex justify-end gap-3">
          <BaseButton variant="text" onClick={onClose} disabled={isSaving}>
            {t('AppsDetailView.cancelButton')}
          </BaseButton>
          <BaseButton variant="primary" onClick={() => onSave(form, image)} disabled={isSaving}>
            {isSaving ? t('AppsDetailView.editModal.savingButton') : t('AppsDetailView.editModal.saveButton')}
          </BaseButton>
        </div>
      }
    />
  )
}
