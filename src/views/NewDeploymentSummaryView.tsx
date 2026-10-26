import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BarChart3, ArrowRight, ArrowLeft, Layers } from 'lucide-react'
import DeploymentProgressBar from '@/components/DeploymentProgressBar'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { paths } from '@/router/paths'
import { displayNameOf } from './new-deployment/studentSelection'
import {
  buildFileSummaries,
  buildTerraformEntries,
  versionLabelOf,
  type SummaryEntry,
} from './new-deployment/summary'
import { useSummaryVariables } from './new-deployment/useSummaryVariables'
import { networkDeviations } from '@/utils/network'
import { useSubmitDeployment } from './new-deployment/useSubmitDeployment'
import { runtimeLabelKey } from '@/utils/runtime'

function VariableCard(props: {
  title: string
  empty: string
  entries: SummaryEntry[]
  icon: React.ReactNode
  tone: 'blue' | 'purple'
}) {
  const { t } = useTranslation()
  const blue = props.tone === 'blue'
  return (
    <div className={`bg-white rounded-lg border-2 overflow-hidden ${blue ? 'border-info/30' : 'border-purple-200'}`}>
      <div
        className={`px-4 py-2 border-b flex items-center gap-2 ${
          blue ? 'bg-infoTint border-info/30' : 'bg-purple-100 border-purple-200'
        }`}
      >
        {props.icon}
        <h4 className={`font-bold text-sm ${blue ? 'text-blue-900' : 'text-purple-900'}`}>{props.title}</h4>
        <span
          className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${
            blue ? 'bg-blue-200 text-blue-800' : 'bg-purple-200 text-purple-800'
          }`}
        >
          {props.entries.length}
        </span>
      </div>
      <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
        {props.entries.map((item) => (
          <div
            key={item.label}
            className="flex justify-between items-start gap-3 py-2 border-b border-borderSubtle last:border-0"
          >
            <span className="text-sm font-semibold text-textMuted flex-shrink-0">{item.label}</span>
            <span
              className="text-sm text-textHeading font-medium text-right break-all"
              title={item.raw ? t('deployment.summary.submittedValue', { value: item.raw }) : undefined}
            >
              {item.value}
            </span>
          </div>
        ))}
        {props.entries.length === 0 ? (
          <p className="text-sm text-textFaint italic text-center py-4">{props.empty}</p>
        ) : null}
      </div>
    </div>
  )
}

export default function NewDeploymentSummaryView() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const draft = useDeploymentStore((s) => s.draft)
  const isStoreLoading = useDeploymentStore((s) => s.isLoading)
  const studentCache = useDeploymentStore((s) => s.studentCache)
  const apps = useAppStore((s) => s.apps)
  const { defs, isLoading: isLoadingVariables } = useSummaryVariables()
  const { submit, isSubmitting } = useSubmitDeployment()

  const selectedApp = apps.find((a) => a.appId === draft.appId)
  const nameOf = (id: string) => {
    const student = studentCache.get(id)
    return student ? displayNameOf(student) || id : id
  }

  const modeLabel =
    draft.groupMode === 'one'
      ? t('deployment.groups.one')
      : draft.groupMode === 'eachUser'
        ? t('deployment.groups.eachUser')
        : t('deployment.groups.custom')

  const ctx = { t }
  const terraformEntries = buildTerraformEntries(defs, draft.variables, ctx)
  const fileSummaries = useMemo(() => buildFileSummaries(defs, draft.fileUploads), [defs, draft.fileUploads])
  const fileCount = fileSummaries.reduce((sum, v) => sum + v.chips.length, 0)
  // Expert settings are only mentioned when they differ from the app's default.
  const networkChanges = networkDeviations(draft)
  const busy = isSubmitting || isStoreLoading

  return (
    <div className="app-page wizard-page flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-textHeading">{t('deployment.title')}</h1>
          <BarChart3 size={32} className="text-primary" />
        </div>
        <DeploymentProgressBar currentStep={4} />
        <div className="border-b border-borderSubtle mt-4" />
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-textHeading">{t('deployment.summary.title')}</h2>
        <p className="text-textMuted mt-2">{t('deployment.summary.subtitle')}</p>
      </div>

      {isLoadingVariables ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="text-textMuted text-sm">{t('deployment.summary.loadingConfig')}</span>
        </div>
      ) : (
        <div className="flex-grow space-y-6">
          {/* 1 — base configuration */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border-2 border-emerald-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="text-xl font-bold text-textHeading">{t('deployment.summary.baseConfigTitle')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-emerald-100">
                <p className="text-xs text-textMuted mb-1 uppercase tracking-wider font-semibold">
                  {t('deployment.summary.deploymentNameLabel')}
                </p>
                <p className="text-lg font-bold text-textHeading">{draft.name || '-'}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-emerald-100">
                <p className="text-xs text-textMuted mb-1 uppercase tracking-wider font-semibold">
                  {t('deployment.summary.appLabel')}
                </p>
                <div className="flex items-center gap-2">
                  {selectedApp?.image ? (
                    <img src={selectedApp.image} alt={selectedApp.name} className="w-7 h-7 object-contain rounded" />
                  ) : null}
                  <p className="text-lg font-bold text-primaryDark">
                    {selectedApp?.name || t('deployment.summary.appNotFound')}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-emerald-100">
                <p className="text-xs text-textMuted mb-1 uppercase tracking-wider font-semibold">
                  {t('deployment.summary.versionLabel')}
                </p>
                <p className="text-lg font-bold text-textHeading">{versionLabelOf(draft.releaseTag)}</p>
              </div>
            </div>
            {/* How it runs: pods in the cluster */}
            <div className="mt-4 grid grid-cols-1 gap-4" data-testid="summary-runtime">
              <div className="bg-white rounded-lg p-4 border border-emerald-100">
                <p className="text-xs text-textMuted mb-1 uppercase tracking-wider font-semibold">
                  {t('deployment.summary.runtimeLabel')}
                </p>
                <p className="text-lg font-bold text-textHeading">{t(runtimeLabelKey(draft.runtime))}</p>
              </div>
            </div>
            {networkChanges.length > 0 ? (
              <div className="mt-4 bg-white rounded-lg p-4 border border-emerald-100" data-testid="summary-network">
                <p className="text-xs text-textMuted mb-2 uppercase tracking-wider font-semibold">
                  {t('deployment.network.title')}
                </p>
                {networkChanges.map(({ key, value }) => (
                  <p key={key} className="text-sm text-textHeading" data-testid={`summary-network-${key}`}>
                    <span className="font-semibold">{t(`deployment.network.${key}.label`)}</span>:{' '}
                    {value ? t('deployment.network.summaryOn') : t('deployment.network.summaryOff')}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="mt-4 bg-white rounded-lg p-4 border border-emerald-100">
              <p className="text-xs text-textMuted mb-2 uppercase tracking-wider font-semibold">
                {t('deployment.summary.selectedStudents', { count: draft.studentIds.length })}
              </p>
              <div className="flex flex-wrap gap-2">
                {draft.studentIds.map((studentId) => (
                  <span
                    key={studentId}
                    className="px-3 py-1 bg-primarySoft text-emerald-800 rounded-full text-sm font-medium border border-emerald-200"
                  >
                    {nameOf(studentId)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 2 — team assignment */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-info/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="text-xl font-bold text-textHeading">{t('deployment.summary.teamAssignmentTitle')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <p className="text-xs text-textMuted mb-1 uppercase tracking-wider font-semibold">
                  {t('deployment.summary.teamCountLabel')}
                </p>
                <p className="text-2xl font-bold text-blue-700">{draft.groupCount}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <p className="text-xs text-textMuted mb-1 uppercase tracking-wider font-semibold">
                  {t('deployment.summary.modeLabel')}
                </p>
                <p className="text-lg font-bold text-textHeading">{modeLabel}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values((draft.assignments || {}) as Record<string, string[]>).map((team, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-4 border-2 border-info/30 hover:border-blue-400 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-textHeading">
                      {draft.groupNames[index] || t('deployment.assignment.vmDefaultName', { index: index + 1 })}
                    </p>
                    <span className="px-2 py-1 bg-infoTint text-blue-700 rounded-full text-xs font-bold">
                      {t('deployment.assignment.userCount', { count: team?.length || 0 })}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(team || []).map((studentId) => (
                      <div
                        key={studentId}
                        className="text-sm text-textMuted bg-infoTint px-2 py-1 rounded border border-blue-100"
                      >
                        {nameOf(studentId)}
                      </div>
                    ))}
                    {!team || team.length === 0 ? (
                      <p className="text-xs text-textFaint italic">{t('deployment.summary.noUsersAssigned')}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3 — variables */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 className="text-xl font-bold text-textHeading">{t('deployment.summary.variablesConfigTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate(paths.deploymentVariables)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 transition-colors border border-purple-300 text-sm"
              >
                <ArrowRight size={16} />
                {t('deployment.summary.editBtn')}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <VariableCard
                tone="purple"
                title={t('deployment.summary.appSettings')}
                empty={t('deployment.summary.noAppSettings')}
                entries={terraformEntries}
                icon={<Layers size={18} className="text-purple-700" />}
              />

              {/* Files: one card per file variable; hidden when the app declares none. */}
              {fileSummaries.length > 0 ? (
                <div className="bg-white rounded-lg border-2 border-amber-200 overflow-hidden col-span-1 md:col-span-2">
                  <div className="bg-amber-100 px-4 py-2 border-b border-amber-200 flex items-center gap-2">
                    <Layers size={18} className="text-amber-700" />
                    <h4 className="font-bold text-amber-900 text-sm">{t('deployment.summary.uploadedFiles')}</h4>
                    <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                      {fileCount}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    {fileSummaries.map((entry) => (
                      <div key={entry.name}>
                        <div className="text-xs font-semibold text-textMuted mb-1">
                          {entry.name}
                          <span className="text-[10px] font-normal text-textMuted ml-1">({t('deployment.summary.scope', { scope: entry.scope })})</span>
                        </div>
                        {entry.chips.length === 0 ? (
                          <div className="text-xs text-textFaint italic">{t('deployment.summary.noFileUploaded')}</div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.chips.map((chip) => (
                              <span
                                key={`${entry.name}::${chip.slot}`}
                                className="inline-flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1 rounded"
                              >
                                <span className="font-medium">{chip.filename}</span>
                                <span className="text-amber-700">·</span>
                                <span>{chip.size}</span>
                                {entry.scope !== 'all' ? (
                                  <>
                                    <span className="text-amber-700">·</span>
                                    <span className="text-[10px] text-amber-700">{chip.slot}</span>
                                  </>
                                ) : null}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-8 pt-6 border-t-2 border-borderSubtle">
        <button
          type="button"
          onClick={() => navigate(paths.deploymentVariables)}
          className="flex items-center gap-2 px-8 py-3 rounded-full bg-surfaceMuted text-textMuted font-semibold hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft size={18} />
          {t('deployment.actions.back')}
        </button>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={isLoadingVariables || busy}
          className="flex items-center gap-3 px-10 py-3 rounded-full bg-gradient-to-r from-primary to-primaryDark text-white font-bold hover:from-primaryDark hover:to-primaryDark transition-all shadow-xl shadow-statusGreen/30 disabled:opacity-50 disabled:cursor-not-allowed"
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
