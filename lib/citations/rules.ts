export const BRAND_KEYWORDS = [
  'Aimengyouning',
  'Animalunion',
  'Aimeng Uning',
  'Aimeng Uning Biotechnology',
  'Shanghai Aimengyouning',
]

export function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeDoi(value: unknown) {
  return cleanText(value)
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
    .toLowerCase()
}

export function normalizeJournalName(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|journal|of)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractCatalogNumbers(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '')
  return Array.from(new Set((text.match(/\bLV\d{4,8}[A-Z]?\b/gi) || []).map((x) => x.toUpperCase())))
}

export function normalizeCatalogNumbers(value: unknown) {
  return Array.from(new Set(
    cleanText(value)
      .split(/[,，、\s]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  ))
}

export function extractBrandKeywords(value: unknown) {
  const text = (typeof value === 'string' ? value : JSON.stringify(value || '')).toLowerCase()
  return BRAND_KEYWORDS.filter((keyword) => text.includes(keyword.toLowerCase()))
}

export function calculateCitationPoints(impactFactor: number) {
  if (impactFactor >= 20) return 1500
  if (impactFactor >= 10) return 1200
  if (impactFactor >= 5) return 800
  return 500
}

export function isPlaceholderCitationText(value: unknown) {
  const text = cleanText(value)
  return !text || text.includes('待管理员审核') || text === '未识别'
}
