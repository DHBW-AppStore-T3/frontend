import { ref, watch, type Ref } from 'vue'

/** Per-account browser preferences; blocked storage falls back to this session. */
export function useFavorites(accountId: Ref<string | null>) {
  const favorites = ref<string[]>([])
  const storageKey = () => `appstore.favorites.${accountId.value ?? 'guest'}`
  watch(accountId, () => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? '[]')
      favorites.value = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
    } catch { favorites.value = [] }
  }, { immediate: true })
  function toggleFavorite(id: string) {
    favorites.value = favorites.value.includes(id) ? favorites.value.filter(value => value !== id) : [...favorites.value, id]
    try { localStorage.setItem(storageKey(), JSON.stringify(favorites.value)) } catch { /* Session-only in restricted embeds. */ }
  }
  return { favorites, toggleFavorite }
}
