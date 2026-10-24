import { describe, it, expect } from 'vitest'
import de from '@/i18n/locales/de'

type Entry = [path: string, text: string]

function flatten(node: unknown, path = ''): Entry[] {
  if (typeof node === 'string') return [[path, node]]
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => flatten(v, path ? `${path}.${k}` : k))
  }
  return []
}

const entries = flatten(de)

const DU_PRONOUNS = /\b(du|dich|dir|dein|deine|deiner|deinem|deinen|deines)\b/i

// Du-imperatives, at the start of a text or right after "Bitte".
const IMPERATIVES = [
  'Wähle', 'Lade', 'Hinterlege', 'Prüfe', 'Sieh', 'Kontrolliere', 'Lege', 'Füge', 'Gib', 'Klicke',
  'Fülle', 'Verwalte', 'Frage', 'Starte', 'Öffne', 'Beachte', 'Speichere', 'Bestätige', 'Versuche',
  'Melde', 'Nutze', 'Verwende', 'Erstelle', 'Überprüfe', 'Vergib', 'Ziehe', 'Trage', 'Aktiviere',
  'Kopiere', 'Ordne', 'Passe', 'Wende', 'Lösche', 'Warte', 'Setze', 'Suche', 'Durchstöbere', 'Aktualisiere', 'Durchsuche', 'Entferne', 'Ändere', 'Bearbeite',
  'Schließe', 'Achte', 'Stelle', 'Folge', 'Lies', 'Teile', 'Wiederhole', 'Probiere', 'Kontaktiere', 'Schau',
]
const IMPERATIVE_START = new RegExp(`^(Bitte )?(${IMPERATIVES.join('|')})\\b`, 'i')

// Pure status messages address nobody, so a Sie-form would only make them
// longer. Allowed: the ellipsis form ("Lade Kurs...") and the two progress
// toasts that continue with "— siehe Live-Fortschritt unten.".
const STATUS_ELLIPSIS = /^(Lade|Speichere|Lösche|Entferne|Warte|Suche)\b.*(\.\.\.|…)$/
const STATUS_TOASTS = /^(Setze|Lösche) Deployment( fort)? — siehe Live-Fortschritt unten\.$/
const isStatusMessage = (text: string) => STATUS_ELLIPSIS.test(text) || STATUS_TOASTS.test(text)

const fmt = (hits: Entry[]) => hits.map(([p, t]) => `${p}: ${t}`).join('\n')

describe('de.ts uses the Sie-form throughout', () => {
  it('contains Du-pronouns nowhere', () => {
    const hits = entries.filter(([, text]) => DU_PRONOUNS.test(text))
    expect(fmt(hits)).toBe('')
  })

  it('contains no Du-imperatives (status messages with ellipsis excepted)', () => {
    const hits = entries.filter(([, text]) => IMPERATIVE_START.test(text) && !isStatusMessage(text))
    expect(fmt(hits)).toBe('')
  })

  it('contains no Du-imperative after "bitte" or a clause break mid-text', () => {
    const re = new RegExp(`(\\bbitte|[;,:]) (${IMPERATIVES.join('|')})\\b`, 'i')
    const hits = entries.filter(([, text]) => re.test(text))
    expect(fmt(hits)).toBe('')
  })
})
