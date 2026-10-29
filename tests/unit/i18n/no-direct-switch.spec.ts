// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// A language is loaded on demand (issue 148). Switching with `changeLanguage`
// directly would show message keys until the file is there; the browser check
// of the first version found two such places (login page, profile). All
// switching goes through `switchLocale`.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : files(full)
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name) ? [full] : []
  })
}

describe('language switching', () => {
  it('only src/i18n calls changeLanguage', () => {
    const offenders = files('src')
      .filter((f) => !relative('src', f).startsWith(`i18n${sep}`))
      .filter((f) => readFileSync(f, 'utf8').includes('changeLanguage'))
    expect(offenders).toEqual([])
  })
})
