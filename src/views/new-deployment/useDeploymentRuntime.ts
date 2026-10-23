import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { appApi } from '@/api/app.api'
import { useDeploymentStore } from '@/stores/deployment.store'
import {
  useOpenStackCredentialsStore,
  selectCredentials,
  selectIsResolved,
  selectUsableCredentials,
} from '@/stores/openstack-credentials.store'
import { useToast } from '@/composables/useToast'
import { chooseCredentialId } from './credentialChoice'

/**
 * Runtime and credential of the wizard's draft (first step).
 *
 * The app detail page put the version's runtime into the draft; a reload or
 * deep link lands here without it, so it is asked again. VM apps (the Windows
 * desktop) run in the OpenStack project of one of the caller's verified
 * credentials, pods in the cluster without one.
 */
export function useDeploymentRuntime() {
  const { t } = useTranslation()
  const toast = useToast()
  const { appId, releaseTag, runtime, credentialId } = useDeploymentStore(
    useShallow((s) => ({
      appId: s.draft.appId,
      releaseTag: s.draft.releaseTag,
      runtime: s.draft.runtime,
      credentialId: s.draft.credentialId,
    })),
  )
  const credentialsResolved = useOpenStackCredentialsStore(selectIsResolved)
  const usable = useOpenStackCredentialsStore(useShallow(selectUsableCredentials))
  const credentials = useOpenStackCredentialsStore(useShallow(selectCredentials))
  const needsCredential = runtime === 'openstack-vm'

  useEffect(() => {
    if (runtime || !appId || !releaseTag) return
    let cancelled = false
    appApi
      .getRuntime(appId, String(releaseTag))
      .then(({ data }) => {
        if (!cancelled) useDeploymentStore.getState().updateDraft({ runtime: data.runtime, scope: data.scope ?? null })
      })
      .catch(() => !cancelled && toast.error(t('AppsDetailView.runtime.loadError')))
    return () => {
      cancelled = true
    }
    // The runtime is asked once per app/version; toast and t are stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, releaseTag, runtime])

  useEffect(() => {
    if (!useOpenStackCredentialsStore.getState().credentials) void useOpenStackCredentialsStore.getState().fetch()
  }, [])

  // Pick the only usable credential by default; drop a choice that is gone.
  useEffect(() => {
    const next = chooseCredentialId(needsCredential, credentialId, usable)
    if (next !== (credentialId ?? null)) useDeploymentStore.getState().updateDraft({ credentialId: next })
  }, [needsCredential, credentialId, usable, credentials])

  return {
    needsCredential,
    usableCredentials: usable,
    credentialId: credentialId ?? null,
    /** A VM app, the credentials are known, and none of them can be used. */
    credentialsMissing: needsCredential && credentialsResolved && usable.length === 0,
  }
}
