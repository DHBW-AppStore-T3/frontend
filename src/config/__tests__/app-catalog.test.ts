import { describe, it, expect } from 'vitest'
import { Box, Database, Code2 } from 'lucide-react'
import { appPresentation } from '@/config/app-catalog'

describe('appPresentation', () => {
  it('matches known apps by name, case-insensitively, including their logo', () => {
    const p = appPresentation('JupyterHub')
    expect(p.icon).toBe(Database)
    expect(p.logo).toBeTruthy()
  })

  it('prefers the specific entry over the generic one (gitlab before code/…)', () => {
    expect(appPresentation('GitLab CE').icon).toBe(Code2)
    expect(appPresentation('GitLab CE').logo).toBeTruthy()
  })

  it('falls back to a box icon', () => {
    expect(appPresentation('Zzz')).toEqual({ icon: Box })
  })

  it('carries no category any more (department filtering lives in department-catalog)', () => {
    for (const n of ['jupyter', 'vscode', 'nextcloud', 'security', 'linux', 'x']) {
      expect(appPresentation(n)).not.toHaveProperty('category')
    }
  })
})
