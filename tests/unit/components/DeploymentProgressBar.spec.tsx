import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import DeploymentProgressBar from '@/components/DeploymentProgressBar'
import { renderWithProviders } from '../../helpers/render'

describe('DeploymentProgressBar', () => {
  it.each([
    [1, '0%'],
    [2, '33.33333333333333%'],
    [4, '100%'],
    [9, '100%'],
    [0, '0%'],
  ])('fills the track for step %s to %s (clamped)', (step, width) => {
    renderWithProviders(<DeploymentProgressBar currentStep={step} />)
    expect(screen.getByTestId('progress-fill').style.width).toBe(width)
  })

  it('shows a check for completed steps and the number for the rest', () => {
    const { container } = renderWithProviders(<DeploymentProgressBar currentStep={3} />)
    expect(container.querySelectorAll('svg')).toHaveLength(2) // steps 1 + 2 done
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders the four translated step labels', () => {
    renderWithProviders(<DeploymentProgressBar currentStep={1} />)
    for (const key of ['config', 'assignment', 'vars', 'summary']) {
      expect(screen.getByText(`deployment.steps.${key}`)).toBeInTheDocument()
    }
  })

  describe('without the variables step', () => {
    it('renders three labels and leaves out the variables one', () => {
      renderWithProviders(<DeploymentProgressBar currentStep={1} showVariablesStep={false} />)
      for (const key of ['config', 'assignment', 'summary']) {
        expect(screen.getByText(`deployment.steps.${key}`)).toBeInTheDocument()
      }
      expect(screen.queryByText('deployment.steps.vars')).not.toBeInTheDocument()
    })

    it('numbers the visible steps 1 to 3, so the summary carries the 3', () => {
      renderWithProviders(<DeploymentProgressBar currentStep={1} showVariablesStep={false} />)
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.queryByText('4')).not.toBeInTheDocument()
    })

    it('fills the track and ticks the earlier steps for the summary (logical step 4)', () => {
      const { container } = renderWithProviders(<DeploymentProgressBar currentStep={4} showVariablesStep={false} />)
      expect(screen.getByTestId('progress-fill').style.width).toBe('100%')
      expect(container.querySelectorAll('svg')).toHaveLength(2) // config + assignment done
      expect(screen.getByText('3')).toBeInTheDocument() // the summary, still current
    })

    it.each([
      [1, '0%'],
      [2, '50%'],
      [0, '0%'],
      [9, '100%'],
    ])('fills the track for logical step %s to %s', (step, width) => {
      renderWithProviders(<DeploymentProgressBar currentStep={step} showVariablesStep={false} />)
      expect(screen.getByTestId('progress-fill').style.width).toBe(width)
    })

    it.each([[undefined], [true]])('shows four steps when showVariablesStep is %s', (flag) => {
      const { container } = renderWithProviders(<DeploymentProgressBar currentStep={1} showVariablesStep={flag} />)
      expect(container.querySelectorAll('span.uppercase')).toHaveLength(4)
    })
  })
})
