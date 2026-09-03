import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'product-assets'
const MAX_SIZE = 20 * 1024 * 1024

function displayFileName(name: string) {
  const base = name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
  const withExtension = base.toLowerCase().endsWith('.pdf') ? base : `${base || '操作说明书'}.pdf`
  return withExtension.slice(0, 240)
}

function storagePathFromUrl(url: string) {
  const marker = '/product-assets/'
  const index = url.indexOf(marker)
  return index === -1 ? '' : decodeURIComponent(url.slice(index + marker.length).split('?')[0] || '')
}

function missingTable(message: string) {
  return /biochemical_product_documents.*(?:does not exist|not found in schema cache)|relation .*biochemical_product_documents/i.test(message)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError
  const { id } = await params
  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')

  if (!(file instanceof File)) return NextResponse.json({ error: '请选择 PDF 说明书' }, { status: 400 })
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: '仅支持 PDF 文件' }, { status: 400 })
  }
  if (file.size === 0) return NextResponse.json({ error: '文件内容为空' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'PDF 不能超过 20MB' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: product, error: productError } = await supabase
    .from('biochemical_products')
    .select('id, catalog_number, indicator_name')
    .eq('id', id)
    .maybeSingle()
  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
  if (!product) return NextResponse.json({ error: '生化产品不存在' }, { status: 404 })

  const fileName = displayFileName(file.name)
  // Keep the original name for the administrator, but use an ASCII-only object key.
  // Supabase Storage rejects some combinations of Chinese punctuation and spaces.
  const path = `biochemical-documents/${id}/${crypto.randomUUID()}.pdf`
  const { data: upload, error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: 'application/pdf',
    upsert: false,
  })
  if (uploadError || !upload?.path) return NextResponse.json({ error: uploadError?.message || '说明书上传失败' }, { status: 500 })

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(upload.path)
  const { data: oldDocuments, error: oldError } = await supabase
    .from('biochemical_product_documents')
    .select('id, file_url')
    .eq('biochemical_product_id', id)
    .eq('status', 'active')
  if (oldError && !missingTable(oldError.message)) {
    await supabase.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: oldError.message }, { status: 500 })
  }

  const oldIds = (oldDocuments || []).map((oldDocument) => oldDocument.id)
  if (oldIds.length > 0) {
    const { error: archiveError } = await supabase
      .from('biochemical_product_documents')
      .update({ status: 'archived' })
      .in('id', oldIds)
    if (archiveError) {
      await supabase.storage.from(BUCKET).remove([path])
      return NextResponse.json({ error: archiveError.message }, { status: 500 })
    }
  }

  const { data: document, error: insertError } = await supabase
    .from('biochemical_product_documents')
    .insert({ biochemical_product_id: id, file_url: urlData.publicUrl, file_path: path, file_name: fileName, status: 'active' })
    .select('id, file_url, file_name, created_at')
    .single()
  if (insertError || !document) {
    await supabase.storage.from(BUCKET).remove([path])
    if (oldIds.length > 0) {
      await supabase.from('biochemical_product_documents').update({ status: 'active' }).in('id', oldIds)
    }
    return NextResponse.json({ error: insertError?.message || '说明书记录创建失败' }, { status: missingTable(insertError?.message || '') ? 503 : 500 })
  }

  for (const oldDocument of oldDocuments || []) {
    const oldPath = storagePathFromUrl(oldDocument.file_url)
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath])
  }

  await logAudit({
    admin_id: admin!.id,
    action: 'upload',
    target_table: 'biochemical_product_documents',
    target_id: document.id,
    new_value: { biochemical_product_id: id, file_name: fileName, catalog_number: product.catalog_number },
    ip_address: getClientIP(request),
  })
  return NextResponse.json({ document })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError
  const { id } = await params
  const supabase = createAdminClient()
  const { data: document, error } = await supabase
    .from('biochemical_product_documents')
    .select('id, file_url, file_name, created_at')
    .eq('biochemical_product_id', id)
    .eq('status', 'active')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: missingTable(error.message) ? 503 : 500 })
  return NextResponse.json({ document: document || null })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError
  const { id } = await params
  const supabase = createAdminClient()
  const { data: document, error: loadError } = await supabase
    .from('biochemical_product_documents')
    .select('id, file_url, file_name')
    .eq('biochemical_product_id', id)
    .eq('status', 'active')
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!document) return NextResponse.json({ message: '当前产品没有有效说明书' })

  const path = storagePathFromUrl(document.file_url)
  const { error: removeError } = path ? await supabase.storage.from(BUCKET).remove([path]) : { error: null }
  if (removeError) return NextResponse.json({ error: `删除存储文件失败：${removeError.message}` }, { status: 500 })
  const { error: updateError } = await supabase.from('biochemical_product_documents').update({ status: 'archived' }).eq('id', document.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  await logAudit({ admin_id: admin!.id, action: 'delete', target_table: 'biochemical_product_documents', target_id: document.id, old_value: document, ip_address: getClientIP(request) })
  return NextResponse.json({ message: '说明书已删除' })
}
