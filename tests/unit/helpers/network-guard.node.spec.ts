// @vitest-environment node
import { it, expect } from 'vitest'
import { networkGuard } from '../../helpers/network-guard'

// Node-environment tests have no `window`: the guard stays out of the way.
it('does not install itself without a window', () => {
  expect(typeof window).toBe('undefined')
  expect(networkGuard.isInstalled()).toBe(false)
})
