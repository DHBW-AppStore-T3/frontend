/**
 * FileDropZone — drop-or-click upload widget for one file.
 *
 * Used by the deployment wizard to gather files for
 * ``@openstack:file:<scope>``-marked variables. Callers receive a ready-to-ship
 * ``DeploymentFile`` payload (name, content_b64, size, content_type) so they
 * don't have to know how to base64-encode a File themselves.
 */
import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileText, X } from 'lucide-react'
import type { DeploymentFile } from '@/types'
import { formatBytes } from '@/utils/format'

export interface FileDropZoneProps {
  /** Optional MIME filter for the native file picker (e.g. ``"application/pdf"``). */
  accept?: string
  /** Per-file cap in bytes; mirrors the backend limit for a clean early error. */
  maxBytes?: number
  /** Existing payload, re-rendered when the wizard is re-entered. */
  value?: DeploymentFile | null
  /** Label of the empty state, e.g. "Team-1 Datensatz". */
  label?: string
  /** Read-only display: the file can no longer be changed. */
  disabled?: boolean
  onChange: (file: DeploymentFile | null) => void
  /** Called with the same message that is rendered inline. */
  onError?: (message: string) => void
}

const BYTES_PER_MB = 1024 * 1024
const BASE64_MARKER = 'base64,'

/**
 * Read a File into a bare base64 string. ``readAsDataURL`` returns
 * ``data:<type>;base64,<payload>``; the backend stores the payload only so
 * cloud-init's ``encoding: b64`` can decode it directly.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const idx = result.indexOf(BASE64_MARKER)
      if (idx < 0) reject(new Error('Failed to encode file'))
      else resolve(result.slice(idx + BASE64_MARKER.length))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function FileDropZone({
  accept = '*',
  maxBytes = 2 * BYTES_PER_MB,
  value = null,
  label = '',
  disabled = false,
  onChange,
  onError,
}: FileDropZoneProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState('')

  const fail = (message: string) => {
    setLocalError(message)
    onError?.(message)
  }

  const processFile = async (file: File) => {
    if (disabled) return
    setLocalError('')
    if (file.size > maxBytes) {
      fail(t('fileDropZone.tooLarge', { mb: Math.round(maxBytes / BYTES_PER_MB) }))
      return
    }
    try {
      onChange({
        name: file.name,
        content_b64: await fileToBase64(file),
        size: file.size,
        content_type: file.type || 'application/octet-stream',
      })
    } catch (e) {
      fail((e as Error)?.message || t('fileDropZone.readError'))
    }
  }

  const onDragOver = (event: DragEvent) => {
    event.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) void processFile(file)
  }

  return (
    <div className="space-y-1">
      {!value ? (
        // Empty state: drop zone + click to pick.
        <div
          className={`border-2 border-dashed rounded-md px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
            isDragging ? 'border-green-500 bg-successTint' : 'border-borderSubtle hover:border-textFaint'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDragging(false)
          }}
          onDrop={onDrop}
          onClick={() => {
            if (!disabled) inputRef.current?.click()
          }}
        >
          <Upload size={20} className="text-textMuted shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-textMuted truncate">
              {label ? <span className="font-medium">{label}: </span> : null}
              <span className="text-textMuted">{t('fileDropZone.pick')}</span>
            </div>
            <div className="text-xs text-textFaint mt-0.5">max. {Math.round(maxBytes / BYTES_PER_MB)} MB</div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={disabled}
            className="hidden"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void processFile(file)
              // Allow re-selecting the same file later.
              e.target.value = ''
            }}
          />
        </div>
      ) : (
        // Filled state: name + size + remove button.
        <div className="border rounded-md px-4 py-3 bg-surfaceMuted flex items-center gap-3">
          <FileText size={20} className="text-textMuted shrink-0" />
          <div className="flex-1 min-w-0">
            {label ? <div className="text-xs text-textMuted mb-0.5">{label}</div> : null}
            <div className="text-sm font-medium text-textHeading truncate">{value.name}</div>
            <div className="text-xs text-textMuted">{formatBytes(value.size)}</div>
          </div>
          {!disabled ? (
            <button
              type="button"
              className="p-1 rounded hover:bg-gray-200 text-textMuted hover:text-danger"
              title={t('fileDropZone.remove')}
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      )}

      {/* Inline error if validation rejected the pick. */}
      {localError ? <div className="text-xs text-danger">{localError}</div> : null}
    </div>
  )
}
