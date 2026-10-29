import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToast } from '@/composables/useToast'
import { paths } from '@/router/paths'
import { formatSubmitError } from './summary'

/**
 * Submits the wizard draft.
 *
 * The wizard selects students by their AppStore user id, which is what the
 * teams carry; there is nothing to translate. On failure the draft stays as
 * it is, so steps 2/3 still show the user's selection.
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
      let deployment
      try {
        deployment = await useDeploymentStore.getState().submitDraft()
      } catch (err) {
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
