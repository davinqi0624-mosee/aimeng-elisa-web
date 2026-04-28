import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'

  let query = supabase
    .from('redeem_orders')
    .select('*, shop_items(name), profiles(full_name)')
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error: dbError } = await query
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  return NextResponse.json({ orders: data || [] })
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

  const supabase = await createClient()
  try {
    const body = await request.json()
    const { id, status, remark } = body
    if (!id || !status) {
      return NextResponse.json({ error: '缺少订单ID或状态' }, { status: 400 })
    }

    const { data: oldOrder } = await supabase
      .from('redeem_orders')
      .select('*')
      .eq('id', id)
      .single()

    const { error: dbError } = await supabase
      .from('redeem_orders')
      .update({ status, remark, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (dbError) throw dbError

    await logAudit({
      admin_id: user.id,
      action: 'update',
      target_table: 'redeem_orders',
      target_id: id,
      old_value: oldOrder,
      new_value: { status, remark },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '更新失败' }, { status: 500 })
  }
}
