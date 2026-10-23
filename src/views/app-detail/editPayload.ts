import type { AppDetail } from './versionInfo'

export interface EditFormValues {
  name: string
  description: string
}

/**
 * The image is tri-state on submit:
 *   ``null``    → untouched, field omitted from the payload
 *   ``File``    → new upload, encoded as data URL
 *   ``'remove'``→ explicitly cleared, sent as ``''`` (the backend clears it)
 */
export type EditImage = File | 'remove' | null

export interface AppEditPayload {
  name?: string
  description?: string
  image?: string
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Payload containing only the fields the user actually changed, so stale
 * values never overwrite server-side data.
 */
export async function buildEditPayload(
  app: AppDetail,
  form: EditFormValues,
  image: EditImage,
): Promise<AppEditPayload> {
  const payload: AppEditPayload = {}
  if (form.name !== app.name) payload.name = form.name
  if (form.description !== (app.description || '')) payload.description = form.description
  if (image instanceof File) payload.image = await readAsDataUrl(image)
  else if (image === 'remove') payload.image = ''
  return payload
}
