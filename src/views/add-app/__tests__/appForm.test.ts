import { describe, it, expect } from 'vitest'
import { Shield, Server, Box, Layers } from 'lucide-react'
import { isValidGitUrl, previewIconFor, previewIconColorClass, createErrorKey, buildCreatePayload } from '../appForm'

describe('isValidGitUrl', () => {
  it.each([
    ['https://github.com/user/repo', true],
    ['http://host.local/x.git', true],
    ['git@github.com:user/repo.git', true],
    ['keine-echte-url', false],
    ['ftp://host/repo', false],
    ['https://', false],
  ])('%s → %s', (url, ok) => {
    expect(isValidGitUrl(url)).toBe(ok)
  })
})

describe('preview icon', () => {
  it.each([
    ['Kali Linux', Shield],
    ['Security Lab', Shield],
    ['Node Backend', Server],
    ['Python Script', Box],
    ['Something else', Layers],
  ])('%s', (name, icon) => {
    expect(previewIconFor(name)).toBe(icon)
  })

  it('only tints kali in the info colour', () => {
    expect(previewIconColorClass('Kali')).toBe('text-info')
    expect(previewIconColorClass('Other')).toBe('text-textMuted')
  })
})

describe('createErrorKey', () => {
  it.each([
    [{ response: { status: 403 } }, 'AppsCreateView.messages.noAccess'],
    [{ response: { status: 400 } }, 'AppsCreateView.messages.noAccess'],
    [{ response: { status: 422 } }, 'AppsCreateView.messages.noAccess'],
    [{ response: { status: 500 } }, 'AppsCreateView.messages.serverError'],
    [{}, 'AppsCreateView.messages.networkError'],
  ])('%j', (error, key) => {
    expect(createErrorKey(error)).toBe(key)
  })
})

describe('buildCreatePayload', () => {
  const form = { name: 'A', description: 'd', repoUrl: 'https://g/x', isPrivate: false, submitAllVersions: true }

  it('maps the form and the encoded image', () => {
    expect(buildCreatePayload(form, 'data:image/png;base64,xx')).toEqual({
      name: 'A',
      description: 'd',
      git_link: 'https://g/x',
      image: 'data:image/png;base64,xx',
      is_private: false,
      submit_all_versions: true,
    })
  })

  it('never submits all versions for a private app', () => {
    expect(buildCreatePayload({ ...form, isPrivate: true }, null).submit_all_versions).toBe(false)
  })
})
