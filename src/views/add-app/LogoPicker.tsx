import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

export interface LogoPickerProps {
  file: File | null
  onFile: (file: File) => void
  onRemove: () => void
}

/** Click-or-drop picker for the app logo. Validation is the caller's job. */
export default function LogoPicker({ file, onFile, onRemove }: LogoPickerProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
      className={`flex-1 bg-white rounded py-1.5 px-3 outline-none text-textMuted shadow-sm mx-2 border-2 transition-all cursor-pointer flex items-center min-h-[36px] ${
        isDragging
          ? 'border-primary bg-successTint border-dashed'
          : 'border-transparent hover:border-borderSubtle border-dashed'
      }`}
      onDragOver={drag(true)}
      onDragLeave={drag(false)}
      onDrop={drop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) onFile(picked)
          e.target.value = ''
        }}
      />
      {file ? (
        <div className="flex justify-between items-center w-full">
          <span className="text-sm text-success font-medium truncate">{file.name}</span>
          <button
            type="button"
            className="text-xs text-textFaint hover:text-danger ml-2"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            {t('AppsCreateView.form.logoRemove')}
          </button>
        </div>
      ) : (
        <span className="text-sm text-textFaint">{t('AppsCreateView.form.logoSelect')}</span>
      )}
    </div>
  )
}
