import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit, isPriceChangeSignificant } from '@/lib/admin/audit'
import { generateProductSlug } from '@/lib/products'
import { createAdminClient } from '@/lib/supabase/admin'

type ProductUpsertPayload = {
  catalog_number?: string | null
  cat_no?: string | null
  name: string
  target: string
  species?: string | null
  description?: string | null
  detection_method?: string | null
  assay_time?: string | null
  platform?: string | null
  sample_types_text?: string | null
  detection_range?: string | null
  sensitivity?: string | null
  size?: string | null
  price: number
  price_48t?: number | null
  price_96t?: number | null
  status?: string
  stock_status?: string
  product_image?: string | null
  standard_curve_image?: string | null
  validation_image?: string | null
  additional_image?: string | null
  datasheet_pdf?: string | null
  slug?: string
}

type ExistingProduct = {
  id: string
  slug?: string | null
  name: string
  target: string
  catalog_number?: string | null
  price: number
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(0, Number(searchParams.get('page') || '0') || 0)
  const pageSizeParam = Number(searchParams.get('pageSize') || '0') || 0
  const pageSize = pageSizeParam > 0 ? Math.min(pageSizeParam, 100) : 0

  let query = supabase.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (status !== 'all') {
    query = query.eq('status', status)
  }
  if (search) {
    const term = search.replace(/[%_,()]/g, ' ').trim()
    if (term) {
      query = query.or(`name.ilike.%${term}%,target.ilike.%${term}%,catalog_number.ilike.%${term}%,cat_no.ilike.%${term}%,species.ilike.%${term}%`)
    }
  }
  if (pageSize > 0) {
    query = query.range(page * pageSize, (page + 1) * pageSize - 1)
  }

  const { data, error: dbError, count } = await query
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  return NextResponse.json({ products: data || [], total: count ?? data?.length ?? 0 })
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const {
      catalog_number, cat_no, name, target, species, detection_range, sensitivity, size,
      description, detection_method, assay_time, platform, sample_types_text,
      price, price_48t, price_96t, status = 'active', stock_status = 'in_stock',
      product_image, standard_curve_image, validation_image,
      additional_image, datasheet_pdf,
    } = body

    const catalogNumber = catalog_number || cat_no || null
    if (!name || !target || !catalogNumber) {
      return NextResponse.json({ error: '缺少必填字段（名称、靶标、货号）' }, { status: 400 })
    }
    const slug = generateProductSlug(name, target, catalogNumber || undefined)

    const insertData: ProductUpsertPayload = {
      catalog_number: catalogNumber, cat_no: catalogNumber, name, target, description, detection_method, assay_time, platform, sample_types_text, detection_range, sensitivity, size,
      price, status, stock_status,
      product_image, standard_curve_image, validation_image,
      additional_image, datasheet_pdf,
      slug,
    }
    if (species !== undefined) insertData.species = species
    if (price_48t !== undefined) insertData.price_48t = price_48t
    if (price_96t !== undefined) insertData.price_96t = price_96t

    const insertResult = await supabase
      .from('products')
      .insert(insertData)
      .select('id')
      .single()
    let createdProduct = insertResult.data
    const dbError = insertResult.error

    // Retry without new columns if they don't exist yet
    if (dbError && (dbError.message?.includes('price_48t') || dbError.message?.includes('price_96t') || dbError.message?.includes('species') || dbError.message?.includes('description') || dbError.message?.includes('detection_method') || dbError.message?.includes('assay_time') || dbError.message?.includes('platform') || dbError.message?.includes('sample_types_text'))) {
      const fallbackData: ProductUpsertPayload = {
        catalog_number: catalogNumber, cat_no: catalogNumber, name, target, detection_range, sensitivity, size,
        price, status, stock_status,
        product_image, standard_curve_image, validation_image,
        additional_image, datasheet_pdf,
        slug,
      }
      const { data: fallbackResult, error: fallbackError } = await supabase
        .from('products')
        .insert(fallbackData)
        .select('id')
        .single()
      if (fallbackError) throw fallbackError
      createdProduct = fallbackResult
    } else if (dbError) {
      throw dbError
    }

    if (!createdProduct) {
      return NextResponse.json({ error: '创建失败' }, { status: 500 })
    }

    await logAudit({
      admin_id: admin!.id,
      action: 'create',
      target_table: 'products',
      target_id: createdProduct.id,
      new_value: { name, target, price, status },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ id: createdProduct.id, message: '商品创建成功' })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message || '创建失败' : '创建失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: '缺少商品ID' }, { status: 400 })
    if (updates.name !== undefined && !String(updates.name).trim()) {
      return NextResponse.json({ error: '商品名称不能为空' }, { status: 400 })
    }
    if (updates.target !== undefined && !String(updates.target).trim()) {
      return NextResponse.json({ error: '靶标不能为空' }, { status: 400 })
    }
    if (updates.catalog_number !== undefined && !String(updates.catalog_number || '').trim()) {
      return NextResponse.json({ error: '货号不能为空。货号是说明书、COA 和批量文件匹配的核心字段。' }, { status: 400 })
    }

    // 获取旧数据用于审计和价格变动检测
    const { data: oldProduct, error: oldProductError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
    if (oldProductError || !oldProduct) {
      return NextResponse.json({ error: '商品不存在或已被删除' }, { status: 404 })
    }

    // 价格变动超过 20% 需要 super 确认
    if (oldProduct && updates.price !== undefined) {
      if (isPriceChangeSignificant(oldProduct.price, updates.price)) {
        if (admin!.role !== 'super') {
          return NextResponse.json(
            { error: '价格变动超过 20%，需要超级管理员确认', requireConfirm: true },
            { status: 403 }
          )
        }
      }
    }

    // Ensure slug exists for legacy products missing one
    if (!oldProduct.slug && !updates.slug) {
      updates.slug = generateProductSlug(
        updates.name || oldProduct.name,
        updates.target || oldProduct.target,
        updates.catalog_number || oldProduct.catalog_number
      )
    }
    if (updates.catalog_number !== undefined && updates.cat_no === undefined) {
      updates.cat_no = updates.catalog_number || null
    }

    const { error: dbError } = await supabase.from('products').update(updates).eq('id', id)

    // Retry without new columns if they don't exist yet
    if (dbError && (dbError.message?.includes('price_48t') || dbError.message?.includes('price_96t') || dbError.message?.includes('species') || dbError.message?.includes('description') || dbError.message?.includes('detection_method') || dbError.message?.includes('assay_time') || dbError.message?.includes('platform') || dbError.message?.includes('sample_types_text'))) {
      const fallbackUpdates = { ...updates }
      delete fallbackUpdates.species
      delete fallbackUpdates.price_48t
      delete fallbackUpdates.price_96t
      delete fallbackUpdates.description
      delete fallbackUpdates.detection_method
      delete fallbackUpdates.assay_time
      delete fallbackUpdates.platform
      delete fallbackUpdates.sample_types_text
      const { error: fallbackError } = await supabase.from('products').update(fallbackUpdates).eq('id', id)
      if (fallbackError) throw fallbackError
    } else if (dbError) {
      throw dbError
    }

    await logAudit({
      admin_id: admin!.id,
      action: 'update',
      target_table: 'products',
      target_id: id,
      old_value: oldProduct,
      new_value: updates,
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message || '更新失败' : '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少商品ID' }, { status: 400 })

  const { data: oldProduct, error: oldProductError } = await supabase.from('products').select('*').eq('id', id).single<ExistingProduct>()
  if (oldProductError || !oldProduct) {
    return NextResponse.json({ error: '商品不存在或已被删除' }, { status: 404 })
  }

  const { error: dbError } = await supabase.from('products').delete().eq('id', id)
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  await logAudit({
    admin_id: admin!.id,
    action: 'delete',
    target_table: 'products',
    target_id: id,
    old_value: oldProduct,
    ip_address: getClientIP(request),
  })

  return NextResponse.json({ success: true })
}
