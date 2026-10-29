import { useId, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

export interface LogoPickerProps {
  file: File | null
  onFile: (file: File) => void
  onRemove: () => void
  /** `id` of the element that names the picker (the row label). Without one the select text names it. */
  labelledBy?: string
}

/**
 * Click-or-drop picker for the app logo. Validation is the caller's job.
 *
 * The file input is visually hidden, not `display: none`, so it stays in the
 * tab order: Enter and Space open the file dialog natively. The label around
 * it is the click target; the remove button sits next to it, not inside, so
 * that no interactive element is nested in another.
 */
export default function LogoPicker({ file, onFile, onRemove, labelledBy }: LogoPickerProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const captionId = useId()

  const drag = (active: boolean) => (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(active)
  }

  const drop = (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    const dropped = event.dataTransfer?.files?.[0]
    if (dropped) onFile(dropped)
  }

  return (
    <div
      className={`flex-1 bg-white rounded outline-none text-textMuted shadow-sm mx-2 border-2 transition-all flex items-center min-h-[36px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
        isDragging
          ? 'border-primary bg-successTint border-dashed'
          : 'border-transparent hover:border-borderSubtle border-dashed'
      }`}
      onDragOver={drag(true)}
      onDragLeave={drag(false)}
      onDrop={drop}
    >
      <label
        className={`relative flex min-w-0 flex-1 cursor-pointer items-center self-stretch py-1.5 pl-3 ${file ? '' : 'pr-3'}`}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : t('AppsCreateView.form.logoSelect')}
          aria-describedby={captionId}
          onChange={(e) => {
            const picked = e.target.files?.[0]
            if (picked) onFile(picked)
            e.target.value = ''
          }}
        />
        {file ? (
          <span id={captionId} className="text-sm text-success font-medium truncate">
            {file.name}
          </span>
        ) : (
          <span id={captionId} className="text-sm text-textFaint">
            {t('AppsCreateView.form.logoSelect')}
          </span>
        )}
      </label>
      {file ? (
        <button type="button" className="text-xs text-textFaint hover:text-danger py-1.5 pl-2 pr-3" onClick={onRemove}>
          {t('AppsCreateView.form.logoRemove')}
        </button>
      ) : null}
    </div>
  )
}
