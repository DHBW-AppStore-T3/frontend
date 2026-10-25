import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import VariableInput from '@/components/VariableInput'
import FileDropZone from '@/components/FileDropZone'
import ScopeBadge from '@/components/ui/ScopeBadge'
import { translateHtml } from '@/i18n/html'
import type { AppVariable, DeploymentFile } from '@/types'
import { isList } from '@/utils/variable-types'
import {
  displayDescription,
  effectiveScope,
  formatSlotLabel,
  isFileVar,
  isScoped,
  slotKeysFor,
  userSlotKey,
  type WizardTeam,
} from './variableForm'

export type Accent = 'blue' | 'purple'

export interface VariableCardProps {
  variable: AppVariable
  accent: Accent
  /** Key of the variable in the form (``<tkey>.<name>`` for multi-image packer). */
  formKey: string
  teams: WizardTeam[]
  value: any
  getScopedValue: (slot: string) => any
  getFileSlot: (varName: string, slot: string) => DeploymentFile | null
  isTooltipOpen: boolean
  /** Expert variables render compactly: the plain input only. */
  expert?: boolean
  onToggleTooltip: () => void
  onChange: (value: any) => void
  onScopedChange: (slot: string, value: any) => void
  onFileChange: (varName: string, slot: string, file: DeploymentFile | null) => void
}

const COLORS = {
  blue: {
    card: 'border-info/30',
    expertCard: 'border-blue-200 opacity-90',
    label: 'hover:text-blue-700',
    infoButton: 'hover:text-info',
    infoButtonActive: 'text-info',
    tooltip: 'bg-infoTint border-blue-100',
    tooltipHint: 'text-blue-700',
    typeBadge: 'bg-infoTint text-blue-700 border-info/30',
  },
  purple: {
    card: 'border-purple-200',
    expertCard: 'border-purple-200 opacity-90',
    label: 'hover:text-purple-700',
    infoButton: 'hover:text-purple-600',
    infoButtonActive: 'text-purple-600',
    tooltip: 'bg-purple-50 border-purple-100',
    tooltipHint: 'text-purple-700',
    typeBadge: 'bg-purple-100 text-purple-700 border-purple-200',
  },
} as const

const EMPTY_TEAMS_HINT = 'text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2'
const TEAM_GROUP = 'border-l-2 border-borderSubtle pl-3 space-y-2'
const TEAM_TITLE = 'text-xs font-semibold text-textMuted uppercase tracking-wide'

/** One variable of the wizard: label, hints, scope info and the right input(s). */
export default function VariableCard(props: VariableCardProps) {
  const { variable, accent, formKey, teams, expert } = props
  const { t } = useTranslation()
  const c = COLORS[accent]
  const scope = effectiveScope(variable)
  const noTeams = <div className={EMPTY_TEAMS_HINT}>{t('deployment.variables.noTeamsConfigured')}</div>
  const noMembers = <div className="text-xs text-textMuted italic">{t('deployment.variables.noMembers')}</div>

  const input = (id: string, value: any, onChange: (v: any) => void) => (
    <VariableInput
      variable={variable}
      value={value}
      onChange={onChange}
      accent={accent}
      inputId={id}
    />
  )

  const slotInput = (slot: string, label: string) => (
    <div key={`${variable.name}::${slot}`} className="flex flex-col gap-1">
      <label htmlFor={`${formKey}__${slot}`} className="text-xs font-semibold text-textMuted">
        {label}
      </label>
      {input(`${formKey}__${slot}`, props.getScopedValue(slot), (v) => props.onScopedChange(slot, v))}
    </div>
  )

  const fileZone = (slot: string, label: string) => (
    <FileDropZone
      key={`${variable.name}::${slot}`}
      value={props.getFileSlot(variable.name, slot)}
      onChange={(file) => props.onFileChange(variable.name, slot, file)}
      label={label}
      accept={variable.fileExtensions?.length ? variable.fileExtensions.map((e) => `.${e}`).join(',') : '*'}
    />
  )

  const userGroups = (render: (team: WizardTeam, member: WizardTeam['members'][number]) => React.ReactNode) =>
    teams.map((team) => (
      <div key={`${variable.name}::${team.name}`} className={TEAM_GROUP}>
        <div className={TEAM_TITLE}>{team.name}</div>
        {team.members.map((member) => render(team, member))}
        {team.members.length === 0 ? noMembers : null}
      </div>
    ))

  let body: React.ReactNode
  if (isFileVar(variable)) {
    const fileScope = variable.osScope || 'all'
    body = (
      <div className="space-y-3">
        {fileScope === 'all' ? fileZone('all', variable.name) : null}
        {fileScope === 'team' ? (
          <>
            {teams.map((team) => fileZone(team.name, team.name))}
            {teams.length === 0 ? noTeams : null}
          </>
        ) : null}
        {fileScope === 'user' ? (
          <>
            {userGroups((team, member) => fileZone(userSlotKey(team.name, member.username), member.username))}
            {teams.length === 0 ? noTeams : null}
          </>
        ) : null}
      </div>
    )
  } else if (!isScoped(variable)) {
    body = input(formKey, props.value, props.onChange)
  } else if (scope === 'user') {
    body = (
      <div className="space-y-3">
        {teams.length === 0 ? noTeams : null}
        {userGroups((team, member) => slotInput(userSlotKey(team.name, member.username), member.username))}
      </div>
    )
  } else {
    const slots = slotKeysFor(variable, teams)
    body = (
      <div className="space-y-3">
        {slots.length === 0 ? noTeams : null}
        {slots.map((slot) => slotInput(slot, formatSlotLabel(variable, slot, teams)))}
      </div>
    )
  }

  // Expert variables: plain inputs only (scoped/file ones are not offered there).
  const showBody = !expert || (!isScoped(variable) && !isFileVar(variable))
  const showInfoButton = variable.description || isList(variable.type)

  return (
    <div
      className={`bg-white rounded-lg p-4 border shadow-sm ${expert ? c.expertCard : c.card}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <label
          htmlFor={formKey}
          onClick={(e) => {
            e.preventDefault()
            document.getElementById(formKey)?.focus()
          }}
          className={`text-base font-bold text-textHeading cursor-pointer transition-colors flex-1 ${c.label}`}
        >
          {variable.name}
        </label>
        {showInfoButton ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              props.onToggleTooltip()
            }}
            className={`text-textFaint transition-colors focus:outline-none ${c.infoButton} ${
              props.isTooltipOpen ? c.infoButtonActive : ''
            }`}
            title={t('deployment.variables.showInfo')}
          >
            <Info size={16} />
          </button>
        ) : null}
      </div>

      {props.isTooltipOpen ? (
        <div className={`mb-3 p-3 rounded-lg border text-sm text-textMuted ${c.tooltip}`}>
          {displayDescription(variable) ? <p className="mb-2">{displayDescription(variable)}</p> : null}
          {isList(variable.type) ? (
            <div className={`flex gap-2 items-start text-xs ${c.tooltipHint}`}>
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>{t('deployment.variables.commaSeparated')}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${c.typeBadge}`}
        >
          {variable.type}
        </span>
        {variable.required ? (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-dangerTint text-red-700 px-2 py-0.5 rounded border border-danger/30">
            {t('deployment.variables.required')}
          </span>
        ) : null}
        <ScopeBadge scope={scope} />
      </div>

      {!expert && isScoped(variable) ? (
        <div className="mb-3 text-xs text-purple-800 bg-purple-50 border border-purple-200 rounded px-3 py-2">
          <p className="font-semibold mb-0.5">
            {scope === 'team'
              ? t('deployment.variables.scopeTitleTeam')
              : t('deployment.variables.scopeTitleUser')}
          </p>
          <p
            // eslint-disable-next-line no-restricted-syntax -- static translation, no parameters
            dangerouslySetInnerHTML={{
              __html: translateHtml(
                scope === 'team' ? 'deployment.variables.scopeDescTeam' : 'deployment.variables.scopeDescUser',
                {},
                t,
              ),
            }}
          />
        </div>
      ) : null}

      {showBody ? body : null}
    </div>
  )
}
