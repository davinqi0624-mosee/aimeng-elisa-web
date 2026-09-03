import { normalizeElisaCatalogNumber } from './catalog'

export type ProductDocumentType = 'datasheet' | 'coa'

export type ParsedProductDocumentName = {
  originalName: string
  baseName: string
  documentType: ProductDocumentType
  catalogNumber: string
  batchNumber: string | null
  documentKey: string
  warnings: string[]
}

const NOISE_TOKENS = new Set([
  'datasheet',
  'data-sheet',
  'manual',
  'protocol',
  'instruction',
  'instructions',
  'coa',
  'certificate',
  'analysis',
  'report',
  'pdf',
  '说明书',
  '操作说明',
  '检测报告',
  '质检报告',
  '分析证书',
])

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim()
}

function normalizeToken(token: string) {
  return token
    .trim()
    .replace(/[()（）【】[\]{}]/g, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5.-]/g, '')
}

function splitNameParts(baseName: string) {
  return baseName
    .split(/[_\s,，;；]+/g)
    .map(normalizeToken)
    .filter(Boolean)
}

function isNoiseToken(token: string) {
  return NOISE_TOKENS.has(token.toLowerCase())
}

function normalizeCatalogNumber(value: string) {
  return normalizeElisaCatalogNumber(value)
}

function normalizeBatchNumber(value: string) {
  return value.trim().toUpperCase()
}

function extractLeadingCatalogNumber(baseName: string) {
  const text = baseName.normalize('NFKC').trim()
  const match = text.match(/^([A-Z]{1,8}-?\d{3,}(?:[MS])?)(?=$|[-_\s,，;；.])/i)
  return match ? normalizeCatalogNumber(match[1]) : ''
}

function getNameAfterLeadingCatalog(baseName: string, catalogNumber: string) {
  if (!catalogNumber) return baseName
  const text = baseName.normalize('NFKC').trim()
  const pattern = new RegExp(`^${catalogNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[MS])?[-_\\s,，;；.]*`, 'i')
  return text.replace(pattern, '').trim()
}

export function parseProductDocumentFileName(
  fileName: string,
  documentType: ProductDocumentType
): ParsedProductDocumentName {
  const baseName = stripExtension(fileName)
  const parts = splitNameParts(baseName)
  const meaningfulParts = parts.filter((part) => !isNoiseToken(part))
  const warnings: string[] = []

  const leadingCatalogNumber = extractLeadingCatalogNumber(baseName)
  const catalogNumber = leadingCatalogNumber || (meaningfulParts[0] ? normalizeCatalogNumber(meaningfulParts[0]) : '')
  const restParts = leadingCatalogNumber
    ? splitNameParts(getNameAfterLeadingCatalog(baseName, leadingCatalogNumber)).filter((part) => !isNoiseToken(part))
    : meaningfulParts.slice(1)
  let batchNumber = restParts[0] ? normalizeBatchNumber(restParts[0]) : null

  if (!catalogNumber) {
    warnings.push(
      documentType === 'coa'
        ? '文件名需要包含货号和批次号，例如 LV10001_20240601_COA.pdf'
        : '文件名需要以货号开头，例如 LV10001-Product name.pdf'
    )
  }

  if (documentType === 'datasheet') {
    batchNumber = null
  }

  if (documentType === 'coa' && !batchNumber) {
    warnings.push('COA 文件名需要包含批次号，例如 货号_批次号_COA.pdf。')
  }

  const documentKey =
    documentType === 'coa'
      ? [catalogNumber, batchNumber].filter(Boolean).join('__')
      : catalogNumber

  return {
    originalName: fileName,
    baseName,
    documentType,
    catalogNumber,
    batchNumber,
    documentKey,
    warnings,
  }
}

export function buildProductDocumentStorageName(
  parsed: ParsedProductDocumentName,
  uniqueSuffix: string
) {
  const safeKey = parsed.documentKey
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${parsed.documentType}_${safeKey || 'unmatched'}_${uniqueSuffix}.pdf`
}

export function getProductDocumentNamingHint(documentType: ProductDocumentType) {
  return documentType === 'coa'
    ? 'COA 文件名建议：货号_批次号_COA.pdf，例如 LV10001_20240601_COA.pdf。'
    : '说明书文件名建议：货号-Product name.pdf，例如 LV10001-zebrafish aqp1 Elisa Kit.pdf。'
}
