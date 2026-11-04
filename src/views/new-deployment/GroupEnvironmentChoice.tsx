import { useId } from 'react'
import { useTranslation } from 'react-i18next'

export type WorkloadScope = 'team' | 'user'

export interface GroupEnvironmentChoiceProps {
  value: WorkloadScope
  onChange: (next: WorkloadScope) => void
}

const OPTIONS: WorkloadScope[] = ['team', 'user']

/**
 * What a group gets, where the app lets the person deploying choose (``scopeChoice``): one shared environment,
 * or one per member (the group then only decides who gets which files). Shown in the grouping step for the
 * group modes only; "each user individually" already means one per person.
 */
export default function GroupEnvironmentChoice({ value, onChange }: GroupEnvironmentChoiceProps) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <fieldset className="mt-4" data-testid="group-environment">
      <legend className="text-sm font-semibold text-textHeading">{t('deployment.groups.environment.title')}</legend>
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
                <span className="block font-medium text-textHeading">{t(`deployment.groups.environment.${option}.label`)}</span>
                <span className="block text-xs text-textMuted">{t(`deployment.groups.environment.${option}.text`)}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
