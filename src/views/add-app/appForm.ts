import { Box, Layers, Server, Shield, type LucideIcon } from 'lucide-react'
import type { AppCreate } from '@/types'

export interface AppFormValues {
  name: string
  description: string
  repoUrl: string
  isPrivate: boolean
  submitAllVersions: boolean
}

export const emptyAppForm = (): AppFormValues => ({
  name: '',
  description: '',
  repoUrl: '',
  isPrivate: false,
  submitAllVersions: false,
})

const GIT_URL_PATTERN = /^(https?:\/\/|git@)[\w.-]+[/:].+/

export const isValidGitUrl = (url: string): boolean => GIT_URL_PATTERN.test(url)

const includesAny = (name: string, parts: string[]) => parts.some((p) => name.includes(p))

export type PreviewIconKind = 'security' | 'server' | 'box' | 'default'

export const PREVIEW_ICONS: Record<PreviewIconKind, LucideIcon> = {
  security: Shield,
  server: Server,
  box: Box,
  default: Layers,
}

/** Kind of the placeholder icon of the live preview card, guessed from the app name. */
export function previewIconKind(appName: string): PreviewIconKind {
  const name = appName.toLowerCase()
  if (includesAny(name, ['kali', 'hack', 'security'])) return 'security'
  if (name.includes('node')) return 'server'
  if (name.includes('python')) return 'box'
  return 'default'
}

export function previewIconColorClass(appName: string): string {
  return appName.toLowerCase().includes('kali') ? 'text-info' : 'text-textMuted'
}

const REJECTED_STATUSES = [400, 403, 422]

/** i18n key of the toast for a failed create request. */
export function createErrorKey(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === undefined) return 'AppsCreateView.messages.networkError'
  return REJECTED_STATUSES.includes(status)
    ? 'AppsCreateView.messages.noAccess'
    : 'AppsCreateView.messages.serverError'
}

export function buildCreatePayload(form: AppFormValues, imageDataUrl: string | null): AppCreate {
  return {
    name: form.name,
    description: form.description,
    git_link: form.repoUrl,
    image: imageDataUrl,
    is_private: form.isPrivate,
    // "Submit all versions" only exists for public apps.
    submit_all_versions: !form.isPrivate && form.submitAllVersions,
  }
}

/** Reads a file as a ``data:`` URL (``null`` when there is no file). */
export function fileToDataUrl(file: File | null): Promise<string | null> {
  if (!file) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
