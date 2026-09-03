import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { parseProductDocumentFileName } from '@/lib/products/document-naming'
import { normalizeElisaCatalogNumber } from '@/lib/products/catalog'

type ProductRow = {
  id: string
  name: string
  target: string | null
  catalog_number: string | null
  cat_no: string | null
  status?: string | null
}

type DocumentRow = {
  id: string
  batch_id?: string | null
  file_url: string
  file_name: string | null
  document_type: 'datasheet' | 'coa'
  document_key?: string | null
  catalog_number?: string | null
  batch_number?: string | null
}

type ExistingDocumentRow = {
  id: string
  file_url: string
  document_key: string | null
  status: string
  review_note?: string | null
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isMissingNamingColumns(message?: string) {
  return Boolean(
    message &&
      (message.includes('catalog_number') ||
        message.includes('batch_number') ||
        message.includes('batch_id') ||
        message.includes('match_method') ||
        message.includes('upload_status') ||
        message.includes('parse_status') ||
        message.includes('match_status') ||
        message.includes('publish_status') ||
        message.includes('storage_status') ||
        message.includes('failure_reason') ||
        message.includes('workflow_updated_at') ||
        message.includes('schema cache'))
  )
}

function normalizeTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function calculateMatchScore(docName: string, product: ProductRow) {
  const tokens = normalizeTokens(docName)
  const catalog = clean(product.catalog_number || product.cat_no).toLowerCase()
  const nameTokens = normalizeTokens(product.name)
  const targetTokens = normalizeTokens(product.target || '')

  let score = 0
  if (catalog && docName.toLowerCase().includes(catalog)) score += 100
  for (const token of nameTokens.slice(0, 5)) {
    if (tokens.includes(token)) score += 12
  }
  for (const token of targetTokens.slice(0, 5)) {
    if (tokens.includes(token)) score += 8
  }
  if (tokens.some((token) => token.includes('datasheet') || token.includes('protocol'))) score += 10
  if (tokens.some((token) => token.includes('coa'))) score += 10
  return score
}

function findExactProductByCatalog(products: ProductRow[], catalogNumber: string) {
  const normalized = normalizeElisaCatalogNumber(catalogNumber).toLowerCase()
  if (!normalized) return null
  return (
    products.find((product) => {
      const catalog = normalizeElisaCatalogNumber(clean(product.catalog_number || product.cat_no)).toLowerCase()
      return catalog === normalized
    }) || null
  )
}

function getCatalogKey(value: unknown) {
  return normalizeElisaCatalogNumber(clean(value)).toLowerCase()
}

function getProductAssetStoragePath(fileUrl: string) {
  try {
    const url = new URL(fileUrl)
    const marker = '/product-assets/'
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex === -1) return ''
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
  } catch {
    const marker = '/product-assets/'
    const markerIndex = fileUrl.indexOf(marker)
    if (markerIndex === -1) return ''
    return decodeURIComponent(fileUrl.slice(markerIndex + marker.length).split('?')[0] || '')
  }
}

async function removeUploadedFile(
  supabase: SupabaseClient,
  fileUrl: string
) {
  const storagePath = getProductAssetStoragePath(fileUrl)
  if (!storagePath) return null
  const { error } = await supabase.storage.from('product-assets').remove([storagePath])
  return error
}

async function updateDocumentWithWorkflow(
  supabase: SupabaseClient,
  id: string,
  payload: Record<string, unknown>,
  fallbackPayload: Record<string, unknown>
) {
  const { error } = await supabase
    .from('product_documents')
    .update({
      ...payload,
      workflow_updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error && isMissingNamingColumns(error.message)) {
    const { error: fallbackError } = await supabase
      .from('product_documents')
      .update(fallbackPayload)
      .eq('id', id)
    return fallbackError
  }

  return error
}

async function productAssetFileExists(supabase: SupabaseClient, fileUrl: string) {
  const storagePath = getProductAssetStoragePath(fileUrl)
  if (!storagePath) return false
  const slashIndex = storagePath.lastIndexOf('/')
  const folder = slashIndex >= 0 ? storagePath.slice(0, slashIndex) : ''
  const name = slashIndex >= 0 ? storagePath.slice(slashIndex + 1) : storagePath
  const { data, error } = await supabase.storage.from('product-assets').list(folder, {
    limit: 20,
    search: name,
  })
  if (error) return false
  return Boolean((data || []).some((item) => item.name === name))
}

async function loadActiveProductDocument(
  supabase: SupabaseClient,
  productId: string,
  documentType: 'datasheet' | 'coa',
  batchNumber: string | null
) {
  let query = supabase
    .from('product_documents')
    .select('id, file_url, document_key, status, review_note')
    .eq('product_id', productId)
    .eq('document_type', documentType)
    .eq('status', 'active')
    .limit(1)

  if (documentType === 'coa') {
    query = batchNumber ? query.eq('batch_number', batchNumber) : query.is('batch_number', null)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data as ExistingDocumentRow | null
}

async function archiveUploadedDuplicate(
  supabase: SupabaseClient,
  document: DocumentRow,
  reason: string
) {
  const removeError = await removeUploadedFile(supabase, document.file_url)
  const reviewNote = removeError
    ? `前台已有可用说明书，本次重复上传文件删除失败：${removeError.message}`
    : '前台已有可用说明书，本次重复上传副本已从存储删除。'

  const error = await updateDocumentWithWorkflow(
    supabase,
    document.id,
    {
      status: 'archived',
      match_status: 'duplicate',
      publish_status: 'archived',
      storage_status: removeError ? 'active' : 'deleted',
      failure_reason: reviewNote,
      review_note: reviewNote,
      match_reason: `${reason}；前台已有可用说明书，本次重复上传已自动隐藏。`,
    },
    {
      status: 'archived',
      review_note: reviewNote,
      match_reason: `${reason}；前台已有可用说明书，本次重复上传已自动隐藏。`,
    }
  )

  return error || removeError
}

async function releaseInactiveDocumentKeyConflicts(
  supabase: SupabaseClient,
  documentId: string,
  productId: string,
  documentType: 'datasheet' | 'coa',
  documentKey: string
) {
  if (!documentKey) return

  const { data, error } = await supabase
    .from('product_documents')
    .select('id, document_key, status, review_note')
    .eq('product_id', productId)
    .eq('document_type', documentType)
    .eq('document_key', documentKey)
    .neq('id', documentId)

  if (error) throw error

  for (const conflict of data || []) {
    if (conflict.status === 'active') continue
    const suffix = String(conflict.id).slice(0, 8)
    const updateError = await updateDocumentWithWorkflow(
      supabase,
      conflict.id,
      {
        document_key: `${documentKey}__old__${suffix}`,
        review_note: [
          clean(conflict.review_note),
          '旧撤回记录释放唯一键，允许同货号说明书重新上传。',
        ].filter(Boolean).join('；'),
      },
      {
        document_key: `${documentKey}__old__${suffix}`,
        review_note: [
          clean(conflict.review_note),
          '旧撤回记录释放唯一键，允许同货号说明书重新上传。',
        ].filter(Boolean).join('；'),
      }
    )
    if (updateError) throw updateError
  }
}

async function rejectDocumentFile(
  supabase: SupabaseClient,
  document: DocumentRow,
  reason: string
) {
  const removeError = await removeUploadedFile(supabase, document.file_url)
  const reviewNote = removeError
    ? `${reason} 文件删除失败：${removeError.message}`
    : `${reason} 文件已从存储删除，请修正后重新上传。`

  const error = await updateDocumentWithWorkflow(
    supabase,
    document.id,
    {
      product_id: null,
      match_reason: reason,
      match_score: null,
      match_method: 'none',
      review_note: reviewNote,
      parse_status: reason.includes('文件名') ? 'failed' : 'parsed',
      match_status: 'failed',
      publish_status: 'draft',
      storage_status: removeError ? 'active' : 'deleted',
      failure_reason: reviewNote,
      status: 'pending',
    },
    {
      product_id: null,
      match_reason: reason,
      match_score: null,
      match_method: 'none',
      review_note: reviewNote,
      status: 'pending',
    }
  )

  return error || removeError
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: '缺少 Supabase 服务端配置' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const body = await request.json().catch(() => ({} as { documentType?: 'datasheet' | 'coa'; limit?: number; batchId?: string; includeArchived?: boolean }))
  const documentType = body.documentType || 'datasheet'
  const limit = Math.min(Math.max(Number(body.limit || 5000), 1), 20000)
  const batchId = clean(body.batchId)
  const includeArchived = body.includeArchived === true

  const baseDocumentSelect = 'id, file_url, file_name, document_type'
  const extendedDocumentSelect = `${baseDocumentSelect}, batch_id, document_key, catalog_number, batch_number`

  let documentQuery = supabase
    .from('product_documents')
    .select(extendedDocumentSelect)
    .eq('document_type', documentType)
  documentQuery = includeArchived
    ? documentQuery.in('status', ['pending', 'archived'])
    : documentQuery.eq('status', 'pending')
  if (batchId) documentQuery = documentQuery.eq('batch_id', batchId)
  const documentResult = await documentQuery
  let documents = documentResult.data as DocumentRow[] | null
  let documentError = documentResult.error

  if (documentError && isMissingNamingColumns(documentError.message)) {
    let fallbackQuery = supabase
      .from('product_documents')
      .select(baseDocumentSelect)
      .eq('document_type', documentType)
    fallbackQuery = includeArchived
      ? fallbackQuery.in('status', ['pending', 'archived'])
      : fallbackQuery.eq('status', 'pending')
    if (batchId) fallbackQuery = fallbackQuery.eq('batch_id', batchId)
    const fallback = await fallbackQuery
    documents = fallback.data as DocumentRow[] | null
    documentError = fallback.error
  }

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 500 })
  }

  const parsedDocuments = ((documents || []) as DocumentRow[]).map((document) => {
    const fileName = document.file_name || document.file_url.split('/').pop() || ''
    const parsedName = parseProductDocumentFileName(fileName, document.document_type)
    return {
      document,
      fileName,
      parsedName,
      catalogNumber: clean(document.catalog_number) || parsedName.catalogNumber,
      batchNumber: clean(document.batch_number) || parsedName.batchNumber,
      documentKey: clean(document.document_key) || parsedName.documentKey,
    }
  })

  const catalogNumbers = [
    ...new Set(parsedDocuments.map((item) => normalizeElisaCatalogNumber(item.catalogNumber)).filter(Boolean)),
  ]
  let exactProducts: ProductRow[] = []
  if (catalogNumbers.length > 0) {
    const quotedCatalogs = catalogNumbers.map((catalog) => `"${catalog.replace(/"/g, '')}"`).join(',')
    const { data: exactRows, error: exactError } = await supabase
      .from('products')
      .select('id, name, target, catalog_number, cat_no, status')
      .eq('status', 'active')
      .or(`catalog_number.in.(${quotedCatalogs}),cat_no.in.(${quotedCatalogs})`)

    if (exactError) {
      return NextResponse.json({ error: exactError.message }, { status: 500 })
    }
    exactProducts = (exactRows || []) as ProductRow[]
  }

  const exactProductMap = new Map<string, ProductRow>()
  for (const product of exactProducts) {
    const catalogKey = getCatalogKey(product.catalog_number || product.cat_no)
    if (catalogKey && !exactProductMap.has(catalogKey)) exactProductMap.set(catalogKey, product)
  }

  const needsSimilarity = parsedDocuments.some((item) => !exactProductMap.get(getCatalogKey(item.catalogNumber)))
  let productsForSimilarity: ProductRow[] = exactProducts
  if (needsSimilarity) {
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, target, catalog_number, cat_no, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (productError) {
      return NextResponse.json({ error: productError.message }, { status: 500 })
    }
    productsForSimilarity = (products || []) as ProductRow[]
  }

  const matches: Array<{
    document: string
    productId: string
    score: number
    reason: string
  }> = []
  const duplicateArchived: string[] = []
  const failures: Array<{ document: string; reason: string }> = []

  for (const { document, fileName, catalogNumber, batchNumber, documentKey } of parsedDocuments) {
    let best: { product: ProductRow; score: number } | null = null
    let reason = ''
    let matchMethod: 'exact_catalog' | 'name_similarity' = 'name_similarity'

    const exactProduct =
      exactProductMap.get(getCatalogKey(catalogNumber)) ||
      findExactProductByCatalog(productsForSimilarity, catalogNumber)
    if (exactProduct) {
      best = { product: exactProduct, score: 120 }
      matchMethod = 'exact_catalog'
      reason =
        document.document_type === 'coa' && batchNumber
          ? `按货号 ${catalogNumber} + 批次 ${batchNumber} 精确匹配`
          : `按货号 ${catalogNumber} 精确匹配`
    } else if (catalogNumber) {
      const missingReason = `未找到货号 ${catalogNumber} 对应的 active 产品，请先确认产品是否已导入或货号是否正确。`
      const missingCatalogError = await rejectDocumentFile(supabase, document, missingReason)
      if (missingCatalogError) {
        failures.push({ document: document.file_url, reason: missingCatalogError.message })
      }
      continue
    } else {
      for (const product of productsForSimilarity) {
        const score = calculateMatchScore(fileName, product)
        if (!best || score > best.score) {
          best = { product, score }
        }
      }
      reason = `按文件名 ${fileName} 匹配到 ${clean(best?.product.catalog_number || best?.product.cat_no) || best?.product.name || ''}`
    }

    if (best && best.score >= 25) {
      const matchedRecord = {
        document: document.file_url,
        productId: best.product.id,
        score: best.score,
        reason,
      }

      try {
        const activeDocument = await loadActiveProductDocument(
          supabase,
          best.product.id,
          document.document_type,
          document.document_type === 'coa' ? batchNumber : null
        )
        if (activeDocument) {
          const activeFileExists = await productAssetFileExists(supabase, activeDocument.file_url)
          if (activeFileExists) {
            const archiveDuplicateError = await archiveUploadedDuplicate(supabase, document, reason)
            if (archiveDuplicateError) {
              failures.push({ document: document.file_url, reason: archiveDuplicateError.message })
            } else {
              duplicateArchived.push(document.file_url)
            }
            continue
          }

          const archiveBrokenError = await updateDocumentWithWorkflow(
            supabase,
            activeDocument.id,
            {
              status: 'archived',
              publish_status: 'archived',
              storage_status: 'missing',
              failure_reason: '原已生效说明书的存储文件不存在，已自动下架；本次上传可重新匹配后上架。',
              review_note: '原已生效说明书的存储文件不存在，已自动下架；本次上传可重新匹配后上架。',
            },
            {
              status: 'archived',
              review_note: '原已生效说明书的存储文件不存在，已自动下架；本次上传可重新匹配后上架。',
            }
          )
          if (archiveBrokenError) throw archiveBrokenError
        }

        await releaseInactiveDocumentKeyConflicts(
          supabase,
          document.id,
          best.product.id,
          document.document_type,
          documentKey
        )
      } catch (err: unknown) {
        failures.push({ document: document.file_url, reason: err instanceof Error ? err.message : '重复记录校验失败' })
        continue
      }

      const updatePayload = {
        product_id: best.product.id,
        document_key: documentKey,
        catalog_number: catalogNumber || clean(best.product.catalog_number || best.product.cat_no),
        batch_number: document.document_type === 'coa' ? batchNumber : null,
        match_reason: `${reason}，待管理员确认后生效`,
        match_score: best.score,
        match_method: matchMethod,
        parse_status: 'parsed',
        match_status: 'matched',
        publish_status: 'ready',
        storage_status: 'active',
        failure_reason: null,
        workflow_updated_at: new Date().toISOString(),
        status: 'pending',
      }

      const { error: updateError } = await supabase
        .from('product_documents')
        .update(updatePayload)
        .eq('id', document.id)

      if (updateError && isMissingNamingColumns(updateError.message)) {
        const { error: fallbackUpdateError } = await supabase
          .from('product_documents')
          .update({
            product_id: best.product.id,
            match_reason: `${reason}，待管理员确认后生效`,
            match_score: best.score,
            status: 'pending',
          })
          .eq('id', document.id)
        if (fallbackUpdateError) {
          failures.push({ document: document.file_url, reason: fallbackUpdateError.message })
        } else {
          matches.push(matchedRecord)
        }
      } else if (
        updateError &&
        (updateError.code === '23505' || updateError.message.toLowerCase().includes('duplicate key'))
      ) {
        const archiveDuplicateError = await archiveUploadedDuplicate(supabase, document, reason)
        if (archiveDuplicateError) {
          failures.push({ document: document.file_url, reason: archiveDuplicateError.message })
        } else {
          duplicateArchived.push(document.file_url)
        }
      } else if (updateError) {
        failures.push({ document: document.file_url, reason: updateError.message })
      } else {
        matches.push(matchedRecord)
      }
    } else if (!best || best.score < 25) {
      const weakReason = catalogNumber
        ? `未找到货号 ${catalogNumber} 对应的 active 产品，请先确认产品是否已导入或货号是否正确。`
        : `文件名 ${fileName} 未能识别到可靠货号，请按“货号-Product name.pdf”重新命名后上传。`
      const weakMatchError = await rejectDocumentFile(supabase, document, weakReason)
      if (weakMatchError) {
        failures.push({ document: document.file_url, reason: weakMatchError.message })
      }
    }
  }

  return NextResponse.json({
    matched: matches.length,
    duplicateArchived: duplicateArchived.length,
    failed: failures.length,
    matches,
    failures,
  })
}
