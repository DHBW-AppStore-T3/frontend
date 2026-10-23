import { describe, it, expect } from 'vitest'
import {
  APP_DEPARTMENTS,
  DEPARTMENTS,
  departmentsForGitLink,
  normalizeGitLink,
} from '@/config/department-catalog'

const ONLINE_IDE = 'github.com/dhbw-appstore/online-ide'

describe('normalizeGitLink', () => {
  it.each([
    'https://github.com/DHBW-AppStore/Online-IDE.git',
    'https://github.com/DHBW-AppStore/Online-IDE',
    'https://github.com/DHBW-AppStore/Online-IDE/',
    'https://github.com/DHBW-AppStore/Online-IDE.git/',
    'https://github.com/DHBW-AppStore/Online-IDE///',
    'http://www.github.com/DHBW-AppStore/Online-IDE.git',
    '  https://github.com/DHBW-AppStore/Online-IDE.git  ',
    'ssh://git@github.com/DHBW-AppStore/Online-IDE.git',
    'ssh://git@github.com/DHBW-AppStore/Online-IDE',
    'ssh://git@github.com/DHBW-AppStore/Online-IDE.git/',
    'git@github.com:DHBW-AppStore/Online-IDE.git',
    'git@github.com:DHBW-AppStore/Online-IDE',
    'git@github.com:DHBW-AppStore/Online-IDE.git/',
  ])('normalisiert %j', (link) => {
    expect(normalizeGitLink(link)).toBe(ONLINE_IDE)
  })

  it.each(['', '   ', null, undefined])('liefert null für %j', (link) => {
    expect(normalizeGitLink(link)).toBeNull()
  })
})

describe('departmentsForGitLink', () => {
  it('liefert für SSH- und SCP-Formen dieselben Fachbereiche wie für HTTPS', () => {
    const https = departmentsForGitLink('https://github.com/DHBW-AppStore/Online-IDE.git')
    expect(https).toEqual(['informatik'])
    expect(departmentsForGitLink('ssh://git@github.com/DHBW-AppStore/Online-IDE.git/')).toEqual(https)
    expect(departmentsForGitLink('git@github.com:DHBW-AppStore/Online-IDE.git')).toEqual(https)
  })

  it('ordnet unbekannte, leere und fehlende Links keinem Fachbereich zu', () => {
    expect(departmentsForGitLink('https://github.com/fremd/web-latex.git')).toEqual([])
    expect(departmentsForGitLink('')).toEqual([])
    expect(departmentsForGitLink(null)).toEqual([])
    expect(departmentsForGitLink(undefined)).toEqual([])
  })

  it('erkennt beide Organisations-Aliasse einer App', () => {
    expect(departmentsForGitLink('https://github.com/DHBW-AppStore-T3/Web-LaTeX.git')).toEqual(
      departmentsForGitLink('https://github.com/DHBW-AppStore/Web-LaTeX.git'),
    )
    expect(departmentsForGitLink('https://github.com/DHBW-AppStore-T3/Web-LaTeX.git')).not.toEqual([])
  })
})

describe('APP_DEPARTMENTS', () => {
  const aliases = APP_DEPARTMENTS.flatMap((entry) => entry.aliases)

  it('enthält nur bereits normalisierte Aliasse', () => {
    for (const alias of aliases) expect(normalizeGitLink(alias)).toBe(alias)
  })

  it('verwendet keinen Alias doppelt', () => {
    expect(new Set(aliases).size).toBe(aliases.length)
  })

  it('verwendet nur bekannte Fachbereiche und ordnet jeder App mindestens einen zu', () => {
    for (const entry of APP_DEPARTMENTS) {
      expect(entry.departments.length).toBeGreaterThan(0)
      for (const department of entry.departments) expect(DEPARTMENTS).toContain(department)
    }
  })

  it('entspricht der freigegebenen Zuordnung', () => {
    const appsOf = (department: string) =>
      APP_DEPARTMENTS.filter((entry) => (entry.departments as readonly string[]).includes(department))
        .map((entry) => entry.name)
        .sort()

    expect(appsOf('maschinenbau')).toEqual(['Jupyter-Notebook', 'Web-LaTeX'])
    expect(appsOf('elektrotechnik')).toEqual(['Jupyter-Notebook', 'Web-LaTeX'])
    expect(appsOf('wirtschaftsingenieurwesen')).toEqual(['Web-LaTeX'])
    expect(appsOf('faecheruebergreifend')).toEqual(['Jupyter-Notebook', 'Web-LaTeX'])
    expect(appsOf('informatik')).toEqual([
      'GitLab-CE',
      'Jupyter-Notebook',
      'Monitoring-Stack',
      'Online-IDE',
      'Ubuntu-App',
      'Web-LaTeX',
      'pgAdmin',
    ])
  })

  it('ordnet die Seed-Links der Apps zu', () => {
    expect(departmentsForGitLink('https://github.com/six7-click-n-deploy/GitLab-App.git')).toEqual(['informatik'])
    expect(departmentsForGitLink('https://github.com/six7-click-n-deploy/Monitoring-Stack.git')).toEqual(['informatik'])
    expect(departmentsForGitLink('https://github.com/DHBW-AppStore/Jupyter-Notebook.git')).toContain('maschinenbau')
  })
})
