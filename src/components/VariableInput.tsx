/**
 * Renders the input for ONE variable VALUE. The caller decides whether to
 * render a single instance (``varScope = all``) or one instance per scope slot
 * (``varScope = team|user``) — this component knows nothing about scopes.
 *
 *  * picks the right widget for the variable's HCL type
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
import type { AppVariable, ScalarValue, SlotValue } from '@/types'
import { isBool, isList, isNumber } from '@/utils/variable-types'

export interface VariableInputProps {
  variable: AppVariable
  /** What the form holds; lists arrive as comma text, anything else as typed. */
  value: SlotValue
  /** What the widget emits: text, a number (``valueAsNumber``, NaN when cleared) or a boolean. */
  onChange: (value: ScalarValue) => void
  accent?: 'blue' | 'purple'
  /** DOM id of the input; scope-iterated variables pass a suffixed id per slot. */
  inputId?: string
  /** E.g. while a previous wizard step is incomplete. */
  disabled?: boolean
}

// ``file`` is rendered by the parent, ``enum`` is a select over the declared values.
const isEnum = (v: AppVariable): boolean => v.osType === 'enum'

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

// What a text-like field is given: React shows null and undefined as empty and
// everything else through String(), so an array reads ``a,b``.
const shown = (value: SlotValue): string | number => (typeof value === 'number' ? value : value == null ? '' : String(value))

const FIELD_BASE =
  'w-full px-3 py-2 rounded-lg border-2 outline-none transition-all text-textHeading disabled:bg-surfaceMuted disabled:text-textMuted'

export default function VariableInput({
  variable,
  value,
  onChange,
  accent = 'blue',
  inputId,
  disabled,
}: VariableInputProps) {
  const { t } = useTranslation()
  const colors = ACCENT[accent]
  const id = inputId || variable.name
  const type = variable.type

  // One of the values the appstore.yaml declares.
  if (isEnum(variable)) {
    return (
      <select
        value={shown(value)}
        onChange={(e) => onChange(e.target.value)}
        id={id}
        disabled={disabled}
        data-testid="enum-input"
        className={`${FIELD_BASE} font-medium bg-white ${colors.border}`}
      >
        {!variable.default ? (
          <option value="" disabled>
            {t('variableInput.choose')}
          </option>
        ) : null}
        {(variable.values ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
        value={shown(value)}
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
        value={shown(value)}
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
      value={shown(value)}
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
