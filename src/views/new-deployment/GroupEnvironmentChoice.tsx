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
 * or one per member (the group then only decides who gets which files). Two short options like the file mode of
 * step 3, and below them what the selected one means. Shown for the group modes only; "each user individually"
 * already means one per person.
 */
export default function GroupEnvironmentChoice({ value, onChange }: GroupEnvironmentChoiceProps) {
  const { t } = useTranslation()
  const name = useId()
  const helpId = useId()
  return (
    <fieldset className="mt-4" data-testid="group-environment">
      <legend className="text-sm font-semibold text-textHeading">{t('deployment.groups.environment.title')}</legend>
      <div className="mt-2 inline-grid grid-cols-2 gap-1 rounded-xl bg-surfaceMuted p-1 max-sm:grid max-sm:w-full">
        {OPTIONS.map((option) => (
          <label key={option} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              aria-describedby={helpId}
              className="peer sr-only"
            />
            <span
              className={`block rounded-lg px-4 py-2 text-center text-sm transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary max-sm:px-1.5 max-sm:text-[13px] ${
                value === option ? 'bg-surface font-bold text-primaryDeep shadow-sm' : 'font-semibold text-textStrong hover:text-textHeading'
              }`}
            >
              {t(`deployment.groups.environment.${option}.label`)}
            </span>
          </label>
        ))}
      </div>
      <p id={helpId} className="mt-1.5 text-sm text-textStrong" aria-live="polite" data-testid="group-environment-help">
        {t(`deployment.groups.environment.${value}.text`)}
      </p>
    </fieldset>
  )
}
