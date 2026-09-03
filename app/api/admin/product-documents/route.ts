import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildProductDocumentStorageName,
  getProductDocumentNamingHint,
  parseProductDocumentFileName,
} from '@/lib/products/document-naming'

type DocumentType = 'datasheet' | 'coa'

type ProductDocumentListRow = {
  id: string
  product_id: string | null
  product?: {
    id: string
    name: string
    target: string | null
    catalog_number: string | null
    cat_no: string | null
  } | null
  document_type: DocumentType
  batch_id?: string | null
  catalog_number?: string | null
  batch_number?: string | null
  normalized_file_key?: string | null
  match_method?: string | null
  review_note?: string | null
  upload_status?: string | null
  parse_status?: string | null
  match_status?: string | null
  publish_status?: string | null
  storage_status?: string | null
  failure_reason?: string | null
  file_url: string
  file_name: string | null
  match_reason: string | null
  match_score: number | null
  source_type: string
  status: string
  created_at: string
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDocumentType(value: unknown): DocumentType {
  return value === 'coa' ? 'coa' : 'datasheet'
}

function isMissingNamingColumns(message?: string) {
  return Boolean(
    message &&
      (message.includes('catalog_number') ||
        message.includes('batch_number') ||
        message.includes('normalized_file_key') ||
        message.includes('batch_id') ||
        message.includes('match_method') ||
        message.includes('review_note') ||
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

function isMissingWorkflowOnly(message?: string) {
  if (!message) return false
  const mentionsWorkflow =
    message.includes('upload_status') ||
    message.includes('parse_status') ||
    message.includes('match_status') ||
    message.includes('publish_status') ||
    message.includes('storage_status') ||
    message.includes('failure_reason') ||
    message.includes('workflow_updated_at')
  const mentionsLegacy =
    message.includes('catalog_number') ||
    message.includes('batch_number') ||
    message.includes('normalized_file_key') ||
    message.includes('batch_id') ||
    message.includes('match_method') ||
    message.includes('review_note')
  return mentionsWorkflow && !mentionsLegacy
}

function isDeletedNeedsRetry(doc: Pick<ProductDocumentListRow, 'review_note' | 'match_reason' | 'failure_reason' | 'storage_status'>) {
  if (doc.storage_status === 'deleted' || doc.storage_status === 'missing') return true
  const note = `${doc.review_note || ''} ${doc.match_reason || ''} ${doc.failure_reason || ''}`
  return (
    (note.includes('文件已从存储删除') ||
      note.includes('存储删除') ||
      note.includes('删除存储文件') ||
      note.includes('不能上架或恢复') ||
      note.includes('PDF 文件不存在')) &&
    !note.includes('前台已有可用')
  )
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

async function removeDocumentFile(supabase: ReturnType<typeof createAdminClient>, fileUrl: string) {
  const storagePath = getProductAssetStoragePath(fileUrl)
  if (!storagePath) return null
  const { error } = await supabase.storage.from('product-assets').remove([storagePath])
  return error
}

async function productAssetFileExists(
  supabase: ReturnType<typeof createAdminClient>,
  fileUrl?: string | null
) {
  const storagePath = getProductAssetStoragePath(clean(fileUrl))
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

async function attachProducts(
  supabase: ReturnType<typeof createAdminClient>,
  documents: ProductDocumentListRow[]
) {
  const productIds = [...new Set(documents.map((doc) => doc.product_id).filter(Boolean))] as string[]
  if (productIds.length === 0) return documents

  const { data: products } = await supabase
    .from('products')
    .select('id, name, target, catalog_number, cat_no')
    .in('id', productIds)

  const productMap = new Map((products || []).map((product) => [product.id, product]))
  return documents.map((doc) => ({
    ...doc,
    product: doc.product_id ? productMap.get(doc.product_id) || null : null,
  }))
}

async function updateDocumentWithWorkflow(
  supabase: ReturnType<typeof createAdminClient>,
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

async function archiveActiveDocuments(
  supabase: ReturnType<typeof createAdminClient>,
  filter: (query: any) => any
) {
  const query = filter(
    supabase.from('product_documents').update({
      status: 'archived',
      publish_status: 'archived',
      workflow_updated_at: new Date().toISOString(),
    })
  )
  const { error } = await query
  if (error && isMissingNamingColumns(error.message)) {
    const fallbackQuery = filter(supabase.from('product_documents').update({ status: 'archived' }))
    const { error: fallbackError } = await fallbackQuery
    return fallbackError
  }
  return error
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'
  const documentType = searchParams.get('type')
  const batchId = clean(searchParams.get('batch_id'))

  const baseSelect = 'id, product_id, document_type, file_url, file_name, match_reason, match_score, source_type, status, created_at'
  const extendedSelect = `${baseSelect}, batch_id, catalog_number, batch_number, normalized_file_key, match_method, review_note, upload_status, parse_status, match_status, publish_status, storage_status, failure_reason`

  let query = supabase
    .from('product_documents')
    .select(extendedSelect)
    .order('created_at', { ascending: false })
    .limit(batchId ? 500 : 100)

  if (status === 'unmatched') {
    query = query.eq('status', 'pending').is('product_id', null)
  } else if (status && status !== 'all' && status !== 'retry') {
    query = query.eq('status', status)
  }
  if (documentType === 'datasheet' || documentType === 'coa') {
    query = query.eq('document_type', documentType)
  }
  if (batchId) query = query.eq('batch_id', batchId)

  const result = await query
  let data = result.data as ProductDocumentListRow[] | null
  let error = result.error
  if (error && isMissingNamingColumns(error.message)) {
    let fallbackQuery = supabase
      .from('product_documents')
      .select(baseSelect)
      .order('created_at', { ascending: false })
      .limit(batchId ? 500 : 100)

    if (status === 'unmatched') {
      fallbackQuery = fallbackQuery.eq('status', 'pending').is('product_id', null)
    } else if (status && status !== 'all' && status !== 'retry') {
      fallbackQuery = fallbackQuery.eq('status', status)
    }
    if (documentType === 'datasheet' || documentType === 'coa') {
      fallbackQuery = fallbackQuery.eq('document_type', documentType)
    }
    if (batchId) fallbackQuery = fallbackQuery.eq('batch_id', batchId)

    const fallback = await fallbackQuery
    data = fallback.data as ProductDocumentListRow[] | null
    error = fallback.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const filteredData = status === 'retry'
    ? (data || []).filter((doc) => isDeletedNeedsRetry(doc))
    : (data || [])
  const documentsWithProducts = await attachProducts(supabase, filteredData)
  return NextResponse.json({ documents: documentsWithProducts })
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: '缺少 Supabase 服务端配置' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (err: unknown) {
    console.error('Product document upload form-data parse failed', err)
    return NextResponse.json(
      {
        error: '上传请求没有完整到达服务器，请单独重传该文件；如果连续出现，请减少单次选择的文件数量后重试。',
        code: 'UPLOAD_BODY_PARSE_FAILED',
      },
      { status: 408 }
    )
  }
  const file = formData.get('file')
  const documentType = normalizeDocumentType(formData.get('document_type'))
  const productId = clean(formData.get('product_id'))
  const batchId = clean(formData.get('batch_id'))

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少 PDF 文件' }, { status: 400 })
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: '仅支持 PDF 文件' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'PDF 不能超过 20MB' }, { status: 400 })
  }

  const parsedName = parseProductDocumentFileName(file.name, documentType)
  if (!parsedName.catalogNumber || (documentType === 'coa' && !parsedName.batchNumber)) {
    return NextResponse.json(
      {
        error: parsedName.warnings[0] || getProductDocumentNamingHint(documentType),
        warnings: parsedName.warnings,
      },
      { status: 400 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const bucket = 'product-assets'
  const safeName = buildProductDocumentStorageName(parsedName, crypto.randomUUID().slice(0, 8))
  const path = `product-documents/${documentType}/${safeName}`

  const { data: uploadData, error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message || '上传失败' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path)

  const insertPayload = {
    product_id: productId || null,
    batch_id: batchId || null,
    document_type: documentType,
    document_key: parsedName.documentKey || safeName.replace(/\.pdf$/i, ''),
    catalog_number: parsedName.catalogNumber,
    batch_number: parsedName.batchNumber,
    normalized_file_key: parsedName.documentKey,
    file_url: urlData.publicUrl,
    file_name: file.name,
    source_type: 'manual_upload',
    match_method: productId ? 'manual' : 'none',
    match_reason: parsedName.warnings.length > 0 ? parsedName.warnings.join('；') : null,
    upload_status: 'uploaded',
    parse_status: parsedName.catalogNumber ? 'parsed' : 'failed',
    match_status: productId ? 'matched' : 'unmatched',
    publish_status: productId ? 'ready' : 'draft',
    storage_status: 'active',
    failure_reason: parsedName.warnings.length > 0 ? parsedName.warnings.join('；') : null,
    workflow_updated_at: new Date().toISOString(),
    status: 'pending',
  }

  let { data: doc, error: insertError } = await supabase
    .from('product_documents')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertError && isMissingNamingColumns(insertError.message)) {
    const workflowFallbackPayload = {
      product_id: productId || null,
      batch_id: batchId || null,
      document_type: documentType,
      document_key: parsedName.documentKey || safeName.replace(/\.pdf$/i, ''),
      catalog_number: parsedName.catalogNumber,
      batch_number: parsedName.batchNumber,
      normalized_file_key: parsedName.documentKey,
      file_url: urlData.publicUrl,
      file_name: file.name,
      source_type: 'manual_upload',
      match_method: productId ? 'manual' : 'none',
      match_reason: parsedName.warnings.length > 0 ? parsedName.warnings.join('；') : null,
      status: 'pending',
    }
    const legacyFallbackPayload = {
      product_id: productId || null,
      document_type: documentType,
      document_key: parsedName.documentKey || safeName.replace(/\.pdf$/i, ''),
      file_url: urlData.publicUrl,
      file_name: file.name,
      source_type: 'manual_upload',
      match_reason: parsedName.warnings.length > 0 ? parsedName.warnings.join('；') : null,
      status: 'pending',
    }
    const fallbackPayload = isMissingWorkflowOnly(insertError.message)
      ? workflowFallbackPayload
      : legacyFallbackPayload
    const fallback = await supabase
      .from('product_documents')
      .insert(fallbackPayload)
      .select('id')
      .single()
    doc = fallback.data
    insertError = fallback.error
  }

  if (insertError) {
    return NextResponse.json({ error: insertError.message || '文档记录创建失败' }, { status: 500 })
  }
  if (!doc) {
    return NextResponse.json({ error: '文档记录创建失败' }, { status: 500 })
  }

  return NextResponse.json({
    id: doc.id,
    file_url: urlData.publicUrl,
    file_name: file.name,
    document_type: documentType,
    catalog_number: parsedName.catalogNumber,
    batch_number: parsedName.batchNumber,
    document_key: parsedName.documentKey,
    batch_id: batchId || null,
    warnings: parsedName.warnings,
    status: 'pending',
  })
}

export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const body = (await request.json().catch(() => ({}))) as {
    id?: string
    action?: 'confirm' | 'reset' | 'archive' | 'reopen'
  }
  const id = clean(body.id)
  const action = body.action

  if (!id || !action) {
    return NextResponse.json({ error: '缺少文档 ID 或操作类型' }, { status: 400 })
  }

  const { data: document, error: loadError } = await supabase
    .from('product_documents')
    .select('id, product_id, document_type, batch_number, file_url, match_reason, review_note')
    .eq('id', id)
    .maybeSingle()

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 })
  }
  if (!document) {
    return NextResponse.json({ error: '文档不存在' }, { status: 404 })
  }

  if (action === 'archive') {
    const removeError = await removeDocumentFile(supabase, document.file_url)
    const reviewNote = removeError
      ? `管理员撤回文件，存储文件删除失败：${removeError.message}`
      : '管理员撤回文件，已从存储删除；如需上架请重新上传。'
    const error = await updateDocumentWithWorkflow(
      supabase,
      id,
      {
        status: 'archived',
        review_note: reviewNote,
        publish_status: 'archived',
        storage_status: removeError ? 'active' : 'deleted',
        failure_reason: reviewNote,
      },
      { status: 'archived', review_note: reviewNote }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: reviewNote })
  }

  if (action === 'reopen') {
    const reviewNote = String(document.review_note || '')
    if (reviewNote.includes('存储删除') || reviewNote.includes('PDF 文件不存在')) {
      return NextResponse.json({ error: '这条记录的 PDF 已经从存储删除，不能恢复；请重新上传文件。' }, { status: 400 })
    }
    const error = await updateDocumentWithWorkflow(
      supabase,
      id,
      {
        status: 'pending',
        publish_status: document.product_id ? 'ready' : 'draft',
        storage_status: 'active',
        failure_reason: null,
      },
      { status: 'pending' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: '已恢复为待确认，可重新匹配或确认生效' })
  }

  if (action === 'reset') {
    const resetPayload = {
        product_id: null,
        match_reason: null,
        match_score: null,
        match_method: 'none',
        match_status: 'unmatched',
        publish_status: 'draft',
        failure_reason: null,
        status: 'pending',
    }
    const error = await updateDocumentWithWorkflow(
      supabase,
      id,
      resetPayload,
      {
        product_id: null,
        match_reason: null,
        match_score: null,
        match_method: 'none',
        status: 'pending',
      }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: '已撤回匹配' })
  }

  if (!document.product_id) {
    return NextResponse.json({ error: '该文件还没有匹配到商品，不能确认生效' }, { status: 400 })
  }

  const fileExists = await productAssetFileExists(supabase, document.file_url)
  if (!fileExists) {
    const reason = `上架前校验失败：PDF 文件不存在或已被删除，请重新上传。${document.file_url ? ` 文件：${document.file_url}` : ''}`
    const markError = await updateDocumentWithWorkflow(
      supabase,
      id,
      {
        status: 'archived',
        review_note: reason,
        publish_status: 'archived',
        storage_status: 'missing',
        failure_reason: reason,
      },
      { status: 'archived', review_note: reason }
    )
    if (markError) return NextResponse.json({ error: markError.message }, { status: 500 })
    return NextResponse.json({ error: reason }, { status: 400 })
  }

  if (document.document_type === 'datasheet') {
    const archiveOldError = await archiveActiveDocuments(
      supabase,
      (query: any) => query
        .eq('product_id', document.product_id)
        .eq('document_type', 'datasheet')
        .eq('status', 'active')
        .neq('id', id)
    )
    if (archiveOldError) {
      return NextResponse.json({ error: archiveOldError.message }, { status: 500 })
    }
  }

  if (document.document_type === 'coa' && document.batch_number) {
    const archiveOldError = await archiveActiveDocuments(
      supabase,
      (query: any) => query
        .eq('product_id', document.product_id)
        .eq('document_type', 'coa')
        .eq('batch_number', document.batch_number)
        .eq('status', 'active')
        .neq('id', id)
    )
    if (archiveOldError) {
      return NextResponse.json({ error: archiveOldError.message }, { status: 500 })
    }
  }

  const confirmError = await updateDocumentWithWorkflow(
    supabase,
    id,
    {
      status: 'active',
      match_status: 'matched',
      publish_status: 'active',
      storage_status: 'active',
      failure_reason: null,
      match_reason: document.match_reason
        ? document.match_reason.replace('待管理员确认后生效', '已确认上架，前台可见')
        : '已确认上架，前台可见',
    },
    {
      status: 'active',
      match_reason: document.match_reason
        ? document.match_reason.replace('待管理员确认后生效', '已确认上架，前台可见')
        : '已确认上架，前台可见',
    }
  )

  if (confirmError) {
    return NextResponse.json({ error: confirmError.message }, { status: 500 })
  }

  return NextResponse.json({ message: '已确认生效' })
}
