import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Box, ChevronDown, ChevronUp, Layers } from 'lucide-react'
import DeploymentProgressBar from '@/components/DeploymentProgressBar'
import type { AppVariable } from '@/types'
import { isExpert, formKeyOf } from './new-deployment/variableForm'
import { useVariableForm } from './new-deployment/useVariableForm'
import VariableCard, { type Accent } from './new-deployment/VariableCard'
import ResourcePicker from './new-deployment/ResourcePicker'
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

  const card = (variable: AppVariable, accent: Accent, expert = false) => {
    const key = formKeyOf(variable, form.isMultiImage)
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
        filterNetworkId={form.networkIdForSubnets()}
        onToggleTooltip={() => setActiveTooltip((cur) => (cur === key ? null : key))}
        onChange={(v) => form.setValue(key, v)}
        onScopedChange={(slot, v) => form.setScopedValue(key, slot, v)}
        onFileChange={form.setFileSlot}
      />
    )
  }

  const packerCount = form.templateKeys.reduce((n, k) => n + form.packerByTemplate[k]!.length, 0)
  const terraformNormal = form.terraformVariables.filter((v) => !isExpert(v))
  const terraformExpert = form.terraformVariables.filter(isExpert)

  const packerPanel = (f: Form) => (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-info/30 overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4 flex items-center gap-3">
        <Box size={24} />
        <div>
          <h2 className="text-xl font-bold">{t('deployment.summary.packerVars')}</h2>
          <p className="text-xs text-blue-100 mt-0.5">{t('deployment.variables.packerDesc')}</p>
        </div>
      </div>

      <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
        {packerCount === 0 ? (
          <div className="text-center py-8 text-info italic">{t('deployment.summary.noPackerVars')}</div>
        ) : null}

        {f.templateKeys.map((tkey) => {
          const vars = f.packerByTemplate[tkey]!
          const normal = vars.filter((v) => !isExpert(v))
          const expert = vars.filter(isExpert)
          return (
            <div key={tkey} className="space-y-6">
              {f.templateKeys.length > 1 ? (
                <div className="-mx-6 px-6 py-2 bg-infoTint/70 border-y border-info/30 text-sm font-semibold text-blue-900">
                  Image: <code className="font-mono">{tkey}</code>
                </div>
              ) : null}

              {normal.map((v) => card(v, 'blue'))}

              {expert.length > 0 ? (
                <div className="mt-2 border-t border-blue-200 pt-3">
                  <ExpertToggle
                    count={expert.length}
                    open={f.packerExpertOpen}
                    accent="blue"
                    onToggle={() => f.setPackerExpertOpen(!f.packerExpertOpen)}
                  />
                  {f.packerExpertOpen ? (
                    <div className="mt-3 space-y-4">{expert.map((v) => card(v, 'blue', true))}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderBody = (f: Form) => (
    <div className={`grid grid-cols-1 gap-6 ${f.isPods ? '' : 'lg:grid-cols-2'}`}>
      {f.isPods && choices.length > 0 ? (
        <ResourcePicker
          choices={choices}
          value={chosen}
          onChange={(resources) => useDeploymentStore.getState().updateDraft({ resources })}
        />
      ) : null}

      {/* Packer only exists for VM apps; pods declare their settings in appstore.yaml. */}
      {f.isPods ? null : packerPanel(f)}

      {/* Terraform (VM apps) or the app's own settings (pods) */}
      {f.isPods && f.terraformVariables.length === 0 && choices.length > 0 ? null : (
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 overflow-hidden">
        <div className="bg-purple-600 text-white px-6 py-4 flex items-center gap-3">
          <Layers size={24} />
          <div>
            <h2 className="text-xl font-bold">
              {f.isPods ? t('deployment.summary.appSettings') : t('deployment.summary.terraformVars')}
            </h2>
            <p className="text-xs text-purple-100 mt-0.5">
              {f.isPods ? t('deployment.variables.appSettingsDesc') : t('deployment.variables.terraformDesc')}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
          {f.terraformVariables.length === 0 ? (
            <div className="text-center py-8 text-purple-600 italic">
              {f.isPods ? t('deployment.summary.noAppSettings') : t('deployment.summary.noTerraformVars')}
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
        ) : form.variables.length === 0 && choices.length === 0 ? (
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
