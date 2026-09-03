import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const DEFAULT_FILE = '/Users/moses/Desktop/爱萌文章信息登记.xlsx'
const DEFAULT_SHEET = '2022年AU发文奖励客户统计'
const OFFICIAL_IMPORT_USER_ID = '670d943d-4263-409b-9840-b0d15291b419'

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, '')
  }
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u0002/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/_x0002_/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanMultiline(value) {
  return String(value ?? '')
    .replace(/\u0002/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/_x0002_/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeUrl(value) {
  const text = cleanText(value)
  if (!text) return ''
  return text.replace(/\s+/g, '').replace(/。$/g, '')
}

function normalizeDoi(value) {
  const text = normalizeUrl(value)
  if (!text) return ''
  const doiMatch = text.match(/10\.\d{4,9}\/[^\s"'<>]+/i)
  if (doiMatch) return doiMatch[0].replace(/[)。.,;，；]+$/g, '').toLowerCase()
  return ''
}

function extractCatalogNumbers(value) {
  const text = String(value ?? '')
  const matches = text.match(/\bLV\d{4,8}[A-Z]?\b/gi) || []
  return Array.from(new Set(matches.map((item) => item.toUpperCase())))
}

function stripSpecSuffix(catNo) {
  return catNo.replace(/([0-9])[MS]$/i, '$1').toUpperCase()
}

function getDetectedProducts(value) {
  const original = extractCatalogNumbers(value)
  return Array.from(new Set(original.map(stripSpecSuffix).filter(Boolean)))
}

function parseYear(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getFullYear()
  const text = cleanText(value)
  if (!text) return undefined
  const direct = text.match(/\b(20\d{2})\b/)
  if (direct) return Number(direct[1])
  const short = text.match(/\b(\d{1,2})\/\d{1,2}\/(\d{2})\b/)
  if (short) return Number(`20${short[2]}`)
  return undefined
}

function toImpactFactor(value) {
  const number = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(number) ? number : null
}

function rowToPaper(row) {
  let title = cleanText(row[7])
  let link = normalizeUrl(row[8])

  if (/^https?:\/\//i.test(title) && link && !/^https?:\/\//i.test(link)) {
    const swappedTitle = title
    title = cleanText(row[8])
    link = normalizeUrl(swappedTitle)
  }

  const year = parseYear(row[10])
  const originalCatalogNumbers = extractCatalogNumbers(row[6])
  const detectedProducts = getDetectedProducts(row[6])
  const applicant = cleanText(row[2])
  const role = cleanText(row[3])
  const affiliation = cleanText(row[4])
  const productText = cleanMultiline(row[5])
  const evidenceText = cleanMultiline(row[9])

  return {
    title,
    user_id: OFFICIAL_IMPORT_USER_ID,
    authors: [applicant, role].filter(Boolean).join(' / '),
    affiliation,
    journal: cleanText(row[11]) || '期刊待补充',
    doi: normalizeDoi(link),
    link: link || null,
    publication_date: year ? `${year}-01-01` : null,
    product_cat_no: detectedProducts[0] || null,
    impact_factor: toImpactFactor(row[12]),
    abstract: productText ? `使用产品：${productText}` : null,
    evidence_text: evidenceText || null,
    detected_products: detectedProducts,
    detected_brands: ['Aimeng Youning', 'Animalunion'].filter((brand) => {
      const haystack = `${productText} ${evidenceText} ${title}`.toLowerCase()
      return haystack.includes(brand.toLowerCase())
    }),
    extraction_result: {
      source_file: path.basename(DEFAULT_FILE),
      source_sheet: DEFAULT_SHEET,
      source_sequence: cleanText(row[0]),
      applicant,
      applicant_role: role,
      product_text: productText,
      original_catalog_numbers: originalCatalogNumbers,
      imported_by: 'scripts/import-official-citations-from-excel.mjs',
    },
    upload_status: 'verified',
    status: 'verified',
    is_displayed: true,
    citation_type: 'official_import',
    source_type: 'official_excel',
    discovery_status: 'confirmed',
    points_awarded: 0,
    verified_at: new Date().toISOString(),
    verified_by: null,
    verified_admin_id: null,
  }
}

function readPapersFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true })
  const worksheet = workbook.Sheets[DEFAULT_SHEET] || workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false })
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cleanText(cell)))
    .map(rowToPaper)
    .filter((paper) => paper.title)
}

async function main() {
  loadEnv('.env.local')

  const filePath = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--')) || DEFAULT_FILE
  const dryRun = process.argv.includes('--dry-run')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。')
  }

  const papers = readPapersFromExcel(filePath)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existingRows, error: existingError } = await supabase
    .from('papers')
    .select('id,title,doi,link')

  if (existingError) throw existingError

  const existingKeys = new Set()
  for (const paper of existingRows || []) {
    if (paper.doi) existingKeys.add(`doi:${normalizeDoi(paper.doi)}`)
    if (paper.link) existingKeys.add(`link:${normalizeUrl(paper.link)}`)
    existingKeys.add(`title:${cleanText(paper.title).toLowerCase()}`)
  }

  const toInsert = []
  const skipped = []
  for (const paper of papers) {
    const keys = [
      paper.doi ? `doi:${paper.doi}` : '',
      paper.link ? `link:${normalizeUrl(paper.link)}` : '',
      `title:${cleanText(paper.title).toLowerCase()}`,
    ].filter(Boolean)

    if (keys.some((key) => existingKeys.has(key))) {
      skipped.push(paper)
      continue
    }

    toInsert.push(paper)
    keys.forEach((key) => existingKeys.add(key))
  }

  const summary = {
    source: filePath,
    parsed: papers.length,
    insertable: toInsert.length,
    skipped_duplicates: skipped.length,
    years: Object.fromEntries(
      [...new Set(papers.map((paper) => paper.publication_date?.slice(0, 4)).filter(Boolean))]
        .sort()
        .map((year) => [year, papers.filter((paper) => paper.publication_date?.startsWith(year)).length])
    ),
    high_if_count: papers.filter((paper) => (paper.impact_factor || 0) >= 10).length,
    top_if: papers
      .slice()
      .sort((a, b) => (b.impact_factor || 0) - (a.impact_factor || 0))
      .slice(0, 5)
      .map((paper) => ({ title: paper.title, journal: paper.journal, impact_factor: paper.impact_factor })),
  }

  console.log(JSON.stringify(summary, null, 2))

  if (dryRun || toInsert.length === 0) return

  const { data, error } = await supabase
    .from('papers')
    .insert(toInsert)
    .select('id,title')

  if (error) throw error
  console.log(`导入完成：新增 ${data?.length || 0} 篇，跳过重复 ${skipped.length} 篇。`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
