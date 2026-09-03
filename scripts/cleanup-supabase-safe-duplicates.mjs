import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const applyChanges = process.argv.includes('--apply')
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

function loadEnvFile(fileName) {
  const filePath = join(root, fileName)
  if (!existsSync(filePath)) return

  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || serviceRoleKey

if (!url || !key) {
  throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const STORAGE_BUCKETS = ['agent-assets', 'page-assets', 'citation-files', 'product-assets']

function decode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function sizeOf(file) {
  return Number(file.metadata?.size ?? file.metadata?.contentLength ?? 0) || 0
}

function storageKey(bucket, path) {
  return `${bucket}/${path.replace(/^\/+/, '').replace(new RegExp(`^${bucket}/`), '')}`
}

function parseStorageReference(value, bucketHint) {
  if (typeof value !== 'string' || !value.trim()) return null

  const text = decode(value.trim())
  const marker = '/storage/v1/object/public/'
  const markerIndex = text.indexOf(marker)

  if (markerIndex >= 0) {
    const rest = text.slice(markerIndex + marker.length)
    const slash = rest.indexOf('/')
    if (slash > 0) {
      return {
        bucket: rest.slice(0, slash),
        path: rest.slice(slash + 1),
      }
    }
    return null
  }

  if (text.startsWith('http://') || text.startsWith('https://')) return null
  if (text.startsWith('product-assets/')) {
    return { bucket: 'product-assets', path: text.slice('product-assets/'.length) }
  }
  if (text.startsWith('citation-files/')) {
    return { bucket: 'citation-files', path: text.slice('citation-files/'.length) }
  }
  if (!bucketHint) return null

  return {
    bucket: bucketHint,
    path: text.replace(/^\/+/, ''),
  }
}

async function listAllFiles(bucket, prefix = '') {
  const files = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) {
      throw new Error(`读取 Storage ${bucket}/${prefix} 失败：${error.message}`)
    }
    if (!data?.length) break

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) {
        files.push({
          bucket,
          path,
          id: item.id,
          metadata: item.metadata,
          created_at: item.created_at,
        })
      } else {
        files.push(...await listAllFiles(bucket, path))
      }
    }

    if (data.length < 100) break
    offset += 100
  }

  return files
}

async function fetchAll(table, columns) {
  const rows = []

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + 999)

    if (error) {
      return { rows: [], error: error.message }
    }
    if (!data?.length) break

    rows.push(...data)
    if (data.length < 1000) break
  }

  return { rows, error: null }
}

function addReference(references, value, label, bucketHint, state = 'active') {
  const parsed = parseStorageReference(value, bucketHint)
  if (!parsed) return

  const key = storageKey(parsed.bucket, parsed.path)
  if (!references.has(key)) {
    references.set(key, { active: [], historical: [] })
  }

  references.get(key)[state === 'active' ? 'active' : 'historical'].push(label)
}

function duplicateKey(file) {
  const eTag = String(file.metadata?.eTag || file.metadata?.etag || '').replaceAll('"', '')
  if (!eTag) return ''

  const mime = file.metadata?.mimetype || file.metadata?.contentType || ''
  return [file.bucket, mime, sizeOf(file), eTag].join('|')
}

function isHistorical(row) {
  return (
    row.is_active === false ||
    row.is_displayed === false ||
    ['archived', 'deleted', 'rolled_back', 'rejected'].includes(row.status) ||
    row.storage_status === 'deleted' ||
    row.publish_status === 'archived' ||
    row.upload_status === 'failed'
  )
}

async function collectReferences() {
  const references = new Map()
  const errors = []

  const sources = [
    ['products', 'status,product_image,standard_curve_image,validation_image,additional_image,datasheet_pdf'],
    ['product_images', 'image_url'],
    ['agents', 'wechat_qr,wechat_qr_code'],
    ['customer_service_settings', 'wechat_qr_url'],
    ['shop_items', 'image_url'],
    ['home_banners', 'image_url'],
    ['home_media_items', 'cover_image_url,external_url,is_active'],
    ['serum_products', 'image_url'],
    ['serum_coa_documents', 'file_url,status'],
    ['product_documents', 'id,product_id,document_type,document_key,catalog_number,file_url,status,storage_status,publish_status,match_status'],
    ['product_asset_uploads', 'id,file_url,file_path,status'],
    ['purchase_point_claim_photos', 'file_url,file_path'],
    ['papers', 'id,file_url,file_path,journal_cover_url,upload_status,is_displayed'],
  ]

  for (const [table, columns] of sources) {
    const result = await fetchAll(table, columns)
    if (result.error) {
      errors.push(`${table}: ${result.error}`)
      continue
    }

    for (const row of result.rows) {
      const state = isHistorical(row) ? 'historical' : 'active'
      const label = `${table}:${row.id || row.product_id || ''}`

      addReference(references, row.product_image, label, 'product-assets', state)
      addReference(references, row.standard_curve_image, label, 'product-assets', state)
      addReference(references, row.validation_image, label, 'product-assets', state)
      addReference(references, row.additional_image, label, 'product-assets', state)
      addReference(references, row.datasheet_pdf, label, 'product-assets', state)
      addReference(references, row.image_url, label, 'product-assets', state)
      addReference(references, row.wechat_qr, label, 'agent-assets', state)
      addReference(references, row.wechat_qr_code, label, 'agent-assets', state)
      addReference(references, row.wechat_qr_url, label, 'page-assets', state)
      addReference(references, row.cover_image_url, label, 'product-assets', state)
      addReference(references, row.external_url, label, 'product-assets', state)
      addReference(references, row.file_url, label, table === 'papers' ? 'citation-files' : 'product-assets', state)
      addReference(references, row.file_path, label, table === 'papers' ? 'citation-files' : 'product-assets', state)
      addReference(references, row.journal_cover_url, label, 'citation-files', state)
    }
  }

  const settings = await fetchAll('site_settings', 'homepage_content,product_media,lab_assets')
  if (settings.error) {
    errors.push(`site_settings: ${settings.error}`)
  } else {
    for (const row of settings.rows) {
      const homepage = row.homepage_content || {}
      for (const item of homepage.home_media_items || []) {
        addReference(references, item.cover_image_url, 'site_settings.homepage_content', 'product-assets')
        addReference(references, item.external_url, 'site_settings.homepage_content', 'product-assets')
      }

      const productMedia = row.product_media || {}
      addReference(references, productMedia.product_ad_image_url, 'site_settings.product_media', 'product-assets')
      addReference(references, productMedia.method_image_url, 'site_settings.product_media', 'product-assets')

      const labAssets = row.lab_assets || {}
      addReference(references, labAssets.elisa_analysis_template_url, 'site_settings.lab_assets', 'product-assets')
      addReference(references, labAssets.elisa_testing_service_form_url, 'site_settings.lab_assets', 'product-assets')
    }
  }

  return { references, errors }
}

async function updateArchivedDocument(rowId) {
  const { error } = await supabase
    .from('product_documents')
    .update({
      storage_status: 'deleted',
      workflow_updated_at: new Date().toISOString(),
    })
    .eq('id', rowId)

  if (error) {
    throw new Error(`更新说明书记录 ${rowId} 失败：${error.message}`)
  }
}

async function removeFiles(files) {
  const removed = []
  const failed = []

  for (const bucket of STORAGE_BUCKETS) {
    const paths = files.filter((file) => file.bucket === bucket).map((file) => file.path)
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100)
      const { error } = await supabase.storage.from(bucket).remove(batch)
      if (error) {
        failed.push({ bucket, paths: batch, error: error.message })
      } else {
        removed.push(...batch.map((path) => ({ bucket, path })))
      }
    }
  }

  return { removed, failed }
}

const files = []
for (const bucket of STORAGE_BUCKETS) {
  files.push(...await listAllFiles(bucket))
}

const fileMap = new Map(files.map((file) => [storageKey(file.bucket, file.path), file]))
const { references, errors: referenceErrors } = await collectReferences()
const productDocumentsResult = await fetchAll(
  'product_documents',
  'id,product_id,document_type,document_key,catalog_number,file_url,status,storage_status'
)
if (productDocumentsResult.error) {
  throw new Error(`读取 product_documents 失败：${productDocumentsResult.error}`)
}

const documents = productDocumentsResult.rows
const activeDocumentKeys = new Set(
  documents
    .filter((row) => row.status === 'active' && row.storage_status !== 'deleted')
    .map((row) => `${row.catalog_number || row.document_key || ''}|${row.document_type}`)
)

const candidates = []
const documentUpdates = []

for (const document of documents) {
  const parsed = parseStorageReference(document.file_url, 'product-assets')
  if (!parsed) continue

  const key = storageKey(parsed.bucket, parsed.path)
  const file = fileMap.get(key)
  if (!file) continue

  const documentKey = `${document.catalog_number || document.document_key || ''}|${document.document_type}`
  const activeReference = references.get(key)?.active?.length > 0
  const hasActiveReplacement =
    document.status === 'archived' &&
    document.storage_status === 'active' &&
    activeDocumentKeys.has(documentKey)

  if (hasActiveReplacement && !activeReference) {
    candidates.push({
      bucket: file.bucket,
      path: file.path,
      size: sizeOf(file),
      reason: 'archived product document has an active replacement and no active database reference',
      sourceId: document.id,
    })
    documentUpdates.push(document.id)
  }
}

const duplicateGroups = new Map()
for (const file of files) {
  const key = duplicateKey(file)
  if (!key) continue
  if (!duplicateGroups.has(key)) duplicateGroups.set(key, [])
  duplicateGroups.get(key).push(file)
}

for (const group of duplicateGroups.values()) {
  if (group.length < 2) continue

  const hasActiveReference = group.some(
    (file) => references.get(storageKey(file.bucket, file.path))?.active?.length > 0
  )
  if (!hasActiveReference) continue

  for (const file of group) {
    const key = storageKey(file.bucket, file.path)
    const reference = references.get(key)
    if (reference?.active?.length || reference?.historical?.length) continue
    if (candidates.some((candidate) => candidate.bucket === file.bucket && candidate.path === file.path)) continue

    candidates.push({
      bucket: file.bucket,
      path: file.path,
      size: sizeOf(file),
      reason: 'exact duplicate of an active referenced object with no database reference',
      sourceId: null,
    })
  }
}

const uniqueCandidates = [...new Map(
  candidates.map((candidate) => [`${candidate.bucket}/${candidate.path}`, candidate])
).values()]

const report = {
  generatedAt: new Date().toISOString(),
  mode: applyChanges ? 'apply' : 'preview',
  storage: {
    files: files.length,
    bytes: files.reduce((total, file) => total + sizeOf(file), 0),
  },
  referenceErrors,
  candidates: uniqueCandidates,
  candidateCount: uniqueCandidates.length,
  candidateBytes: uniqueCandidates.reduce((total, file) => total + file.size, 0),
  documentRecordsToMarkDeleted: documentUpdates,
}

let deletionResult = null
if (applyChanges && uniqueCandidates.length > 0) {
  deletionResult = await removeFiles(uniqueCandidates)
  const removedKeys = new Set(deletionResult.removed.map((file) => `${file.bucket}/${file.path}`))
  for (const documentId of documentUpdates) {
    const candidate = uniqueCandidates.find((item) => item.sourceId === documentId)
    if (candidate && removedKeys.has(`${candidate.bucket}/${candidate.path}`)) {
      await updateArchivedDocument(documentId)
    }
  }
  report.deletionResult = deletionResult
}

const reportsDir = join(root, 'reports')
mkdirSync(reportsDir, { recursive: true })
const reportPath = join(reportsDir, `supabase-storage-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
writeFileSync(reportPath, JSON.stringify(report, null, 2))

console.log(JSON.stringify({
  mode: report.mode,
  storageFiles: report.storage.files,
  storageBytes: report.storage.bytes,
  candidateCount: report.candidateCount,
  candidateBytes: report.candidateBytes,
  candidateHuman: formatBytes(report.candidateBytes),
  documentRecordsToMarkDeleted: report.documentRecordsToMarkDeleted.length,
  deletionResult,
  reportPath,
}, null, 2))
