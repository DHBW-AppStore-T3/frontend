import { Box, Code2, Database, Globe, Server, Shield, type LucideIcon } from 'lucide-react'
import jupyter from '@/assets/apps/jupyter.svg'
import gitlab from '@/assets/apps/gitlab.svg'
import nextcloud from '@/assets/apps/nextcloud.svg'
import postgres from '@/assets/apps/postgresql.svg'
import r from '@/assets/apps/r.svg'
import vscode from '@/assets/apps/vscode.png'

interface AppPresentation {
  icon: LucideIcon
  logo?: string
  tone?: string
  fullColor?: boolean
}
// Display fallbacks only (logo / icon). Uploaded app images always take precedence.
// Department filtering is not derived from names – see department-catalog.ts.
const PRESENTATIONS: (AppPresentation & { match: RegExp })[] = [
  { match: /jupyter/i, icon: Database, logo: jupyter, tone: 'orange' },
  { match: /vs\s?code|visual studio code/i, icon: Code2, logo: vscode, tone: 'code', fullColor: true },
  { match: /rstudio/i, icon: Database, logo: r, tone: 'r' },
  { match: /gitlab/i, icon: Code2, logo: gitlab, tone: 'orange' },
  { match: /nextcloud/i, icon: Globe, logo: nextcloud, tone: 'cloud' },
  { match: /postgres/i, icon: Database, logo: postgres, tone: 'postgres' },
  { match: /python|sql|data/i, icon: Database },
  { match: /code|node|vue|react|docker|container|fastapi/i, icon: Code2 },
  { match: /office|collabora|moodle|wiki/i, icon: Globe },
  { match: /security|pentest/i, icon: Shield },
  { match: /server|linux|ubuntu/i, icon: Server },
]
export function appPresentation(name: string): AppPresentation {
  return PRESENTATIONS.find(entry => entry.match.test(name)) ?? { icon: Box }
}
