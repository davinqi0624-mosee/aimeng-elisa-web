import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit, isPriceChangeSignificant } from '@/lib/admin/audit'
import { generateProductSlug } from '@/lib/products'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'

  let query = supabase.from('products').select('*').order('created_at', { ascending: false })
  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error: dbError } = await query
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  return NextResponse.json({ products: data || [] })
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()
  try {
    const body = await request.json()
    const {
      catalog_number, name, target, detection_range, sensitivity, size,
      price, status = 'active', stock_status = 'in_stock',
      product_image, standard_curve_image, validation_image,
      additional_image, datasheet_pdf,
    } = body

    if (!name || !target) {
      return NextResponse.json({ error: '缺少必填字段（名称、靶标）' }, { status: 400 })
    }

    const slug = generateProductSlug(name, target, catalog_number)

    const { data, error: dbError } = await supabase
      .from('products')
      .insert({
        catalog_number, name, target, detection_range, sensitivity, size, price, status, stock_status,
        product_image, standard_curve_image, validation_image,
        additional_image, datasheet_pdf,
        slug,
      })
      .select('id')
      .single()

    if (dbError) throw dbError

    await logAudit({
      admin_id: admin!.id,
      action: 'create',
      target_table: 'products',
      target_id: data.id,
      new_value: { name, target, price, status },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ id: data.id, message: '商品创建成功' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '创建失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()
  try {
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: '缺少商品ID' }, { status: 400 })

    // 获取旧数据用于审计和价格变动检测
    const { data: oldProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

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

    const { error: dbError } = await supabase.from('products').update(updates).eq('id', id)
    if (dbError) throw dbError

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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少商品ID' }, { status: 400 })

  const { data: oldProduct } = await supabase.from('products').select('*').eq('id', id).single()

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
