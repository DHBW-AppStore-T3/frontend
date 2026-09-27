declare global {
  interface Window {
    __ENV__: {
      VITE_KEYCLOAK_URL?: string
      VITE_KEYCLOAK_REALM?: string
      VITE_KEYCLOAK_CLIENT_ID?: string
      VITE_APP_URL?: string
      VITE_API_URL?: string
      VITE_THEME?: string
    }
  }
}

function getEnv(key: keyof Window['__ENV__'], fallback: string): string {
  const val = window.__ENV__?.[key]
  if (val && !val.startsWith('$')) return val
  return (import.meta.env[key] as string) || fallback
}

// No string fallback here: an unset/unsubstituted VITE_THEME must stay `undefined` so
// resolveTheme() applies its own fallback, instead of this module silently forcing the
// legacy `default` theme before resolveTheme ever sees a missing value.
function getThemeEnv(): string | undefined {
  const val = window.__ENV__?.VITE_THEME
  if (val && !val.startsWith('$')) return val
  return (import.meta.env.VITE_THEME as string) || undefined
}

export const env = {
  KEYCLOAK_URL: getEnv('VITE_KEYCLOAK_URL', 'http://localhost:8080'),
  KEYCLOAK_REALM: getEnv('VITE_KEYCLOAK_REALM', 'dhbw'),
  KEYCLOAK_CLIENT_ID: getEnv('VITE_KEYCLOAK_CLIENT_ID', 'appstore-frontend'),
  APP_URL: getEnv('VITE_APP_URL', 'http://localhost:5173'),
  API_URL: getEnv('VITE_API_URL', 'http://localhost:8000'),
  THEME: getThemeEnv(),
}
