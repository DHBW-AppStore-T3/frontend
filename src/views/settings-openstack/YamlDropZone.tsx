import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'

export interface YamlDropZoneProps {
  disabled: boolean
  onFile: (file: File) => void
  onMissingFile: () => void
}

/** Drop-or-pick area for a ``clouds.yaml`` file. */
export default function YamlDropZone({ disabled, onFile, onMissingFile }: YamlDropZoneProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hover = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const leave = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }

  const drop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    const file = event.dataTransfer?.files?.[0]
    if (file) onFile(file)
    else onMissingFile()
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 mb-6 transition-colors text-center ${
        isDragging ? 'border-primary bg-primary/5' : 'border-borderSubtle bg-white'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onDragEnter={hover}
      onDragOver={hover}
      onDragLeave={leave}
      onDrop={drop}
    >
      <Upload className="mx-auto text-textFaint mb-2" size={28} />
      <div className="font-medium text-textHeading mb-1">{t('SettingsOpenStackView.dropZone.headline')}</div>
      <div className="text-sm text-textMuted mb-3">
        {t('SettingsOpenStackView.dropZone.orPrefix')}{' '}
        <button
          type="button"
          className="text-primary underline disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {t('SettingsOpenStackView.dropZone.pickFile')}
        </button>{' '}
        {t('SettingsOpenStackView.dropZone.suffix')}
      </div>
      <input
        ref={inputRef}
        data-testid="yaml-input"
        type="file"
        accept=".yaml,.yml,application/x-yaml,text/yaml"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
