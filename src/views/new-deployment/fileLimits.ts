/**
 * What the backend accepts for the files of a deployment, checked early so a wrong file is
 * refused when it is picked and not when the deployment is started.
 */

const KB = 1024
const MB = 1024 * KB

/**
 * One file of a pod app: the backend refuses more than 1 MiB (the files of a workload go into one
 * Kubernetes Secret) with 413 ``file_too_large``. Used for checking only, never shown to people.
 */
export const FILE_MAX_BYTES = MB

/** All files of one deployment together (``deployment_files_too_large``). */
export const DEPLOYMENT_FILES_MAX_BYTES = 10 * MB

export type UploadCheck =
  | { ok: true }
  | { ok: false; code: 'type'; extensions: string[] }
  | { ok: false; code: 'size' }
  | { ok: false; code: 'total'; mode: 'all'; slotCount: number; total: number; fitBytes: number }
  | { ok: false; code: 'total'; mode: 'slot'; total: number }

export interface UploadInput {
  file: { name: string; size: number }
  /** Allowed extensions of the variable (``fileExtensions``); none means anything goes. */
  extensions?: string[] | null
  /** Slots that would get the file when it goes to everybody. */
  slotCount: number
  /** Bytes of the files of the deployment's other file variables. */
  otherBytes?: number
  /** For a single slot: bytes of all slots of this variable, and of the slot that is replaced. */
  filledBytes?: number
  slotBytes?: number
}

const normalize = (extension: string): string => extension.replace(/^\./, '').toLowerCase()

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Type, then size per file, then the total: the order in which a person can act on them. */
export function validateUpload(input: UploadInput): UploadCheck {
  const { file, slotCount, otherBytes = 0 } = input
  const allowed = (input.extensions ?? []).map(normalize)
  if (allowed.length > 0 && !allowed.includes(extensionOf(file.name))) {
    return { ok: false, code: 'type', extensions: allowed }
  }
  if (file.size > FILE_MAX_BYTES) return { ok: false, code: 'size' }

  if (input.filledBytes === undefined) {
    const total = slotCount * file.size + otherBytes
    if (total > DEPLOYMENT_FILES_MAX_BYTES) {
      const fitBytes = Math.max(0, Math.floor((DEPLOYMENT_FILES_MAX_BYTES - otherBytes) / Math.max(1, slotCount)))
      return { ok: false, code: 'total', mode: 'all', slotCount, total, fitBytes }
    }
    return { ok: true }
  }
  const total = input.filledBytes - (input.slotBytes ?? 0) + file.size + otherBytes
  return total > DEPLOYMENT_FILES_MAX_BYTES ? { ok: false, code: 'total', mode: 'slot', total } : { ok: true }
}

/** ``640 KB``, ``1,9 MB``: KB as whole numbers, MB with one decimal, in the decimal notation of the language. */
export function formatFileSize(bytes: number, locale = 'de'): string {
  if (bytes < KB) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / MB)} MB`
}

/** ``ZIP`` for exactly one allowed extension; ``null`` when there is none or several. */
export function fileExtensionLabel(extensions: string[] | null | undefined): string | null {
  const list = (extensions ?? []).map(normalize)
  return list.length === 1 ? list[0]!.toUpperCase() : null
}

/** ``my-file_name`` → ``My file name``: a title for a variable the app gave no label. */
export function humanizeName(name: string): string {
  const text = name.replace(/[-_]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
