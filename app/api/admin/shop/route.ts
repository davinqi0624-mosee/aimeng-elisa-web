import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

  const supabase = await createClient()
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
  const { user, error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

  const supabase = await createClient()
  try {
    const body = await request.json()
    const { name, description, points_required, stock, image_url, status = 'active' } = body

    if (!name || points_required === undefined) {
      return NextResponse.json({ error: '缺少必填字段（名称、积分）' }, { status: 400 })
    }

    const { data, error: dbError } = await supabase
      .from('shop_items')
      .insert({ name, description, points_required, stock: stock || 0, image_url, status })
      .select('id')
      .single()

    if (dbError) throw dbError

    await logAudit({
      admin_id: user.id,
      action: 'create',
      target_table: 'shop_items',
      target_id: data.id,
      new_value: { name, points_required, stock, status },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ id: data.id, message: '奖品创建成功' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '创建失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

  const supabase = await createClient()
  try {
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: '缺少奖品ID' }, { status: 400 })

    const { data: oldItem } = await supabase.from('shop_items').select('*').eq('id', id).single()

    const { error: dbError } = await supabase.from('shop_items').update(updates).eq('id', id)
    if (dbError) throw dbError

    await logAudit({
      admin_id: user.id,
      action: 'update',
      target_table: 'shop_items',
      target_id: id,
      old_value: oldItem,
      new_value: updates,
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少奖品ID' }, { status: 400 })

  const { data: oldItem } = await supabase.from('shop_items').select('*').eq('id', id).single()

  const { error: dbError } = await supabase.from('shop_items').delete().eq('id', id)
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  await logAudit({
    admin_id: user.id,
    action: 'delete',
    target_table: 'shop_items',
    target_id: id,
    old_value: oldItem,
    ip_address: getClientIP(request),
  })

  return NextResponse.json({ success: true })
}
