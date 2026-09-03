import { normalizeElisaCatalogNumber } from './catalog'

const IMAGE_SUFFIX_WORDS = new Set([
  'standard',
  'curve',
  'standardcurve',
  'standard_curve',
  'std',
  'image',
  'img',
  'png',
  'jpg',
  'jpeg',
  'webp',
])

export type ParsedProductAssetName = {
  catalogNumber: string
  species: string
  target: string
  warnings: string[]
}

function cleanPart(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .trim()
}

function isLikelyCatalog(value: string) {
  return Boolean(normalizeElisaCatalogNumber(value).match(/^[A-Z]{1,8}-?\d{3,}$/))
}

export function normalizeAssetToken(value?: string | null) {
  return (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[α]/g, 'alpha')
    .replace(/[β]/g, 'beta')
    .replace(/[γ]/g, 'gamma')
    .replace(/[_\-\s]+/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
}

export function parseProductAssetFileName(fileName: string): ParsedProductAssetName {
  const base = cleanPart(fileName)
  const warnings: string[] = []
  const rawParts = base
    .split(/__|_|-|，|,|\s+/)
    .map((part) => cleanPart(part))
    .filter(Boolean)
    .filter((part) => !IMAGE_SUFFIX_WORDS.has(part.toLowerCase()))

  let catalogNumber = ''
  const parts = [...rawParts]
  if (parts.length > 0 && isLikelyCatalog(parts[0])) {
    catalogNumber = normalizeElisaCatalogNumber(parts.shift())
  }

  const species = parts.shift() || ''
  const target = parts.join(' ').trim()

  if (!catalogNumber && (!species || !target)) {
    warnings.push('文件名需要包含货号，或包含“种属 + 指标名称”。')
  }

  return {
    catalogNumber,
    species,
    target,
    warnings,
  }
}
