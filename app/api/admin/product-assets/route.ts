import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseProductAssetFileName } from '@/lib/products/asset-naming'

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isMissingAssetTables(message?: string) {
  return Boolean(
    message?.includes('product_asset_') &&
      (message.includes('schema cache') || message.includes('does not exist'))
  )
}

function missingAssetTablesResponse() {
  return NextResponse.json(
    {
      error: '产品图片批量上传表尚未初始化，请先执行 supabase/migrations/048_product_asset_batches.sql。',
      needsSetup: true,
    },
    { status: 503 }
  )
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const batchId = clean(searchParams.get('batch_id'))

  try {
    let query = supabase
      .from('product_asset_uploads')
      .select('*, products(id, name, target, catalog_number, cat_no)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (batchId) query = query.eq('batch_id', batchId)

    const { data, error } = await query
    if (error) {
      if (isMissingAssetTables(error.message)) return missingAssetTablesResponse()
      throw error
    }

    return NextResponse.json({ uploads: data || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '图片上传记录加载失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const formData = await request.formData()
  const file = formData.get('file')
  const batchId = clean(formData.get('batch_id'))
  const assetType = clean(formData.get('asset_type')) || 'standard_curve'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少图片文件' }, { status: 400 })
  }
  if (!batchId) {
    return NextResponse.json({ error: '缺少批次 ID' }, { status: 400 })
  }
  if (!IMAGE_TYPES.has(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    return NextResponse.json({ error: '仅支持 PNG/JPG/WebP 图片' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: '单张图片不能超过 20MB' }, { status: 400 })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const hash = createHash('sha256').update(buffer).digest('hex')
    const parsedName = parseProductAssetFileName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeName = `${crypto.randomUUID()}.${ext}`
    const path = `product-assets/${assetType}/${batchId}/${safeName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-assets')
      .upload(path, buffer, {
        contentType: file.type || `image/${ext}`,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('product-assets').getPublicUrl(uploadData.path)

    const { data, error } = await supabase
      .from('product_asset_uploads')
      .insert({
        batch_id: batchId,
        asset_type: assetType,
        image_type: assetType,
        catalog_number: parsedName.catalogNumber || null,
        species: parsedName.species || null,
        target: parsedName.target || null,
        file_url: urlData.publicUrl,
        file_path: uploadData.path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        file_hash: hash,
        match_reason: parsedName.warnings.join('；') || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      if (isMissingAssetTables(error.message)) return missingAssetTablesResponse()
      throw error
    }

    return NextResponse.json({ id: data.id, file_url: urlData.publicUrl, warnings: parsedName.warnings })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '图片上传失败' }, { status: 500 })
  }
}
