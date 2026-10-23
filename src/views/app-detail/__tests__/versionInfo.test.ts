import { describe, it, expect } from 'vitest'
import {
  versionOptionsOf,
  versionDetailsOf,
  toVersionInfo,
  hasVersionInfo,
  bannerStatusOf,
  indexApprovalsByVersion,
} from '../versionInfo'

const versions = ['1.0', { version: '1.1', name: 'Release', commit_sha: 'abc', html_url: 'https://x' }, { releaseTag: '2.0' }, { foo: 1 }]

describe('versionOptionsOf', () => {
  it('accepts strings and objects (version / releaseTag) and drops empty ones', () => {
    expect(versionOptionsOf({ versions } as any)).toEqual(['1.0', '1.1', '2.0'])
  })

  it('is empty without versions', () => {
    expect(versionOptionsOf(null)).toEqual([])
    expect(versionOptionsOf({} as any)).toEqual([])
  })
})

describe('versionDetailsOf / toVersionInfo / hasVersionInfo', () => {
  it('finds the details object of the selected version', () => {
    expect(versionDetailsOf({ versions } as any, '1.1')).toMatchObject({ version: '1.1' })
    expect(versionDetailsOf({ versions } as any, '1.0')).toEqual({ version: '1.0' })
    expect(versionDetailsOf({ versions } as any, 'nope')).toBeNull()
    expect(versionDetailsOf({ versions } as any, '')).toBeNull()
  })

  it('normalises aliased field names', () => {
    expect(toVersionInfo({ commit_sha: 'abc', commit_author: 'me', commit_date: 'd', url: 'u' })).toMatchObject({
      commit: 'abc',
      author: 'me',
      published_at: 'd',
      html_url: 'u',
    })
    expect(toVersionInfo(null)).toBeNull()
  })

  it('reports whether any displayable info exists', () => {
    expect(hasVersionInfo({ version: '1.0' })).toBe(false)
    expect(hasVersionInfo({ version: '1.0', commit_sha: 'abc' })).toBe(true)
    expect(hasVersionInfo(null)).toBe(false)
  })
})

describe('bannerStatusOf', () => {
  const a = (status: string) => ({ status }) as any
  it('is none for missing and private apps', () => {
    expect(bannerStatusOf(null, [])).toBe('none')
    expect(bannerStatusOf({ is_private: true } as any, [])).toBe('none')
  })
  it('prefers approved over pending over no_submission', () => {
    const app = { is_private: false } as any
    expect(bannerStatusOf(app, [a('pending'), a('approved')])).toBe('approved')
    expect(bannerStatusOf(app, [a('pending')])).toBe('pending')
    expect(bannerStatusOf(app, [a('rejected')])).toBe('no_submission')
  })
})

describe('indexApprovalsByVersion', () => {
  it('keys approvals by version tag (last one wins)', () => {
    const map = indexApprovalsByVersion([
      { version_tag: '1', status: 'pending' },
      { version_tag: '1', status: 'approved' },
    ] as any)
    expect(map['1']!.status).toBe('approved')
  })
})
