/**
 * Shared helper for the option stores' request actions.
 *
 * Every store action follows the same shape: flip a loading flag, clear the
 * error, run an API call, map a failure to a fallback error message, and reset
 * the loading flag in a `finally` block. This helper captures that shape while
 * keeping the exact per-action semantics (error fallback string, and whether
 * the error is re-thrown) under the caller's control.
 *
 * It takes the store's `set` function, so inside a Zustand action the call is
 * `runRequest(set, ...)`. Only the `isLoading`/`error` pair is touched; the
 * caller applies the result to its own state.
 */

import { extractErrorMessage } from '@/utils/http-error'

/** The conventional loading/error slice every request store exposes. */
export interface LoadingErrorState {
  isLoading: boolean
  error: string | null
}

/** A Zustand `set` narrowed to the loading/error slice. */
export type SetLoadingError = (patch: Partial<LoadingErrorState>) => void

export interface RunRequestOptions {
  /** When false, the caught error is swallowed instead of re-thrown. Defaults to true. */
  rethrow?: boolean
}

/**
 * Runs `fn`, mirroring the store actions' loading/error/finally behavior.
 *
 * - Sets loading to `true` and clears the error before running.
 * - On failure, stores `extractErrorMessage(err, fallbackMsg)` as the error.
 * - Always resets loading to `false` in a `finally` block.
 * - Re-throws by default (return type `Promise<T>`); pass `{ rethrow: false }`
 *   to swallow the error, in which case the result may be `undefined`.
 */
export async function runRequest<T>(
  set: SetLoadingError,
  fn: () => Promise<T>,
  fallbackMsg: string,
): Promise<T>
export async function runRequest<T>(
  set: SetLoadingError,
  fn: () => Promise<T>,
  fallbackMsg: string,
  options: { rethrow: false },
): Promise<T | undefined>
export async function runRequest<T>(
  set: SetLoadingError,
  fn: () => Promise<T>,
  fallbackMsg: string,
  options: RunRequestOptions = {},
): Promise<T | undefined> {
  const { rethrow = true } = options
  set({ isLoading: true, error: null })

  try {
    return await fn()
  } catch (err) {
    set({ error: extractErrorMessage(err, fallbackMsg) })
    if (rethrow) {
      throw err
    }
    return undefined
  } finally {
    set({ isLoading: false })
  }
}
