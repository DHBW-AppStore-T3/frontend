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
})
