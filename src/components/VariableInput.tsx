/**
 * Renders the input for ONE variable VALUE. The caller decides whether to
 * render a single instance (``varScope = all``) or one instance per scope slot
 * (``varScope = team|user``) — this component knows nothing about scopes.
 *
 *  * picks the right widget for the variable's HCL type
 *  * delegates OpenStack-typed variables to ``OpenStackResourcePicker``
 *  * binds to a single ``value``/``onChange`` pair
 *
 * File-typed variables are NOT handled here — the wizard renders
 * ``FileDropZone`` separately because files travel through a different draft
 * channel (``fileUploads``) than scalar inputs.
 *
 * Border/focus colours come from the ``accent`` prop so the wizard's two
 * sections (Packer = blue, Terraform = purple) stay visually distinct.
 */
import { useTranslation } from 'react-i18next'
import type { AppVariable } from '@/types'
import type { OsResourceType } from '@/api/openstack-resources.api'
import OpenStackResourcePicker from '@/components/OpenStackResourcePicker'

export interface VariableInputProps {
  variable: AppVariable
  value: any
  onChange: (value: any) => void
  /** Id-mode value of the network a subnet picker should be restricted to. */
  filterNetworkId?: string | null
  accent?: 'blue' | 'purple'
  /** DOM id of the input; scope-iterated variables pass a suffixed id per slot. */
  inputId?: string
  /** E.g. while a previous wizard step is incomplete. */
  disabled?: boolean
  /** Forwarded from the OpenStack picker (shared banner in the parent). */
  onCredentialsMissing?: (missing: boolean) => void
}

const isBool = (type: string) => ['bool', 'boolean'].includes(type.toLowerCase())
const isNumber = (type: string) => ['number', 'int', 'integer'].includes(type.toLowerCase())
const isList = (type: string) => /^(list|set|array)/i.test(type)

// The picker wins over type-based inputs, including list(...) variables, since
// it handles multi itself. ``file`` is rendered by the parent.
const hasOsPicker = (v: AppVariable): boolean => Boolean(v.osType) && v.osType !== 'file'

// Explicit class maps — Tailwind's JIT can't read class names assembled from
// template-literal segments.
const ACCENT = {
  purple: {
    border: 'border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100',
    toggleOn: 'bg-purple-500',
    toggleFocus: 'focus:ring-2 focus:ring-purple-500',
  },
  blue: {
    border: 'border-info/30 focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
    toggleOn: 'bg-info',
    toggleFocus: 'focus:ring-2 focus:ring-blue-500',
  },
} as const

const FIELD_BASE =
  'w-full px-3 py-2 rounded-lg border-2 outline-none transition-all text-textHeading disabled:bg-surfaceMuted disabled:text-textMuted'

export default function VariableInput({
  variable,
  value,
  onChange,
  filterNetworkId,
  accent = 'blue',
  inputId,
  disabled,
  onCredentialsMissing,
}: VariableInputProps) {
  const { t } = useTranslation()
  const colors = ACCENT[accent]
  const id = inputId || variable.name
  const type = variable.type

  if (hasOsPicker(variable)) {
    return (
      <OpenStackResourcePicker
        osType={variable.osType as OsResourceType}
        osMode={variable.osMode || 'name'}
        multi={variable.osMulti || false}
        filterNetworkId={variable.osType === 'subnet' ? (filterNetworkId ?? null) : null}
        allowFreeText
        value={value}
        onChange={onChange}
        onCredentialsMissing={onCredentialsMissing}
      />
    )
  }

  if (isBool(type)) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          id={id}
          disabled={disabled}
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            value ? colors.toggleOn : 'bg-gray-300'
          } ${colors.toggleFocus}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
              value ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm font-medium text-textMuted">
          {value ? t('variableInput.on') : t('variableInput.off')}
        </span>
      </div>
    )
  }

  if (isNumber(type)) {
    return (
      <input
        type="number"
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        disabled={disabled}
        placeholder="0"
        className={`${FIELD_BASE} font-medium ${colors.border}`}
      />
    )
  }

  if (isList(type)) {
    return (
      <textarea
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        placeholder={t('variableInput.listPlaceholder')}
        className={`${FIELD_BASE} font-mono text-sm ${colors.border}`}
      />
    )
  }

  return (
    <input
      type="text"
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={
        variable.default
          ? t('variableInput.defaultPlaceholder', { value: variable.default })
          : t('variableInput.enterValue')
      }
      className={`${FIELD_BASE} font-medium ${colors.border}`}
    />
  )
}
