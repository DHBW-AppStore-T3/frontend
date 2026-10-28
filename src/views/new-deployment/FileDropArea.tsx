import { useId, useState, type DragEvent, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp } from 'lucide-react'
import './FileVariableCard.css'

interface Props {
  title: string
  hint: string
  onPick: () => void
  onDropFile: (file: File) => void
  /** The button, so the caller can give it the focus back after a file was removed. */
  pickRef?: Ref<HTMLButtonElement>
}

/** Where a file goes: drop it here or use the button; both end in the same check by the caller. */
export default function FileDropArea({ title, hint, onPick, onDropFile, pickRef }: Props) {
  const { t } = useTranslation()
  const hintId = useId()
  const [dragging, setDragging] = useState(false)

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    setDragging(true)
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) onDropFile(file)
  }

  return (
    <div
      className="fv-drop flex items-center gap-4 rounded-lg px-5 py-4 max-sm:flex-col max-sm:items-stretch max-sm:text-center"
      data-testid="file-drop"
      data-dragging={dragging}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <span
        className="fv-drop__icon flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primaryFaint text-primaryDeep max-sm:mx-auto"
        aria-hidden="true"
      >
        <FileUp size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-textHeading">{title}</div>
        <div id={hintId} className="text-sm text-textStrong">
          {hint}
        </div>
      </div>
      <button
        ref={pickRef}
        type="button"
        aria-describedby={hintId}
        onClick={onPick}
        className="inline-flex flex-none items-center justify-center rounded-full border-2 border-primary bg-surface px-4 py-2 text-sm font-bold text-primaryDark transition-colors hover:bg-primaryFaint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {t('deployment.fileVariable.drop.pick')}
      </button>
    </div>
  )
}
