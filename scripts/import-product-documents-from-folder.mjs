import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()

function loadEnvFile(fileName) {
  const filePath = path.join(root, fileName)
  if (!existsSync(filePath)) return

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function usage() {
  console.log(
    'Usage: node scripts/import-product-documents-from-folder.mjs <folder> [--type=datasheet|coa] [--publish] [--batch-size=50] [--report]'
  )
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCatalogNumber(value) {
  const text = clean(value).normalize('NFKC').toUpperCase()
  if (!text) return ''
  const compact = text.replace(/\s+/g, '')
  const match = compact.match(/^([A-Z]{1,8}-?\d{3,})([MS])$/)
  return match ? match[1] : compact
}

function stripExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, '').trim()
}

function extractCatalogNumber(fileName) {
  const baseName = stripExtension(fileName).normalize('NFKC').trim()
  const match = baseName.match(/^([A-Z]{1,8}-?\d{3,}(?:[MS])?)(?=$|[-_\s,，;；.])/i)
  return match ? normalizeCatalogNumber(match[1]) : ''
}

function buildStorageName(documentType, catalogNumber) {
  const safeKey = catalogNumber
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${documentType}_${safeKey || 'unmatched'}_${randomUUID().slice(0, 8)}.pdf`
}

function getArgs() {
  const args = process.argv.slice(2)
  const folder = args.find((arg) => !arg.startsWith('--'))
  const typeArg = args.find((arg) => arg.startsWith('--type=')) || ''
  const batchSizeArg = args.find((arg) => arg.startsWith('--batch-size=')) || ''
  const documentType = typeArg.split('=')[1] === 'coa' ? 'coa' : 'datasheet'
  const batchSize = Math.max(1, Number(batchSizeArg.split('=')[1] || 0) || 0)
  const publish = args.includes('--publish')
  const report = args.includes('--report')
  return { folder, documentType, publish, batchSize: batchSize || 0, report }
}

function chunkArray(items, size) {
  if (!size || size >= items.length) return [items]
  const chunks = []
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size))
  }
  return chunks
}

function getTimestamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
}

async function loadProductsByCatalog(supabase, catalogs) {
  const productMap = new Map()
  if (catalogs.length === 0) return productMap

  for (let offset = 0; offset < catalogs.length; offset += 100) {
    const chunk = catalogs.slice(offset, offset + 100)
    const catalogResult = await supabase
      .from('products')
      .select('id, name, target, catalog_number, cat_no, status')
      .eq('status', 'active')
      .in('catalog_number', chunk)
    if (catalogResult.error) throw catalogResult.error

    const catNoResult = await supabase
      .from('products')
      .select('id, name, target, catalog_number, cat_no, status')
      .eq('status', 'active')
      .in('cat_no', chunk)
    if (catNoResult.error) throw catNoResult.error

    for (const product of [...(catalogResult.data || []), ...(catNoResult.data || [])]) {
      const key = normalizeCatalogNumber(product.catalog_number || product.cat_no)
      if (key && !productMap.has(key)) productMap.set(key, product)
    }
  }

  return productMap
}

async function archiveInactiveConflicts(supabase, productId, documentType, documentKey) {
  const { data, error } = await supabase
    .from('product_documents')
    .select('id, status, review_note')
    .eq('product_id', productId)
    .eq('document_type', documentType)
    .eq('document_key', documentKey)

  if (error) throw error

  for (const doc of data || []) {
    if (doc.status === 'active') continue
    const suffix = String(doc.id).slice(0, 8)
    const { error: updateError } = await supabase
      .from('product_documents')
      .update({
        document_key: `${documentKey}__old__${suffix}`,
        review_note: [clean(doc.review_note), '本地目录导入释放旧记录唯一键。'].filter(Boolean).join('；'),
        workflow_updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)
    if (updateError) throw updateError
  }
}

async function loadActiveDocuments(supabase, productIds, documentType) {
  const documentMap = new Map()
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))]

  for (let offset = 0; offset < uniqueProductIds.length; offset += 100) {
    const chunk = uniqueProductIds.slice(offset, offset + 100)
    const { data, error } = await supabase
      .from('product_documents')
      .select('product_id, id, file_name, file_url')
      .eq('document_type', documentType)
      .eq('status', 'active')
      .in('product_id', chunk)

    if (error) throw error

    for (const doc of data || []) {
      if (doc.product_id && !documentMap.has(doc.product_id)) {
        documentMap.set(doc.product_id, doc)
      }
    }
  }

  return documentMap
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const { folder, documentType, publish, batchSize, report } = getArgs()
if (!folder) {
  usage()
  process.exit(1)
}

const sourceFolder = path.resolve(folder)
if (!existsSync(sourceFolder)) {
  console.error(`Folder not found: ${sourceFolder}`)
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local/.env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const files = readdirSync(sourceFolder)
  .filter((name) => name.toLowerCase().endsWith('.pdf'))
  .sort((a, b) => a.localeCompare(b, 'en'))

if (files.length === 0) {
  console.error(`No PDF files found in ${sourceFolder}`)
  process.exit(1)
}

const parsedFiles = files.map((fileName) => ({
  fileName,
  catalogNumber: extractCatalogNumber(fileName),
}))
const catalogs = [...new Set(parsedFiles.map((item) => item.catalogNumber).filter(Boolean))]
const productMap = await loadProductsByCatalog(supabase, catalogs)

let uploaded = 0
let matched = 0
let published = 0
const failures = []
const skipped = []
const batches = []
const effectiveBatchSize = batchSize || files.length
const fileChunks = chunkArray(parsedFiles, effectiveBatchSize)

for (const [chunkIndex, chunk] of fileChunks.entries()) {
  const { data: batch, error: batchError } = await supabase
    .from('product_document_batches')
    .insert({
      title:
        `${documentType === 'coa' ? 'COA' : '说明书'}本地目录导入 ` +
        `${chunk.length} 个文件（第 ${chunkIndex + 1}/${fileChunks.length} 批）`,
      document_type: documentType,
      status: 'reviewing',
      note: `本地脚本导入目录：${sourceFolder}\n批次大小：${effectiveBatchSize}`,
    })
    .select('id')
    .single()

  if (batchError || !batch?.id) {
    const message = batchError?.message || 'Failed to create batch'
    failures.push(`第 ${chunkIndex + 1} 批：${message}`)
    console.error(message)
    continue
  }

  batches.push(batch.id)
  let chunkFailures = 0
  let chunkUploaded = 0

  console.log(`\nBatch ${chunkIndex + 1}/${fileChunks.length}: ${batch.id}`)

  const chunkProductIds = chunk
    .map((item) => productMap.get(item.catalogNumber)?.id)
    .filter(Boolean)
  const activeDocumentMap = await loadActiveDocuments(supabase, chunkProductIds, documentType)

  for (const item of chunk) {
    const filePath = path.join(sourceFolder, item.fileName)
    try {
      if (!item.catalogNumber) throw new Error('文件名未识别到货号')
      const product = productMap.get(item.catalogNumber)
      if (!product) throw new Error(`未找到 active 产品货号 ${item.catalogNumber}`)

      const existingActive = activeDocumentMap.get(product.id)
      if (existingActive) {
        skipped.push(`${item.fileName}: 前台已有 active 说明书 ${existingActive.file_name || existingActive.id}`)
        console.log(`- ${item.fileName} skipped: active document already exists`)
        continue
      }

      await archiveInactiveConflicts(supabase, product.id, documentType, item.catalogNumber)

      const fileBuffer = readFileSync(filePath)
      if (fileBuffer.length === 0) throw new Error('文件内容为空')

      const storageName = buildStorageName(documentType, item.catalogNumber)
      const storagePath = `product-documents/${documentType}/${storageName}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-assets')
        .upload(storagePath, fileBuffer, {
          cacheControl: '3600',
          contentType: 'application/pdf',
          upsert: false,
        })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('product-assets').getPublicUrl(uploadData.path)
      const status = publish ? 'active' : 'pending'
      const insertPayload = {
        product_id: product.id,
        batch_id: batch.id,
        document_type: documentType,
        document_key: item.catalogNumber,
        catalog_number: item.catalogNumber,
        batch_number: null,
        normalized_file_key: item.catalogNumber,
        file_url: urlData.publicUrl,
        file_name: item.fileName,
        source_type: 'local_folder_import',
        match_method: 'exact_catalog',
        match_reason: `本地目录导入，按货号 ${item.catalogNumber} 精确匹配`,
        match_score: 120,
        upload_status: 'uploaded',
        parse_status: 'parsed',
        match_status: 'matched',
        publish_status: publish ? 'active' : 'ready',
        storage_status: 'active',
        failure_reason: null,
        status,
        workflow_updated_at: new Date().toISOString(),
      }

      const { error: insertError } = await supabase.from('product_documents').insert(insertPayload)
      if (insertError) throw insertError

      uploaded += 1
      matched += 1
      chunkUploaded += 1
      if (publish) published += 1
      console.log(`✓ ${item.fileName} -> ${item.catalogNumber}`)
    } catch (err) {
      chunkFailures += 1
      failures.push(`${item.fileName}: ${err instanceof Error ? err.message : String(err)}`)
      console.error(`✗ ${item.fileName}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (publish && chunkFailures === 0) {
    await supabase.from('product_document_batches').update({ status: 'completed' }).eq('id', batch.id)
  } else {
    await supabase
      .from('product_document_batches')
      .update({
        status: chunkUploaded > 0 ? 'reviewing' : 'failed',
        note:
          `本地脚本导入目录：${sourceFolder}\n` +
          `批次大小：${effectiveBatchSize}\n` +
          `本批成功：${chunkUploaded}，失败：${chunkFailures}`,
      })
      .eq('id', batch.id)
  }
}

console.log('\nImport summary')
console.log(`Batches: ${batches.join(', ')}`)
console.log(`Folder: ${sourceFolder}`)
console.log(`Batch size: ${effectiveBatchSize}`)
console.log(`Uploaded: ${uploaded}`)
console.log(`Matched: ${matched}`)
console.log(`Published: ${published}`)
console.log(`Skipped: ${skipped.length}`)
console.log(`Failed: ${failures.length}`)
if (skipped.length > 0) {
  console.log('\nSkipped')
  console.log(skipped.join('\n'))
}
if (failures.length > 0) {
  console.log('\nFailures')
  console.log(failures.join('\n'))
  process.exitCode = 1
}

if (report || failures.length > 0) {
  const reportPath = path.join(sourceFolder, `product-document-import-report-${getTimestamp()}.md`)
  const lines = [
    '# 产品说明书导入报告',
    '',
    `- 时间：${new Date().toISOString()}`,
    `- 文件夹：${sourceFolder}`,
    `- 文档类型：${documentType}`,
    `- 自动上架：${publish ? '是' : '否'}`,
    `- 批次大小：${effectiveBatchSize}`,
    `- 批次 ID：${batches.join(', ') || '-'}`,
    `- PDF 总数：${files.length}`,
    `- 上传成功：${uploaded}`,
    `- 货号匹配：${matched}`,
    `- 已上架：${published}`,
    `- 跳过：${skipped.length}`,
    `- 失败：${failures.length}`,
    '',
    '## 跳过文件',
    '',
    skipped.length > 0 ? skipped.map((line) => `- ${line}`).join('\n') : '无',
    '',
    '## 失败文件',
    '',
    failures.length > 0 ? failures.map((line) => `- ${line}`).join('\n') : '无',
    '',
  ]
  writeFileSync(reportPath, lines.join('\n'), 'utf8')
  console.log(`\nReport: ${reportPath}`)
}
