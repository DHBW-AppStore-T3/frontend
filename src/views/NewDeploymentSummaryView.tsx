import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BarChart3, ArrowLeft } from 'lucide-react'
import DeploymentProgressBar from '@/components/DeploymentProgressBar'
import { useDeploymentStore } from '@/stores/deployment.store'
import { paths } from '@/router/paths'
import { displayNameOf } from './new-deployment/studentSelection'
import { versionLabelOf } from './new-deployment/summary'
import { buildSettingsRows, type EnvironmentUnit } from './new-deployment/summaryRows'
import { buildWizardTeams } from './new-deployment/variableForm'
import { useDraftApp } from './new-deployment/useDraftApp'
import { useSummaryVariables } from './new-deployment/useSummaryVariables'
import { useNeedsVariablesStep } from './new-deployment/variablesStep'
import { useSubmitDeployment } from './new-deployment/useSubmitDeployment'
import SummaryHero from './new-deployment/SummaryHero'
import SummaryParticipants, { type ParticipantTeam } from './new-deployment/SummaryParticipants'
import SummarySettings from './new-deployment/SummarySettings'
import SummarySkeleton from './new-deployment/SummarySkeleton'

export default function NewDeploymentSummaryView() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const draft = useDeploymentStore((s) => s.draft)
  const isStoreLoading = useDeploymentStore((s) => s.isLoading)
  const studentCache = useDeploymentStore((s) => s.studentCache)
  const { app: selectedApp, isLoading: isLoadingApp } = useDraftApp()
  const { defs, isLoading: isLoadingVariables } = useSummaryVariables()
  const isLoading = isLoadingVariables || isLoadingApp
  // Apps with nothing to set skip the "Variables" step: "Back" leads to the teams, the bar has three steps.
  const showVariablesStep = useNeedsVariablesStep() !== false
  const { submit, isSubmitting } = useSubmitDeployment()

  const nameOf = (id: string) => {
    const student = studentCache.get(id)
    return student ? displayNameOf(student) || id : id
  }

  const unit: EnvironmentUnit = draft.runtime === 'kubevirt-vm' ? 'desktop' : 'pod'
  const mode = draft.groupMode === 'one' ? 'one' : draft.groupMode === 'eachUser' ? 'eachUser' : 'custom'
  const people = draft.studentIds.length

  const participantTeams: ParticipantTeam[] = Object.values((draft.assignments || {}) as Record<string, string[]>).map(
    (members, index) => ({
      id: String(index),
      name: draft.groupNames[index] || t('deployment.assignment.vmDefaultName', { index: index + 1 }),
      members: (members || []).map(nameOf),
    }),
  )

  // The card "Variablen-Konfiguration" exists exactly when there are rows; step 3 exists when the app has something to set.
  const settingsRows = buildSettingsRows(draft, defs, {
    t,
    teams: buildWizardTeams(draft.groupNames, draft.assignments as string[][], studentCache),
    nameOf,
  })
  const busy = isSubmitting || isStoreLoading

  return (
    <div className="app-page wizard-page flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-textHeading">{t('deployment.title')}</h1>
          <BarChart3 size={32} className="text-primary" />
        </div>
        <DeploymentProgressBar currentStep={4} showVariablesStep={showVariablesStep} />
        <div className="border-b border-borderSubtle mt-4" />
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-textHeading">{t('deployment.summary.title')}</h2>
        <p className="text-textMuted mt-2">{t('deployment.summary.subtitle')}</p>
      </div>

      <div
        className="mx-auto grid w-full max-w-3xl flex-grow content-start gap-4"
        data-testid="summary-loading"
        aria-live="polite"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <SummarySkeleton />
        ) : (
          <>
            <SummaryHero
              appName={selectedApp?.name ?? null}
              appImage={selectedApp?.image}
              deploymentName={draft.name}
              people={people}
              version={versionLabelOf(draft.releaseTag)}
              runtime={draft.runtime}
              onEdit={() => navigate(paths.deploymentConfig)}
            />
            <SummaryParticipants
              mode={mode}
              unit={unit}
              people={people}
              teams={participantTeams}
              onEdit={() => navigate(paths.deploymentTeams)}
            />
            <SummarySettings rows={settingsRows} onEdit={() => navigate(paths.deploymentVariables)} />
          </>
        )}
      </div>

      <div className="mx-auto mt-10 flex w-full max-w-3xl items-center justify-between border-t border-borderSubtle pt-6">
        <button
          type="button"
          onClick={() => navigate(showVariablesStep ? paths.deploymentVariables : paths.deploymentTeams)}
          className="flex items-center gap-2 px-8 py-3 rounded-full bg-surfaceMuted text-textMuted font-semibold hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft size={18} />
          {t('deployment.actions.back')}
        </button>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={isLoading || busy}
          className="flex items-center gap-3 px-10 py-3 rounded-full bg-gradient-to-r from-primary to-primaryDark text-white font-bold hover:from-primaryDark hover:to-primaryDark transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              <span>{t('deployment.summary.creating')}</span>
            </>
          ) : (
            <span>{t('deployment.actions.deploy')}</span>
          )}
        </button>
      </div>
    </div>
  )
}
