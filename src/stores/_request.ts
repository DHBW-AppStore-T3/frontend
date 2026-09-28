/**
 * Shared helper for the option stores' request actions.
 *
 * Every store action follows the same shape: flip a loading flag, clear the
 * error, run an API call, map a failure to a fallback error message, and reset
 * the loading flag in a `finally` block. This helper captures that shape while
 * keeping the exact per-action semantics (error fallback string, and whether
 * the error is re-thrown) under the caller's control.
 *
 * It takes the store itself. The previous signature took a
 * `{ setLoading, setError }` adapter, which meant every call site opened with
 * four lines of closure building that adapter -- the same amount of
 * boilerplate the helper was meant to remove. Two of the five stores adopted
 * it; the rest kept hand-rolling try/catch/finally, which is how the error
 * extraction below ended up duplicated across the codebase.
 *
 * Inside a Pinia options-store action, `this` is the store instance, so the
 * call is `runRequest(this, ...)`.
 */

import { extractErrorMessage } from '@/utils/http-error'

/** Any store exposing the conventional loading/error pair. */
export interface LoadingErrorState {
  isLoading: boolean
  error: string | null
}

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
  store: LoadingErrorState,
  fn: () => Promise<T>,
  fallbackMsg: string,
): Promise<T>
export async function runRequest<T>(
  store: LoadingErrorState,
  fn: () => Promise<T>,
  fallbackMsg: string,
  options: { rethrow: false },
): Promise<T | undefined>
export async function runRequest<T>(
  store: LoadingErrorState,
  fn: () => Promise<T>,
  fallbackMsg: string,
  options: RunRequestOptions = {},
): Promise<T | undefined> {
  const { rethrow = true } = options
  store.isLoading = true
  store.error = null

  try {
    return await fn()
  } catch (err) {
    store.error = extractErrorMessage(err, fallbackMsg)
    if (rethrow) {
      throw err
    }
    return undefined
  } finally {
    store.isLoading = false
  }
}
