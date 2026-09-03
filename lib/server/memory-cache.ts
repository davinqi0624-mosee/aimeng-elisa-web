type CacheEntry<T> = {
  expiresAt: number
  value: T
}

const cache = new Map<string, CacheEntry<unknown>>()

export const SHORT_PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
}

export async function getMemoryCached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<{ value: T; hit: boolean }> {
  const now = Date.now()
  const existing = cache.get(key) as CacheEntry<T> | undefined
  if (existing && existing.expiresAt > now) {
    return { value: existing.value, hit: true }
  }

  const value = await load()
  cache.set(key, { value, expiresAt: now + ttlMs })
  return { value, hit: false }
}
