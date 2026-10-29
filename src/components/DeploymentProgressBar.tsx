import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

// 4 steps: config -> assignment -> variables -> summary. ``step`` is the logical number the
// views pass as ``currentStep``; the number on screen is the position among the visible steps.
const VARIABLES_STEP = 3
const STEPS = [
  { step: 1, key: 'deployment.steps.config' },
  { step: 2, key: 'deployment.steps.assignment' },
  { step: VARIABLES_STEP, key: 'deployment.steps.vars' },
  { step: 4, key: 'deployment.steps.summary' },
]

// Helper for text alignment.
function textAlignmentClass(step: number, total: number): string {
  if (step === 1) return 'left-0 origin-left' // first: left-aligned
  if (step === total) return 'right-0 origin-right' // last: right-aligned
  return 'left-1/2 -translate-x-1/2 origin-center' // in between: centered
}

interface DeploymentProgressBarProps {
  /** Logical step: 1 config, 2 assignment, 3 variables, 4 summary. */
  currentStep: number
  /** ``false`` when the app has nothing to set: the variables step is left out and the rest renumbered. */
  showVariablesStep?: boolean
}

export default function DeploymentProgressBar({ currentStep, showVariablesStep = true }: DeploymentProgressBarProps) {
  const { t } = useTranslation()

  const steps = showVariablesStep ? STEPS : STEPS.filter((item) => item.step !== VARIABLES_STEP)

  // Compute the fill width automatically from the number of visible steps.
  const totalSteps = steps.length
  const reached = steps.filter((item) => item.step <= currentStep).length
  const percentage = totalSteps <= 1 ? 0 : (Math.max(reached - 1, 0) / (totalSteps - 1)) * 100
  // Clamp to 0-100% for safety.
  const progressWidth = `${Math.min(Math.max(percentage, 0), 100)}%`

  return (
    <div className="w-full mb-8 px-2">
      <div className="relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 rounded-full" />

        <div
          data-testid="progress-fill"
          className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 rounded-full transition-all duration-500 ease-out"
          style={{ width: progressWidth }}
        />

        <div className="relative flex justify-between w-full">
          {steps.map((item, index) => (
            <div key={item.step} className="flex flex-col items-center group relative">
              <div
                className={[
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-bold z-10 transition-all duration-300 bg-white',
                  currentStep >= item.step
                    ? 'border-primary text-primary '
                    : 'border-borderSubtle text-textFaint',
                  // Completed steps use the primary brand color.
                  currentStep > item.step ? '!bg-primary !text-white' : '',
                  // Highlight the current step without animation.
                  currentStep === item.step ? 'text-primary' : '',
                ].join(' ')}
              >
                {currentStep > item.step ? <Check size={16} /> : <span>{index + 1}</span>}
              </div>

              <span
                className={[
                  'absolute top-10 text-xs font-bold uppercase tracking-wider transition-colors duration-300 whitespace-nowrap',
                  currentStep >= item.step ? 'text-primary' : 'text-textFaint',
                  textAlignmentClass(index + 1, totalSteps),
                ].join(' ')}
              >
                {t(item.key)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-6" />
    </div>
  )
}
