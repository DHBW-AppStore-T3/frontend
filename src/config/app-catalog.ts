import type { Component } from 'vue'
import { Box, Code2, Database, Globe, Server, Shield } from 'lucide-vue-next'
import jupyter from '@/assets/apps/jupyter.svg'
import gitlab from '@/assets/apps/gitlab.svg'
import nextcloud from '@/assets/apps/nextcloud.svg'
import postgres from '@/assets/apps/postgresql.svg'
import r from '@/assets/apps/r.svg'
import vscode from '@/assets/apps/vscode.png'

export const APP_CATEGORIES = ['productivity', 'development', 'data', 'other'] as const
export type AppCategory = typeof APP_CATEGORIES[number]
interface AppPresentation {
  category: AppCategory
  icon: Component
  logo?: string
  tone?: string
  fullColor?: boolean
}
// Display fallbacks only. Uploaded app images always take precedence.
const PRESENTATIONS: (AppPresentation & { match: RegExp })[] = [
  { match: /jupyter/i, category: 'data', icon: Database, logo: jupyter, tone: 'orange' },
  { match: /vs\s?code|visual studio code/i, category: 'development', icon: Code2, logo: vscode, tone: 'code', fullColor: true },
  { match: /rstudio/i, category: 'data', icon: Database, logo: r, tone: 'r' },
  { match: /gitlab/i, category: 'development', icon: Code2, logo: gitlab, tone: 'orange' },
  { match: /nextcloud/i, category: 'productivity', icon: Globe, logo: nextcloud, tone: 'cloud' },
  { match: /postgres/i, category: 'data', icon: Database, logo: postgres, tone: 'postgres' },
  { match: /python|sql|data/i, category: 'data', icon: Database },
  { match: /code|node|vue|react|docker|container|fastapi/i, category: 'development', icon: Code2 },
  { match: /office|collabora|moodle|wiki/i, category: 'productivity', icon: Globe },
  { match: /security|pentest/i, category: 'other', icon: Shield },
  { match: /server|linux|ubuntu/i, category: 'other', icon: Server },
]
export function appPresentation(name: string): AppPresentation {
  return PRESENTATIONS.find(entry => entry.match.test(name)) ?? { category: 'other', icon: Box }
}
