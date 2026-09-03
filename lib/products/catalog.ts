export function normalizeElisaCatalogNumber(value?: string | null) {
  const text = (value || '').normalize('NFKC').trim().toUpperCase()
  if (!text) return ''

  const compact = text.replace(/\s+/g, '')
  const match = compact.match(/^([A-Z]{1,8}-?\d{3,})([MS])$/)
  return match ? match[1] : compact
}

export function catalogNumberVariants(value?: string | null) {
  const normalized = normalizeElisaCatalogNumber(value)
  if (!normalized) return []

  return Array.from(new Set([normalized, `${normalized}M`, `${normalized}S`]))
}

export function getCatalogDisplayNumber(value?: string | null) {
  return normalizeElisaCatalogNumber(value) || (value || '').trim()
}
