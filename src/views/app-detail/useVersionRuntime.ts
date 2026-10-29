import { useEffect, useState } from 'react'
import { appApi } from '@/api/app.api'
import type { AppRuntime } from '@/types'
import { runtimeErrorKey } from './runtime'

interface Result {
  /** `appId|version` the result belongs to. */
  key: string
  runtime: AppRuntime | null
  errorKey: ReturnType<typeof runtimeErrorKey> | null
}

/**
 * How one version of an app runs (`GET /apps/{id}/runtime`). Loading is
 * derived: the latest result belongs to another request than the current one.
 */
export function useVersionRuntime(appId: string | undefined, version: string) {
  const key = appId && version ? `${appId}|${version}` : ''
  const [result, setResult] = useState<Result>({ key: '', runtime: null, errorKey: null })

  useEffect(() => {
    if (!appId || !version) return
    let cancelled = false
    appApi
      .getRuntime(appId, version)
      .then(({ data }) => !cancelled && setResult({ key, runtime: data, errorKey: null }))
      .catch((err) => !cancelled && setResult({ key, runtime: null, errorKey: runtimeErrorKey(err) }))
    return () => {
      cancelled = true
    }
  }, [appId, version, key])

  const current = result.key === key
  return {
    runtime: current ? result.runtime : null,
    errorKey: current ? result.errorKey : null,
    isLoading: key !== '' && !current,
  }
}
