// Fachbereichs-Zuordnung des App-Katalogs.
//
// Eine Zuordnung bedeutet "für diesen Studiengang fachlich geeignet", nicht
// "wird dort nachweislich bereits eingesetzt". Wirtschaftsingenieurwesen ist
// ausdrücklich nicht Wirtschaftsinformatik.
//
// Zugeordnet wird ausschließlich über explizit gepflegte, normalisierte
// git_link-Aliasse (exakter Vergleich) – keine Keyword-/Regex-Klassifizierung
// und kein Matching über den Repo-Namen allein. Unbekannte Apps gehören zu
// keinem Fachbereich und bleiben nur unter "Alle" sichtbar.
//
// Neue App aufnehmen: Eintrag in APP_DEPARTMENTS ergänzen (Aliasse bereits
// normalisiert, siehe normalizeGitLink).

export const DEPARTMENTS = [
  'maschinenbau',
  'informatik',
  'elektrotechnik',
  'wirtschaftsingenieurwesen',
  'faecheruebergreifend',
] as const
export type Department = typeof DEPARTMENTS[number]

const URL_SCHEME = /^(?:ssh|https?|git):\/\//
const USER_INFO = /^[^@/]+@/
const TRAILING_SLASHES = /\/+$/
const TRAILING_DOT_GIT = /\.git$/

/**
 * Bringt HTTPS-, `ssh://`- und SCP-Links (`git@host:owner/repo`) auf die Form
 * `host/owner/repo` in Kleinbuchstaben. Abschließende Slashes werden vor `.git`
 * entfernt, damit auch `…/repo.git/` erkannt wird.
 */
export function normalizeGitLink(link: string | null | undefined): string | null {
  let value = (link ?? '').trim().toLowerCase()
  if (!value) return null

  const hadScheme = URL_SCHEME.test(value)
  value = value.replace(URL_SCHEME, '').replace(USER_INFO, '')
  // SCP-Form: das erste ':' trennt Host und Pfad.
  if (!hadScheme) value = value.replace(':', '/')
  value = value
    .replace(/^www\./, '')
    .replace(TRAILING_SLASHES, '')
    .replace(TRAILING_DOT_GIT, '')

  return value || null
}

interface AppDepartments {
  /** Nur zur Dokumentation – wird nie zum Matchen verwendet. */
  name: string
  /** Bereits normalisierte git_link-Aliasse (Seed-Organisation, T3-Organisation, …). */
  aliases: readonly string[]
  departments: readonly Department[]
}

const GITHUB = 'github.com'

export const APP_DEPARTMENTS: readonly AppDepartments[] = [
  // Java-Entwicklungsumgebung im Browser (code-server).
  {
    name: 'Online-IDE',
    aliases: [`${GITHUB}/dhbw-appstore/online-ide`, `${GITHUB}/dhbw-appstore-t3/online-ide`],
    departments: ['informatik'],
  },
  // Linux-Terminal-Lernumgebung.
  {
    name: 'Ubuntu-App',
    aliases: [`${GITHUB}/dhbw-appstore/ubuntu-app`, `${GITHUB}/dhbw-appstore-t3/ubuntu-app`],
    departments: ['informatik'],
  },
  // PostgreSQL-Administration mit Beispieldatenbank; Nutzen im
  // Wirtschaftsingenieurwesen ist möglich, aber aktuell nicht konkret belegt.
  {
    name: 'pgAdmin',
    aliases: [`${GITHUB}/dhbw-appstore/pgadmin`, `${GITHUB}/dhbw-appstore-t3/pgadmin`],
    departments: ['informatik'],
  },
  // Versionsverwaltung / Git-Plattform.
  {
    name: 'GitLab-CE',
    aliases: [`${GITHUB}/six7-click-n-deploy/gitlab-app`],
    departments: ['informatik'],
  },
  // Prometheus/Grafana zur Überwachung von Systemmetriken.
  {
    name: 'Monitoring-Stack',
    aliases: [`${GITHUB}/six7-click-n-deploy/monitoring-stack`],
    departments: ['informatik'],
  },
  // JupyterLab: geeignet für Datenanalyse, numerische Berechnungen und die
  // Auswertung von Mess- und Simulationsdaten; bestimmte Bibliotheken sind
  // nicht vorinstalliert und werden hier nicht behauptet.
  {
    name: 'Jupyter-Notebook',
    aliases: [`${GITHUB}/dhbw-appstore/jupyter-notebook`, `${GITHUB}/dhbw-appstore-t3/jupyter-notebook`],
    departments: ['informatik', 'maschinenbau', 'elektrotechnik', 'faecheruebergreifend'],
  },
  // LaTeX-Editor für wissenschaftliche und technische Berichte,
  // Dokumentationen und Abschlussarbeiten – studiengangsübergreifend relevant.
  {
    name: 'Web-LaTeX',
    aliases: [`${GITHUB}/dhbw-appstore/web-latex`, `${GITHUB}/dhbw-appstore-t3/web-latex`],
    departments: ['informatik', 'maschinenbau', 'elektrotechnik', 'wirtschaftsingenieurwesen', 'faecheruebergreifend'],
  },
]

const DEPARTMENTS_BY_ALIAS = new Map<string, readonly Department[]>(
  APP_DEPARTMENTS.flatMap((entry) => entry.aliases.map((alias) => [alias, entry.departments] as const)),
)

export function departmentsForGitLink(link: string | null | undefined): readonly Department[] {
  const normalized = normalizeGitLink(link)
  return (normalized && DEPARTMENTS_BY_ALIAS.get(normalized)) || []
}
