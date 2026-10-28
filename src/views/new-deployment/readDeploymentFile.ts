import type { DeploymentFile } from '@/types'

const BASE64_MARKER = 'base64,'

/**
 * A picked file as the payload of ``DeploymentCreate.files``. ``readAsDataURL`` returns
 * ``data:<type>;base64,<payload>``; the backend stores the bare payload.
 */
export function readDeploymentFile(file: File): Promise<DeploymentFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const idx = result.indexOf(BASE64_MARKER)
      if (idx < 0) reject(new Error('Failed to encode file'))
      else
        resolve({
          name: file.name,
          content_b64: result.slice(idx + BASE64_MARKER.length),
          size: file.size,
          content_type: file.type || 'application/octet-stream',
        })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
