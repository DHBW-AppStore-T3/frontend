import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { userApi } from '@/api/user.api'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/http-error'
import { paths } from '@/router/paths'
import { formatSubmitError, mapIdsToUserIds } from './summary'

/**
 * Submits the wizard draft.
 *
 * The draft stores Keycloak ids (they key the student cache). The backend wants
 * user ids, so they are mapped and patched into the draft only for the
 * duration of the submit, then rolled back on failure so steps 2/3 still show
 * the user's selection.
 */
export function useSubmitDeployment() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  // Local lock: the store's loading flag only flips inside ``submitDraft``, so a
  // second click before then would start a second creation round trip.
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      let users
      try {
        users = (await userApi.list()).data || []
      } catch (err) {
        toast.error(extractErrorMessage(err, t('deployment.summary.fetchUsersError')))
        return
      }

      const toUserId = mapIdsToUserIds(users)
      const store = useDeploymentStore.getState()
      const original = {
        assignments: store.draft.assignments,
        studentIds: store.draft.studentIds,
      }
      store.updateDraft({
        assignments: (original.assignments as string[][]).map((group) => (group || []).map(toUserId).filter(Boolean)),
        studentIds: original.studentIds.map(toUserId).filter(Boolean),
      })

      let deployment
      try {
        deployment = await useDeploymentStore.getState().submitDraft()
      } catch (err) {
        useDeploymentStore.getState().updateDraft(original)
        toast.error(formatSubmitError(err, t))
        return
      }

      if (deployment?.deploymentId) {
        // Created: start the next wizard run clean.
        useDeploymentStore.getState().resetDraft()
        toast.success(t('deployment.summary.submitSuccess'))
        navigate(paths.deployments)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting }
}
