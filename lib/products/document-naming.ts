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
  return value
    .normalize('NFKC')
    .trim()
    .replace(/^LOT(?:\s*NO\.?)?[-_\s:]*/i, '')
    .toUpperCase()
}

function stripReportMarkers(baseName: string) {
  return baseName
    .normalize('NFKC')
    .trim()
    .replace(/^(?:COA|CERTIFICATE\s+OF\s+ANALYSIS|检测报告|质检报告|分析报告|分析证书)\s*[-_—–:：]*\s*/i, '')
    .replace(/\s*[-_—–:：]*\s*(?:COA|CERTIFICATE\s+OF\s+ANALYSIS|检测报告|质检报告|分析报告|分析证书)$/i, '')
    .trim()
}

function extractLeadingCatalogNumber(baseName: string) {
  const text = baseName.normalize('NFKC').trim()
  const match = text.match(/^([A-Z]{1,8}-?\d{3,}(?:[MS])?)(?=$|[-_\s,，;；.])/i)
  return match ? normalizeCatalogNumber(match[1]) : ''
}

function extractCoaCatalogAndBatch(baseName: string) {
  const text = stripReportMarkers(baseName).replace(/^[-_—–\s]+|[-_—–\s]+$/g, '')
  const separated = text.match(/^(.+?)[_\s,，;；]+(?:LOT(?:\s*NO\.?)?[-_\s:]*)?([A-Z0-9][A-Z0-9.-]{2,})$/i)
  if (separated) {
    return {
      catalogNumber: normalizeCatalogNumber(separated[1]),
      batchNumber: normalizeBatchNumber(separated[2]),
    }
  }

  // 血清货号自身包含多个连字符，只把明确的批号后缀（纯数字，或带 LOT 前缀）
  // 从末尾拆出，避免把 AM-FBS-BZ-0500 误切成货号 AM-FBS-BZ + 批号 0500。
  const hyphenated = text.match(/^(.+?)-(?:LOT(?:-?NO\.?)?-?)?(\d{5,})$/i)
  if (hyphenated) {
    return {
      catalogNumber: normalizeCatalogNumber(hyphenated[1]),
      batchNumber: normalizeBatchNumber(hyphenated[2]),
    }
  }

  return null
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

  const parsedCoa = documentType === 'coa' ? extractCoaCatalogAndBatch(baseName) : null
  const leadingCatalogNumber = extractLeadingCatalogNumber(baseName)
  const catalogNumber =
    parsedCoa?.catalogNumber ||
    leadingCatalogNumber ||
    (meaningfulParts[0] ? normalizeCatalogNumber(meaningfulParts[0]) : '')
  const restParts = leadingCatalogNumber
    ? splitNameParts(getNameAfterLeadingCatalog(baseName, leadingCatalogNumber)).filter((part) => !isNoiseToken(part))
    : meaningfulParts.slice(1)
  let batchNumber = parsedCoa?.batchNumber || (restParts[0] ? normalizeBatchNumber(restParts[0]) : null)

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
    warnings.push('COA 文件名需要包含血清货号和批号，例如 COA-货号-批号.pdf 或 货号_批号_COA.pdf。')
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
    ? 'COA 文件名支持：COA-血清货号-批号.pdf，或 血清货号_批号_COA.pdf。例如 COA-AM-FBS-BZ-0500-20251225.pdf。'
    : '说明书文件名建议：货号-Product name.pdf，例如 LV10001-zebrafish aqp1 Elisa Kit.pdf。'
}
