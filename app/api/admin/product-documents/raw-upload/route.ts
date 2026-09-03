import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildProductDocumentStorageName,
  getProductDocumentNamingHint,
  parseProductDocumentFileName,
} from '@/lib/products/document-naming'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DocumentType = 'datasheet' | 'coa'

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

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const searchParams = request.nextUrl.searchParams
  const documentType = normalizeDocumentType(searchParams.get('document_type'))
  const batchId = clean(searchParams.get('batch_id'))
  const fileName = clean(searchParams.get('file_name'))
  const contentType = request.headers.get('content-type') || 'application/pdf'
  const contentLength = Number(request.headers.get('content-length') || 0)
  const expectedSize = Number(
    searchParams.get('file_size') || request.headers.get('x-file-size') || contentLength || 0
  )

  if (!batchId) {
    return NextResponse.json({ error: '缺少批次 ID' }, { status: 400 })
  }
  if (!fileName) {
    return NextResponse.json({ error: '缺少文件名' }, { status: 400 })
  }
  if (!fileName.toLowerCase().endsWith('.pdf') && contentType !== 'application/pdf') {
    return NextResponse.json({ error: '仅支持 PDF 文件' }, { status: 400 })
  }
  if (contentLength > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'PDF 不能超过 20MB' }, { status: 400 })
  }

  const parsedName = parseProductDocumentFileName(fileName, documentType)
  if (!parsedName.catalogNumber || (documentType === 'coa' && !parsedName.batchNumber)) {
    return NextResponse.json(
      {
        error: parsedName.warnings[0] || getProductDocumentNamingHint(documentType),
        warnings: parsedName.warnings,
      },
      { status: 400 }
    )
  }

  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await request.arrayBuffer()
  } catch (err: unknown) {
    console.error('Product document raw upload body read failed', err)
    return NextResponse.json(
      {
        error: '上传请求没有完整到达服务器，请单独重传该文件；如果连续出现，请减少单次选择的文件数量后重试。',
        code: 'UPLOAD_BODY_READ_FAILED',
      },
      { status: 408 }
    )
  }

  if (arrayBuffer.byteLength === 0) {
    console.warn('Product document raw upload empty body', {
      fileName,
      batchId,
      contentLength,
      expectedSize,
    })
    return NextResponse.json({ error: '上传文件内容为空' }, { status: 400 })
  }
  if (arrayBuffer.byteLength > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'PDF 不能超过 20MB' }, { status: 400 })
  }
  if (expectedSize > 0 && arrayBuffer.byteLength !== expectedSize) {
    console.warn('Product document raw upload size mismatch', {
      fileName,
      batchId,
      expectedSize,
      receivedSize: arrayBuffer.byteLength,
      contentLength,
    })
    return NextResponse.json(
      {
        error: `服务器收到的文件大小不完整：应为 ${expectedSize} 字节，实际收到 ${arrayBuffer.byteLength} 字节`,
        code: 'UPLOAD_SIZE_MISMATCH',
      },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const bucket = 'product-assets'
  const safeName = buildProductDocumentStorageName(parsedName, crypto.randomUUID().slice(0, 8))
  const storagePath = `product-documents/${documentType}/${safeName}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, Buffer.from(arrayBuffer), {
      cacheControl: '3600',
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError || !uploadData?.path) {
    console.error('Product document raw upload storage failed', {
      fileName,
      batchId,
      storagePath,
      message: uploadError?.message,
    })
    return NextResponse.json({ error: uploadError?.message || '上传到存储失败' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path)
  const insertPayload = {
    product_id: null,
    batch_id: batchId,
    document_type: documentType,
    document_key: parsedName.documentKey,
    catalog_number: parsedName.catalogNumber,
    batch_number: parsedName.batchNumber,
    normalized_file_key: parsedName.documentKey,
    file_url: urlData.publicUrl,
    file_name: fileName,
    source_type: 'server_raw_upload',
    match_method: 'none',
    match_reason: parsedName.warnings.length > 0 ? parsedName.warnings.join('；') : null,
    upload_status: 'uploaded',
    parse_status: parsedName.catalogNumber ? 'parsed' : 'failed',
    match_status: 'unmatched',
    publish_status: 'draft',
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
      product_id: null,
      batch_id: batchId,
      document_type: documentType,
      document_key: parsedName.documentKey,
      catalog_number: parsedName.catalogNumber,
      batch_number: parsedName.batchNumber,
      normalized_file_key: parsedName.documentKey,
      file_url: urlData.publicUrl,
      file_name: fileName,
      source_type: 'server_raw_upload',
      match_method: 'none',
      match_reason: parsedName.warnings.length > 0 ? parsedName.warnings.join('；') : null,
      status: 'pending',
    }
    const legacyFallbackPayload = {
      product_id: null,
      document_type: documentType,
      document_key: parsedName.documentKey,
      file_url: urlData.publicUrl,
      file_name: fileName,
      source_type: 'server_raw_upload',
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

  if (insertError || !doc) {
    console.error('Product document raw upload insert failed', {
      fileName,
      batchId,
      message: insertError?.message,
    })
    return NextResponse.json({ error: insertError?.message || '文档记录创建失败' }, { status: 500 })
  }

  return NextResponse.json({
    id: doc.id,
    file_url: urlData.publicUrl,
    file_name: fileName,
    document_type: documentType,
    catalog_number: parsedName.catalogNumber,
    batch_number: parsedName.batchNumber,
    document_key: parsedName.documentKey,
    batch_id: batchId,
    warnings: parsedName.warnings,
    status: 'pending',
  })
}
