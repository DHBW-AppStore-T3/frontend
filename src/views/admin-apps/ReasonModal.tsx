import { useId, useState } from 'react'
import BaseButton from '@/components/ui/BaseButton'
import Modal from '@/components/ui/Modal'

export interface ReasonModalProps {
  show: boolean
  title: string
  titleClassName: string
  /** Version (and optionally app) the reason is for. */
  versionTag: string | null
  subtitle?: string
  reasonLabel: string
  reasonPlaceholder: string
  cancelLabel: string
  submitLabel: string
  submitVariant: 'destructive' | 'primary'
  /** Focus ring colour classes of the textarea. */
  focusClassName: string
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}

/** Modal asking for a mandatory free-text reason (used for reject and revoke). */
export default function ReasonModal(props: ReasonModalProps) {
  const { show, versionTag, isSubmitting, onClose, onSubmit } = props
  const [reason, setReason] = useState('')
  const reasonId = useId()

  // Start with an empty reason every time the modal is (re)opened.
  const [wasShown, setWasShown] = useState(show)
  if (wasShown !== show) {
    setWasShown(show)
    if (show) setReason('')
  }

  const isBlank = !reason.trim()

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={<span className={props.titleClassName}>{props.title}</span>}
      body={
        <div className="space-y-5">
          <p className="text-sm text-textMuted">
            <span className="font-mono bg-surfaceMuted px-1.5 py-0.5 rounded text-xs">{versionTag}</span>
            {props.subtitle ? <>&nbsp;—&nbsp;{props.subtitle}</> : null}
          </p>
          <div>
            <label htmlFor={reasonId} className="block text-sm font-medium text-textMuted mb-1.5">
              {props.reasonLabel}
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={props.reasonPlaceholder}
              rows={4}
              className={`w-full rounded-lg border border-borderSubtle px-3 py-2 text-sm focus:ring-2 outline-none resize-none ${props.focusClassName}`}
            />
          </div>
        </div>
      }
      footer={
        <div className="flex justify-end gap-3">
          <BaseButton variant="text" onClick={onClose} disabled={isSubmitting}>
            {props.cancelLabel}
          </BaseButton>
          <BaseButton
            variant={props.submitVariant}
            onClick={() => onSubmit(reason)}
            disabled={isBlank || isSubmitting}
          >
            {isSubmitting ? '...' : props.submitLabel}
          </BaseButton>
        </div>
      }
    />
  )
}
