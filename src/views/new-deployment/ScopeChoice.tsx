import { useId } from 'react'
import { useTranslation } from 'react-i18next'

export type WorkloadScope = 'user' | 'team'

/** The scope control of an "expert settings" panel: the current choice and what happens on a change. */
export interface ScopeChoiceProps {
  value: WorkloadScope
  onChange: (next: WorkloadScope) => void
}

const OPTIONS: WorkloadScope[] = ['user', 'team']

/**
 * What one environment is: one per person, or one per group. Only for apps whose author lets the person
 * deploying choose (``scopeChoice``); it sits among the expert settings, the grouping is free either way.
 */
export default function ScopeChoice({ value, onChange }: ScopeChoiceProps) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <fieldset data-testid="scope-choice">
      <legend className="text-sm font-semibold text-textHeading">{t('deployment.assignment.scopeChoice.title')}</legend>
      <p className="mt-0.5 text-xs text-textFaint">{t('deployment.assignment.scopeChoice.help')}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {OPTIONS.map((option) => {
          const checked = value === option
          return (
            <label
              key={option}
              className={`flex max-w-sm cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 text-sm transition-colors ${
                checked ? 'border-primary bg-primaryFaint' : 'border-borderSubtle bg-white hover:bg-surfaceMuted'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                onChange={() => onChange(option)}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block font-medium text-textHeading">
                  {t(`deployment.assignment.scopeChoice.${option}.label`)}
                </span>
                <span className="block text-xs text-textMuted">{t(`deployment.assignment.scopeChoice.${option}.text`)}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
