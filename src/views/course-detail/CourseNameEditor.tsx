import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Check, X } from 'lucide-react'
import BaseButton from '@/components/ui/BaseButton'
import BaseInput from '@/components/ui/BaseInput'

export interface CourseNameEditorProps {
  name: string
  canEdit: boolean
  /** Persists the new name; rejects on failure. */
  onSave: (name: string) => Promise<void>
}

/** Course title with an inline edit mode (staff only). */
export default function CourseNameEditor({ name, canEdit, onSave }: CourseNameEditorProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEditing = () => {
    setDraft(name)
    setIsEditing(true)
  }

  const save = async () => {
    const unchanged = !draft || draft === name
    if (!unchanged) {
      try {
        await onSave(draft)
      } catch {
        return // the parent already told the user; stay in edit mode
      }
    }
    setIsEditing(false)
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-textHeading">{name}</h1>
        {canEdit ? (
          <button
            type="button"
            onClick={startEditing}
            className="p-1 hover:bg-surfaceMuted rounded text-textFaint hover:text-info transition"
            title={t('CourseDetailView.editNameTitle')}
          >
            <Edit2 size={20} />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 max-w-md">
      <BaseInput
        value={draft}
        onChange={setDraft}
        aria-label={t('CoursesView.createModal.nameLabel')}
        autoFocus
        onKeyUp={(e) => {
          if (e.key === 'Enter') void save()
        }}
      />
      <BaseButton onClick={() => void save()} className="!p-2" title={t('CourseDetailView.save')}>
        <Check size={18} />
      </BaseButton>
      <BaseButton variant="text" onClick={() => setIsEditing(false)} className="!p-2" title={t('CourseDetailView.cancel')}>
        <X size={18} />
      </BaseButton>
    </div>
  )
}
