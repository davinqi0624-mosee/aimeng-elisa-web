import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeShopRedemptionNotice } from '@/lib/shop/constants'
import { isShopCategory, type ShopCategory } from '@/lib/shop/categories'

interface ShopItemUpdatePayload {
  name?: string
  description?: string | null
  points_required?: number
  stock?: number
  image_url?: string | null
  status?: string
  category?: ShopCategory
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

function isMissingCategoryColumn(err: unknown) {
  return errorMessage(err, '').includes('column shop_items.category does not exist')
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error: dbError } = await supabase
    .from('shop_items')
    .select('*')
    .order('sort_order', { ascending: true })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { name, description, points_required, stock, image_url, status = 'active', category } = body
    const pointsRequired = Number(points_required)
    const stockCount = Number(stock || 0)

    if (!String(name || '').trim() || !Number.isFinite(pointsRequired) || pointsRequired <= 0) {
      return NextResponse.json({ error: '缺少必填字段（名称、积分）' }, { status: 400 })
    }
    if (!isShopCategory(category)) {
      return NextResponse.json({ error: '请选择有效的商品分类' }, { status: 400 })
    }
    if (!Number.isFinite(stockCount) || stockCount < 0) {
      return NextResponse.json({ error: '库存不能小于 0' }, { status: 400 })
    }

    const { data, error: dbError } = await supabase
      .from('shop_items')
      .insert({
        name: String(name).trim(),
        description: removeShopRedemptionNotice(description),
        points_required: pointsRequired,
        stock: stockCount,
        image_url,
        status,
        category,
      })
      .select('id')
      .single()

    if (dbError) throw dbError

    await logAudit({
      admin_id: admin!.id,
      action: 'create',
      target_table: 'shop_items',
      target_id: data.id,
      new_value: { name, points_required: pointsRequired, stock: stockCount, status, category },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ id: data.id, message: '奖品创建成功' })
  } catch (err: unknown) {
    if (isMissingCategoryColumn(err)) {
      return NextResponse.json({ error: '商品分类数据库字段尚未初始化，请先执行 066_shop_item_categories.sql' }, { status: 503 })
    }
    return NextResponse.json({ error: errorMessage(err, '创建失败') }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { id, ...rawUpdates } = body
    const updates = { ...rawUpdates } as ShopItemUpdatePayload
    if (!id) return NextResponse.json({ error: '缺少奖品ID' }, { status: 400 })
    if (updates.name !== undefined) {
      updates.name = String(updates.name || '').trim()
      if (!updates.name) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })
    }
    if (updates.points_required !== undefined) {
      updates.points_required = Number(updates.points_required)
      if (!Number.isFinite(updates.points_required) || updates.points_required <= 0) {
        return NextResponse.json({ error: '所需积分必须大于 0' }, { status: 400 })
      }
    }
    if (updates.stock !== undefined) {
      updates.stock = Number(updates.stock)
      if (!Number.isFinite(updates.stock) || updates.stock < 0) {
        return NextResponse.json({ error: '库存不能小于 0' }, { status: 400 })
      }
    }
    if (updates.description !== undefined) {
      updates.description = removeShopRedemptionNotice(updates.description)
    }
    if (updates.category !== undefined && !isShopCategory(updates.category)) {
      return NextResponse.json({ error: '请选择有效的商品分类' }, { status: 400 })
    }

    const { data: oldItem } = await supabase.from('shop_items').select('*').eq('id', id).single()
    if (!oldItem) return NextResponse.json({ error: '商品不存在' }, { status: 404 })
    if (!updates.category && !isShopCategory(oldItem.category)) {
      return NextResponse.json({ error: '请先为商品选择分类' }, { status: 400 })
    }

    const { error: dbError } = await supabase.from('shop_items').update(updates).eq('id', id)
    if (dbError) throw dbError

    await logAudit({
      admin_id: admin!.id,
      action: 'update',
      target_table: 'shop_items',
      target_id: id,
      old_value: oldItem,
      new_value: updates,
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (isMissingCategoryColumn(err)) {
      return NextResponse.json({ error: '商品分类数据库字段尚未初始化，请先执行 066_shop_item_categories.sql' }, { status: 503 })
    }
    return NextResponse.json({ error: errorMessage(err, '更新失败') }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少奖品ID' }, { status: 400 })

  const { data: oldItem } = await supabase.from('shop_items').select('*').eq('id', id).single()

  const { error: dbError } = await supabase.from('shop_items').delete().eq('id', id)
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  await logAudit({
    admin_id: admin!.id,
    action: 'delete',
    target_table: 'shop_items',
    target_id: id,
    old_value: oldItem,
    ip_address: getClientIP(request),
  })

  return NextResponse.json({ success: true })
}
