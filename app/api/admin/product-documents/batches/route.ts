import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type DocumentType = 'datasheet' | 'coa'

type BatchRow = {
  id: string
  title: string
  document_type: DocumentType
  status: string
  note: string | null
  created_at: string
  updated_at: string
}

type DocumentRow = {
  id: string
  batch_id: string | null
  product_id: string | null
  document_type: DocumentType
  catalog_number?: string | null
  batch_number: string | null
  file_url?: string | null
  status: string
  match_method: string | null
  match_reason?: string | null
  review_note?: string | null
  upload_status?: string | null
  parse_status?: string | null
  match_status?: string | null
  publish_status?: string | null
  storage_status?: string | null
  failure_reason?: string | null
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDocumentType(value: unknown): DocumentType {
  return value === 'coa' ? 'coa' : 'datasheet'
}

function isMissingBatchTable(message?: string) {
  return Boolean(
    message?.includes('product_document_batches') &&
      (message.includes('schema cache') || message.includes('does not exist'))
  )
}

function isMissingWorkflowColumns(message?: string) {
  return Boolean(
    message &&
      (message.includes('upload_status') ||
        message.includes('parse_status') ||
        message.includes('match_status') ||
        message.includes('publish_status') ||
        message.includes('storage_status') ||
        message.includes('failure_reason') ||
        message.includes('workflow_updated_at') ||
        message.includes('schema cache'))
  )
}

async function updateDocumentsWithWorkflow(
  supabase: ReturnType<typeof createAdminClient>,
  filter: (query: any) => any,
  payload: Record<string, unknown>,
  fallbackPayload: Record<string, unknown>
) {
  const query = filter(
    supabase.from('product_documents').update({
      ...payload,
      workflow_updated_at: new Date().toISOString(),
    })
  )
  const { error } = await query

  if (error && isMissingWorkflowColumns(error.message)) {
    const fallbackQuery = filter(supabase.from('product_documents').update(fallbackPayload))
    const { error: fallbackError } = await fallbackQuery
    return fallbackError
  }

  return error
}

function getRequestedTotal(batch: BatchRow) {
  const match = batch.title.match(/(\d+)\s*个文件/)
  return match ? Number(match[1]) || 0 : 0
}

function getUploadFailureCount(note?: string | null) {
  const text = clean(note)
  if (!text.includes('上传失败文件：')) return 0
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('上传失败文件：')).length
}

function getBatchAlertLevel(summary: {
  requested_total: number
  upload_failed: number
  filename_failed: number
  match_failed: number
  storage_deleted: number
}) {
  const total = summary.requested_total || 0
  if (total <= 0) return 'normal'
  const failed = summary.upload_failed + summary.filename_failed + summary.match_failed + summary.storage_deleted
  if (failed / total >= 0.2) return 'high_failure'
  if (failed > 0) return 'needs_attention'
  return 'normal'
}

function summarizeBatch(batch: BatchRow, documents: DocumentRow[]) {
  const batchDocuments = documents.filter((doc) => doc.batch_id === batch.id)
  const duplicateEffective = batchDocuments.filter(
    (doc) =>
      doc.status === 'archived' &&
      `${doc.review_note || ''} ${doc.match_reason || ''}`.includes('前台已有可用')
  ).length
  const deletedNeedsRetry = batchDocuments.filter(
    (doc) =>
      (`${doc.review_note || ''}`.includes('存储删除') ||
        `${doc.review_note || ''}`.includes('删除存储文件') ||
        `${doc.review_note || ''}`.includes('不能上架或恢复') ||
        `${doc.review_note || ''}`.includes('PDF 文件不存在')) &&
      !`${doc.review_note || ''} ${doc.match_reason || ''}`.includes('前台已有可用')
  ).length
  const requestedTotal = getRequestedTotal(batch) || batchDocuments.length
  const uploadFailed = getUploadFailureCount(batch.note)
  const pendingUnmatched = batchDocuments.filter((doc) =>
    doc.publish_status
      ? doc.publish_status === 'draft' && !doc.product_id
      : doc.status === 'pending' && !doc.product_id
  ).length
  const pendingReview = batchDocuments.filter((doc) =>
    doc.publish_status
      ? doc.publish_status === 'ready' && Boolean(doc.product_id)
      : doc.status === 'pending' && doc.product_id
  ).length
  const exactPending = batchDocuments.filter(
    (doc) =>
      (doc.publish_status ? doc.publish_status === 'ready' : doc.status === 'pending') &&
      doc.product_id &&
      doc.match_method === 'exact_catalog'
  ).length
  const active = batchDocuments.filter((doc) =>
    doc.publish_status ? doc.publish_status === 'active' : doc.status === 'active'
  ).length
  const archived = batchDocuments.filter((doc) =>
    doc.publish_status ? doc.publish_status === 'archived' : doc.status === 'archived'
  ).length
  const filenameFailed = batchDocuments.filter((doc) =>
    doc.parse_status ? doc.parse_status === 'failed' : `${doc.review_note || ''} ${doc.match_reason || ''}`.includes('文件名')
  ).length
  const matchedExact = batchDocuments.filter((doc) =>
    Boolean(
      doc.product_id &&
        doc.match_method === 'exact_catalog' &&
        (doc.publish_status ? doc.publish_status !== 'archived' : doc.status !== 'archived')
    )
  ).length
  const matchedManual = batchDocuments.filter((doc) =>
    Boolean(
      doc.product_id &&
        doc.match_method === 'manual' &&
        (doc.publish_status ? doc.publish_status !== 'archived' : doc.status !== 'archived')
    )
  ).length
  const storageDeleted = batchDocuments.filter((doc) =>
    doc.storage_status ? doc.storage_status === 'deleted' || doc.storage_status === 'missing' : false
  ).length || deletedNeedsRetry
  const matchFailed = Math.max(pendingUnmatched - filenameFailed, 0)
  const summary = {
    requested_total: requestedTotal,
    upload_success: batchDocuments.length,
    upload_failed: uploadFailed,
    filename_ok: batchDocuments.filter((doc) =>
      doc.parse_status ? doc.parse_status === 'parsed' : clean(doc.catalog_number)
    ).length,
    filename_failed: filenameFailed,
    matched_exact: matchedExact,
    matched_manual: matchedManual,
    match_failed: matchFailed,
    publish_ready: exactPending,
    published: active,
    frontend_verified: active,
    storage_deleted: storageDeleted,
    duplicate_effective: batchDocuments.filter((doc) => doc.match_status === 'duplicate').length || duplicateEffective,
  }

  return {
    ...batch,
    ...summary,
    alert_level: getBatchAlertLevel(summary),
    total: batchDocuments.length,
    pending_unmatched: pendingUnmatched,
    pending_review: pendingReview,
    exact_pending: exactPending,
    active,
    archived,
    duplicate_archived: batchDocuments.filter(
      (doc) =>
        doc.status === 'archived' &&
        `${doc.review_note || ''} ${doc.match_reason || ''}`.includes('重复')
    ).length,
    duplicate_effective: summary.duplicate_effective,
    deleted_needs_retry: storageDeleted,
  }
}

async function loadBatchDocuments(
  supabase: ReturnType<typeof createAdminClient>,
  batchIds: string[],
  selectColumns: string
) {
  const pageSize = 1000
  const rows: DocumentRow[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('product_documents')
      .select(selectColumns)
      .in('batch_id', batchIds)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) return { rows: [] as DocumentRow[], error }

    rows.push(...((data || []) as unknown as DocumentRow[]))
    if (!data || data.length < pageSize) break
  }

  return { rows, error: null }
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

async function removeDocumentFiles(
  supabase: ReturnType<typeof createAdminClient>,
  documents: DocumentRow[]
) {
  const paths = [
    ...new Set(
      documents
        .map((doc) => clean(doc.file_url))
        .map(getProductAssetStoragePath)
        .filter(Boolean)
    ),
  ]
  if (paths.length === 0) return { removed: 0, error: null as Error | null }
  const { error } = await supabase.storage.from('product-assets').remove(paths)
  return { removed: error ? 0 : paths.length, error: error as Error | null }
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

async function markDocumentNeedsRetry(
  supabase: ReturnType<typeof createAdminClient>,
  document: DocumentRow,
  reason: string
) {
  return updateDocumentsWithWorkflow(
    supabase,
    (query: any) => query.eq('id', document.id),
    {
      status: 'archived',
      review_note: reason,
      match_status: document.product_id ? 'matched' : 'failed',
      publish_status: 'archived',
      storage_status: 'missing',
      failure_reason: reason,
    },
    { status: 'archived', review_note: reason }
  )
}

async function confirmDocument(supabase: ReturnType<typeof createAdminClient>, document: DocumentRow) {
  if (!document.product_id) {
    return { confirmed: false, reason: '文件没有匹配到产品，不能上架。' }
  }

  const fileExists = await productAssetFileExists(supabase, document.file_url)
  if (!fileExists) {
    const reason = `上架前校验失败：PDF 文件不存在或已被删除，请重新上传。${document.file_url ? ` 文件：${document.file_url}` : ''}`
    const error = await markDocumentNeedsRetry(supabase, document, reason)
    if (error) throw error
    return { confirmed: false, reason }
  }

  if (document.document_type === 'datasheet') {
    const error = await updateDocumentsWithWorkflow(
      supabase,
      (query: any) => query
        .eq('product_id', document.product_id)
        .eq('document_type', 'datasheet')
        .eq('status', 'active')
        .neq('id', document.id),
      { status: 'archived', publish_status: 'archived' },
      { status: 'archived' }
    )
    if (error) throw error
  }

  if (document.document_type === 'coa' && document.batch_number) {
    const error = await updateDocumentsWithWorkflow(
      supabase,
      (query: any) => query
        .eq('product_id', document.product_id)
        .eq('document_type', 'coa')
        .eq('batch_number', document.batch_number)
        .eq('status', 'active')
        .neq('id', document.id),
      { status: 'archived', publish_status: 'archived' },
      { status: 'archived' }
    )
    if (error) throw error
  }

  const error = await updateDocumentsWithWorkflow(
    supabase,
    (query: any) => query.eq('id', document.id),
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
  if (error) throw error
  return { confirmed: true, reason: '' }
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const documentType = request.nextUrl.searchParams.get('type')
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || '20') || 20, 1), 50)

  let query = supabase
    .from('product_document_batches')
    .select('id, title, document_type, status, note, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (documentType === 'datasheet' || documentType === 'coa') {
    query = query.eq('document_type', documentType)
  }

  const { data: batches, error } = await query
  if (error) {
    if (isMissingBatchTable(error.message)) {
      return NextResponse.json({
        batches: [],
        needsSetup: true,
        error: '批次表尚未初始化，请先执行 supabase/migrations/042_product_document_batches.sql。',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const batchRows = (batches || []) as BatchRow[]
  const batchIds = batchRows.map((batch) => batch.id)
  let documents: DocumentRow[] = []

  if (batchIds.length > 0) {
    const extendedSelect = 'id, batch_id, product_id, document_type, catalog_number, batch_number, file_url, status, match_method, match_reason, review_note, upload_status, parse_status, match_status, publish_status, storage_status, failure_reason'
    const fallbackSelect = 'id, batch_id, product_id, document_type, catalog_number, batch_number, file_url, status, match_method, match_reason, review_note'
    const result = await loadBatchDocuments(supabase, batchIds, extendedSelect)
    let documentRows = result.rows
    let documentError = result.error

    if (documentError && isMissingWorkflowColumns(documentError.message)) {
      const fallback = await loadBatchDocuments(supabase, batchIds, fallbackSelect)
      documentRows = fallback.rows
      documentError = fallback.error
    }

    if (documentError) {
      return NextResponse.json({ error: documentError.message }, { status: 500 })
    }
    documents = documentRows
  }

  return NextResponse.json({
    batches: batchRows.map((batch) => summarizeBatch(batch, documents)),
  })
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const body = (await request.json().catch(() => ({}))) as {
    document_type?: DocumentType
    title?: string
    note?: string
  }
  const documentType = normalizeDocumentType(body.document_type)
  const title = clean(body.title) || `${documentType === 'coa' ? 'COA' : '说明书'}批量上传 ${new Date().toLocaleString('zh-CN')}`

  const { data, error } = await supabase
    .from('product_document_batches')
    .insert({
      title,
      document_type: documentType,
      note: clean(body.note),
      created_by: admin?.id || null,
      status: 'uploading',
    })
    .select('id, title, document_type, status, note, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ batch: data })
}

export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const body = (await request.json().catch(() => ({}))) as {
    batch_id?: string
    action?: 'mark_reviewing' | 'record_failures' | 'confirm_exact' | 'archive_batch' | 'reopen_batch'
    note?: string
  }
  const batchId = clean(body.batch_id)

  if (!batchId || !body.action) {
    return NextResponse.json({ error: '缺少批次 ID 或操作类型' }, { status: 400 })
  }

  if (body.action === 'mark_reviewing') {
    const { error } = await supabase
      .from('product_document_batches')
      .update({ status: 'reviewing' })
      .eq('id', batchId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: '批次已进入复核状态' })
  }

  if (body.action === 'record_failures') {
    const note = clean(body.note)
    const { error } = await supabase
      .from('product_document_batches')
      .update({
        status: 'reviewing',
        note: note || '没有上传失败文件',
      })
      .eq('id', batchId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: note ? '上传失败清单已保存' : '没有上传失败文件' })
  }

  if (body.action === 'archive_batch') {
    const { data: batchDocs, error: loadDocsError } = await supabase
      .from('product_documents')
      .select('id, batch_id, product_id, document_type, catalog_number, batch_number, file_url, status, match_method, match_reason, review_note')
      .eq('batch_id', batchId)
    if (loadDocsError) return NextResponse.json({ error: loadDocsError.message }, { status: 500 })

    const documents = (batchDocs || []) as DocumentRow[]
    const { removed, error: removeError } = await removeDocumentFiles(supabase, documents)
    const note = removeError
      ? `管理员撤回整个批次，文件删除失败：${removeError.message}`
      : `管理员撤回整个批次，已从存储删除 ${removed} 个文件；如需上架请重新上传。`

    const documentError = await updateDocumentsWithWorkflow(
      supabase,
      (query: any) => query.eq('batch_id', batchId).neq('status', 'archived'),
      {
        status: 'archived',
        review_note: note,
        publish_status: 'archived',
        storage_status: removeError ? 'active' : 'deleted',
        failure_reason: note,
      },
      { status: 'archived', review_note: note }
    )
    if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })

    const { error } = await supabase
      .from('product_document_batches')
      .update({ status: 'archived' })
      .eq('id', batchId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: note })
  }

  if (body.action === 'reopen_batch') {
    const { data: archivedDocs, error: loadArchivedError } = await supabase
      .from('product_documents')
      .select('id, review_note')
      .eq('batch_id', batchId)
      .eq('status', 'archived')

    if (loadArchivedError) return NextResponse.json({ error: loadArchivedError.message }, { status: 500 })

    const restorableIds = (archivedDocs || [])
      .filter((doc) => {
    const note = String(doc.review_note || '')
    return !note.includes('存储删除') && !note.includes('删除存储文件') && !note.includes('不能上架或恢复') && !note.includes('PDF 文件不存在')
      })
      .map((doc) => doc.id)

    let restored = 0
    if (restorableIds.length > 0) {
      const { count, error: documentError } = await supabase
        .from('product_documents')
        .update({
          status: 'pending',
          storage_status: 'active',
          failure_reason: null,
          workflow_updated_at: new Date().toISOString(),
        }, { count: 'exact' })
        .in('id', restorableIds)
      if (documentError && isMissingWorkflowColumns(documentError.message)) {
        const fallback = await supabase
          .from('product_documents')
          .update({ status: 'pending' }, { count: 'exact' })
          .in('id', restorableIds)
        if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })
        restored = fallback.count || 0
      } else {
      if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })
      restored = count || 0
      }
    }

    const { error } = await supabase
      .from('product_document_batches')
      .update({ status: 'reviewing' })
      .eq('id', batchId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: `已恢复 ${restored || 0} 个仍有文件的记录为待确认；已删除存储文件的记录不能恢复，需要重新上传。` })
  }

  const { data: exactDocuments, error: loadError } = await supabase
    .from('product_documents')
    .select('id, batch_id, product_id, document_type, catalog_number, batch_number, file_url, status, match_method, match_reason, review_note')
    .eq('batch_id', batchId)
    .eq('status', 'pending')
    .eq('match_method', 'exact_catalog')
    .not('product_id', 'is', null)

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 })
  }

  const documents = (exactDocuments || []) as DocumentRow[]
  let confirmed = 0
  const failed: Array<{ id: string; file_url?: string | null; reason: string }> = []
  try {
    for (const document of documents) {
      const result = await confirmDocument(supabase, document)
      if (result.confirmed) {
        confirmed += 1
      } else {
        failed.push({ id: document.id, file_url: document.file_url, reason: result.reason })
      }
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '批量确认失败' },
      { status: 500 }
    )
  }

  const { count: remainingPending } = await supabase
    .from('product_documents')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .eq('status', 'pending')

  if ((remainingPending || 0) === 0) {
    await supabase
      .from('product_document_batches')
      .update({ status: 'completed' })
      .eq('id', batchId)
  } else {
    await supabase
      .from('product_document_batches')
      .update({ status: 'reviewing' })
      .eq('id', batchId)
  }

  return NextResponse.json({
    message: failed.length > 0
      ? `已批量确认 ${confirmed} 个文件，${failed.length} 个文件上架前校验失败，已标记为需重传。`
      : `已批量确认 ${confirmed} 个货号精确匹配文件`,
    confirmed,
    failed: failed.length,
    failures: failed,
    remaining_pending: remainingPending || 0,
  })
}
