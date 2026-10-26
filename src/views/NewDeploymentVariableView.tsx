import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Layers } from 'lucide-react'
import DeploymentProgressBar from '@/components/DeploymentProgressBar'
import type { AppVariable } from '@/types'
import { isExpert, formKeyOf } from './new-deployment/variableForm'
import { useVariableForm } from './new-deployment/useVariableForm'
import VariableCard, { type Accent } from './new-deployment/VariableCard'
import ResourcePicker from './new-deployment/ResourcePicker'
import NetworkSettings from './new-deployment/NetworkSettings'
import { visibleNetworkKeys } from '@/utils/network'
import { useDeploymentStore } from '@/stores/deployment.store'

type Form = ReturnType<typeof useVariableForm>

interface ExpertToggleProps {
  count: number
  open: boolean
  accent: Accent
  onToggle: () => void
}

function ExpertToggle({ count, open, accent, onToggle }: ExpertToggleProps) {
  const { t } = useTranslation()
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        accent === 'blue' ? 'text-blue-700 hover:bg-blue-50' : 'text-purple-700 hover:bg-purple-50'
      }`}
    >
      <span>{t('deployment.variables.expertSettings', { count })}</span>
      <Chevron size={16} />
    </button>
  )
}

export default function NewDeploymentVariableView() {
  const { t } = useTranslation()
  const form = useVariableForm()
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const choices = useDeploymentStore((s) => s.draft.resourceChoices) ?? []
  const chosen = useDeploymentStore((s) => s.draft.resources) ?? {}
  const draft = useDeploymentStore((s) => s.draft)
  const hasNetwork = visibleNetworkKeys(draft).length > 0

  const card = (variable: AppVariable, accent: Accent, expert = false) => {
    const key = formKeyOf(variable)
    return (
      <VariableCard
        key={`${key}${expert ? '.expert' : ''}`}
        variable={variable}
        accent={accent}
        formKey={key}
        teams={form.teams}
        value={form.formValues[key]}
        expert={expert}
        getScopedValue={(slot) => form.getScopedValue(key, slot)}
        getFileSlot={form.getFileSlot}
        isTooltipOpen={activeTooltip === key}
        onToggleTooltip={() => setActiveTooltip((cur) => (cur === key ? null : key))}
        onChange={(v) => form.setValue(key, v)}
        onScopedChange={(slot, v) => form.setScopedValue(key, slot, v)}
        onFileChange={form.setFileSlot}
      />
    )
  }

  const terraformNormal = form.terraformVariables.filter((v) => !isExpert(v))
  const terraformExpert = form.terraformVariables.filter(isExpert)

  const renderBody = (f: Form) => (
    <div className="grid grid-cols-1 gap-6">
      {choices.length > 0 ? (
        <ResourcePicker
          choices={choices}
          value={chosen}
          vm={draft.runtime === 'kubevirt-vm'}
          onChange={(resources) => useDeploymentStore.getState().updateDraft({ resources })}
        />
      ) : null}

      {hasNetwork ? (
        <NetworkSettings
          draft={draft}
          onChange={(network) => useDeploymentStore.getState().updateDraft({ network })}
        />
      ) : null}

      {/* The app's own settings, declared in its appstore.yaml */}
      {f.terraformVariables.length === 0 && (choices.length > 0 || hasNetwork) ? null : (
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 overflow-hidden">
        <div className="bg-purple-600 text-white px-6 py-4 flex items-center gap-3">
          <Layers size={24} />
          <div>
            <h2 className="text-xl font-bold">{t('deployment.summary.appSettings')}</h2>
            <p className="text-xs text-purple-100 mt-0.5">{t('deployment.variables.appSettingsDesc')}</p>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
          {f.terraformVariables.length === 0 ? (
            <div className="text-center py-8 text-purple-600 italic">
              {t('deployment.summary.noAppSettings')}
            </div>
          ) : null}

          {terraformNormal.map((v) => card(v, 'purple'))}

          {terraformExpert.length > 0 ? (
            <div className="mt-2 border-t border-purple-200 pt-3">
              <ExpertToggle
                count={terraformExpert.length}
                open={f.terraformExpertOpen}
                accent="purple"
                onToggle={() => f.setTerraformExpertOpen(!f.terraformExpertOpen)}
              />
              {f.terraformExpertOpen ? (
                <div className="mt-3 space-y-4">{terraformExpert.map((v) => card(v, 'purple', true))}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      )}
    </div>
  )

  return (
    <div className="app-page wizard-page flex flex-col">
      <div className="mb-6">
        <div className="mb-8">
          <DeploymentProgressBar currentStep={3} />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-textHeading">{t('deployment.summary.variablesConfigTitle')}</h1>
          <p className="text-primary font-medium mt-2 text-lg">
            {t('deployment.summary.appLabel')}: {form.draftName || t('deployment.variables.unnamed')}
          </p>
        </div>
      </div>

      <div className="flex-grow w-full max-w-7xl mx-auto mt-6">
        {form.isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
            <span className="text-textFaint">{t('deployment.variables.loading')}</span>
          </div>
        ) : form.variables.length === 0 && choices.length === 0 && !hasNetwork ? (
          <div className="text-center py-12 text-textMuted italic bg-surfaceMuted rounded-xl border border-dashed">
            {t('deployment.variables.noVariables')}
          </div>
        ) : (
          renderBody(form)
        )}
      </div>

      <div className="flex justify-between items-center mt-12 pt-6 border-t border-borderSubtle">
        <button
          type="button"
          onClick={form.back}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full text-textMuted font-semibold hover:text-textHeading hover:bg-surfaceMuted transition-colors"
        >
          <ArrowLeft size={18} />
          {t('deployment.actions.back')}
        </button>

        {!form.canSubmit && !form.isLoading && form.variables.length > 0 ? (
          <div className="flex-1 mx-6 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            <p className="font-semibold mb-0.5">{t('deployment.variables.missingRequiredTitle')}</p>
            <ul className="list-disc pl-5">
              {form.missingRequired.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          onClick={form.next}
          disabled={!form.canSubmit}
          className={`flex items-center gap-2 px-8 py-2.5 rounded-full font-bold transition-colors shadow-lg ${
            form.canSubmit
              ? 'bg-success text-white hover:bg-successHover shadow-success/20'
              : 'bg-gray-300 text-textMuted cursor-not-allowed shadow-none'
          }`}
        >
          {t('deployment.actions.next')}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
