import type { StoreApi } from 'zustand'

/**
 * Live view onto a Zustand store for tests.
 *
 * `useStore.getState()` returns a snapshot that goes stale after every `set`.
 * The Pinia-style specs read and assign `store.field` directly after awaiting
 * actions; this proxy forwards every read to the *current* state and every
 * assignment to `setState`, so those specs port with a one-line change.
 */
export function liveStore<S extends object>(store: StoreApi<S>): S {
  return new Proxy({} as S, {
    get: (_t, key) => (store.getState() as Record<PropertyKey, unknown>)[key],
    set: (_t, key, value) => {
      store.setState({ [key]: value } as unknown as Partial<S>)
      return true
    },
  })
}

/** Reset a store to the state it had at creation (actions are preserved). */
export function resetStore<S extends object>(store: StoreApi<S> & { getInitialState: () => S }): void {
  store.setState(store.getInitialState(), true)
}
