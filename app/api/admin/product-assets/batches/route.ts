import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeAssetToken } from '@/lib/products/asset-naming'
import { catalogNumberVariants, normalizeElisaCatalogNumber } from '@/lib/products/catalog'

type ProductRow = {
  id: string
  name: string
  target: string | null
  species: string | null
  catalog_number: string | null
  cat_no: string | null
}

type AssetUploadRow = {
  id: string
  batch_id: string
  product_id: string | null
  asset_type: string
  image_type: string
  catalog_number: string | null
  species: string | null
  target: string | null
  file_url: string
  file_path?: string | null
  status: string
}

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

function findProductMatch(upload: AssetUploadRow, products: ProductRow[]) {
  const catalog = normalizeElisaCatalogNumber(upload.catalog_number)
  if (catalog) {
    const variants = new Set(catalogNumberVariants(catalog))
    const exact = products.find((product) =>
      [product.catalog_number, product.cat_no].some((value) => variants.has(normalizeElisaCatalogNumber(value)))
    )
    if (exact) {
      return {
        product: exact,
        method: 'exact_catalog',
        score: 120,
        reason: `按货号 ${catalog} 精确匹配`,
      }
    }
  }

  const speciesToken = normalizeAssetToken(upload.species)
  const targetToken = normalizeAssetToken(upload.target)
  if (!speciesToken || !targetToken) {
    return { product: null, method: 'none', score: 0, reason: '文件名缺少货号或“种属 + 指标”' }
  }

  const matches = products.filter((product) => {
    const productSpecies = normalizeAssetToken(product.species || product.name)
    const productTarget = normalizeAssetToken(product.target || product.name)
    return productSpecies.includes(speciesToken) && productTarget === targetToken
  })

  if (matches.length === 1) {
    return {
      product: matches[0],
      method: 'exact_species_target',
      score: 100,
      reason: `按种属 ${upload.species} + 指标 ${upload.target} 唯一匹配`,
    }
  }

  if (matches.length > 1) {
    return { product: null, method: 'ambiguous', score: 40, reason: `种属 + 指标匹配到 ${matches.length} 个产品，需要人工确认` }
  }

  return { product: null, method: 'none', score: 0, reason: '未匹配到产品' }
}

async function removeStoragePaths(supabase: ReturnType<typeof createAdminClient>, paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)))
  let removed = 0
  let failed = 0

  for (let index = 0; index < uniquePaths.length; index += 100) {
    const chunk = uniquePaths.slice(index, index + 100)
    const { data, error } = await supabase.storage.from('product-assets').remove(chunk)
    if (error) {
      failed += chunk.length
    } else {
      removed += data?.length || chunk.length
    }
  }

  return { removed, failed }
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const assetType = clean(searchParams.get('asset_type')) || 'standard_curve'

  try {
    const { data, error } = await supabase
      .from('product_asset_batches')
      .select('*')
      .eq('asset_type', assetType)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      if (isMissingAssetTables(error.message)) return missingAssetTablesResponse()
      throw error
    }

    return NextResponse.json({ batches: data || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '批次加载失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const body = await request.json().catch(() => ({}))
  const assetType = clean(body.asset_type) || 'standard_curve'
  const title = clean(body.title) || `标准曲线图片批量上传 ${new Date().toLocaleString('zh-CN')}`

  try {
    const { data, error } = await supabase
      .from('product_asset_batches')
      .insert({
        asset_type: assetType,
        title,
        status: 'uploaded',
        created_by: admin?.id || null,
      })
      .select('*')
      .single()

    if (error) {
      if (isMissingAssetTables(error.message)) return missingAssetTablesResponse()
      throw error
    }

    return NextResponse.json({ batch: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '批次创建失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const body = await request.json().catch(() => ({}))
  const batchId = clean(body.batch_id)
  const action = clean(body.action)

  if (!batchId || !action) {
    return NextResponse.json({ error: '缺少批次 ID 或操作' }, { status: 400 })
  }

  try {
    if (action === 'match') {
      const [{ data: uploads, error: uploadError }, { data: products, error: productError }] = await Promise.all([
        supabase.from('product_asset_uploads').select('*').eq('batch_id', batchId),
        supabase.from('products').select('id, name, target, species, catalog_number, cat_no').eq('status', 'active').limit(20000),
      ])

      if (uploadError) {
        if (isMissingAssetTables(uploadError.message)) return missingAssetTablesResponse()
        throw uploadError
      }
      if (productError) throw productError

      let matched = 0
      let failed = 0
      for (const upload of (uploads || []) as AssetUploadRow[]) {
        const match = findProductMatch(upload, (products || []) as ProductRow[])
        if (match.product) matched += 1
        else failed += 1

        await supabase
          .from('product_asset_uploads')
          .update({
            product_id: match.product?.id || null,
            match_method: match.method,
            match_score: match.score,
            match_reason: match.reason,
            status: match.product ? 'matched' : 'pending',
          })
          .eq('id', upload.id)
      }

      await supabase
        .from('product_asset_batches')
        .update({
          status: 'reviewing',
          total_count: uploads?.length || 0,
          matched_count: matched,
          failed_count: failed,
        })
        .eq('id', batchId)

      return NextResponse.json({ message: `自动匹配完成：匹配 ${matched} 个，待处理 ${failed} 个。` })
    }

    if (action === 'confirm_exact') {
      const { data: uploads, error: uploadError } = await supabase
        .from('product_asset_uploads')
        .select('*')
        .eq('batch_id', batchId)
        .eq('status', 'matched')
        .in('match_method', ['exact_catalog', 'exact_species_target'])

      if (uploadError) {
        if (isMissingAssetTables(uploadError.message)) return missingAssetTablesResponse()
        throw uploadError
      }

      let active = 0
      for (const upload of (uploads || []) as AssetUploadRow[]) {
        if (!upload.product_id) continue

        const { data: previous } = await supabase
          .from('product_images')
          .select('image_url')
          .eq('product_id', upload.product_id)
          .eq('image_type', upload.image_type)
          .maybeSingle()

        await supabase
          .from('product_images')
          .upsert({
            product_id: upload.product_id,
            image_url: upload.file_url,
            image_type: upload.image_type,
            display_order: upload.image_type === 'standard_curve' ? 2 : upload.image_type === 'reserved' ? 5 : 4,
          }, { onConflict: 'product_id,image_type' })

        await supabase
          .from('product_asset_uploads')
          .update({
            previous_image_url: previous?.image_url || null,
            status: 'active',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', upload.id)

        active += 1
      }

      await supabase
        .from('product_asset_batches')
        .update({ status: 'confirmed', active_count: active })
        .eq('id', batchId)

      return NextResponse.json({ message: `已确认生效 ${active} 张图片。` })
    }

    if (action === 'rollback') {
      const { data: uploads, error: uploadError } = await supabase
        .from('product_asset_uploads')
        .select('*')
        .eq('batch_id', batchId)

      if (uploadError) {
        if (isMissingAssetTables(uploadError.message)) return missingAssetTablesResponse()
        throw uploadError
      }

      const uploadRows = ((uploads || []) as Array<AssetUploadRow & { previous_image_url?: string | null }>)
        .filter((upload) => !['rolled_back', 'archived'].includes(upload.status))
      let rolledBack = 0
      let restored = 0
      for (const upload of uploadRows) {
        if (upload.status !== 'active' || !upload.product_id) {
          await supabase
            .from('product_asset_uploads')
            .update({ status: 'rolled_back' })
            .eq('id', upload.id)
          rolledBack += 1
          continue
        }

        if (upload.previous_image_url) {
          await supabase
            .from('product_images')
            .upsert({
              product_id: upload.product_id,
              image_url: upload.previous_image_url,
            image_type: upload.image_type,
            display_order: upload.image_type === 'standard_curve' ? 2 : upload.image_type === 'reserved' ? 5 : 4,
          }, { onConflict: 'product_id,image_type' })
          restored += 1
        } else {
          await supabase
            .from('product_images')
            .delete()
            .eq('product_id', upload.product_id)
            .eq('image_type', upload.image_type)
            .eq('image_url', upload.file_url)
        }

        await supabase
          .from('product_asset_uploads')
          .update({ status: 'rolled_back' })
          .eq('id', upload.id)
        rolledBack += 1
      }

      const storageResult = await removeStoragePaths(
        supabase,
        uploadRows.map((upload) => upload.file_path || '')
      )

      await supabase
        .from('product_asset_batches')
        .update({
          status: 'rolled_back',
          active_count: 0,
          details: {
            rollback_result: {
              rolled_back: rolledBack,
              restored,
              storage_removed: storageResult.removed,
              storage_failed: storageResult.failed,
            },
          },
        })
        .eq('id', batchId)

      const storageNote = storageResult.failed > 0
        ? `，存储文件已清理 ${storageResult.removed} 个，${storageResult.failed} 个清理失败`
        : `，存储文件已清理 ${storageResult.removed} 个`
      return NextResponse.json({ message: `已撤回本批次 ${rolledBack} 张图片，恢复旧图片位 ${restored} 张${storageNote}。` })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '批次操作失败' }, { status: 500 })
  }
}
