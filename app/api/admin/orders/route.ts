import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPointLedgerSummary, syncProfilePointTotals } from '@/lib/points/ledger'

const VALID_STATUSES = new Set(['pending', 'approved', 'fulfilled', 'cancelled'])

interface RefundTransactionRow {
  id: string
  amount: number
}

interface RedeemOrderRow {
  id: string
  user_id: string
  item_id: string | null
  [key: string]: unknown
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'
  const page = Math.max(0, Number(searchParams.get('page') || '0') || 0)
  const pageSize = Math.min(Math.max(1, Number(searchParams.get('pageSize') || searchParams.get('limit') || '100') || 100), 100)

  let query = supabase
    .from('redeem_orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('status', status)
  }
  query = query.range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, error: dbError, count } = await query
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  const orderRows = (data || []) as RedeemOrderRow[]
  const userIds = [...new Set(orderRows.map((order) => order.user_id).filter(Boolean))]
  const itemIds = [...new Set(orderRows.map((order) => order.item_id).filter(Boolean))] as string[]

  const profilesById = new Map<string, { full_name: string | null }>()
  if (userIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    for (const profile of profileData || []) {
      profilesById.set(profile.id, { full_name: profile.full_name || null })
    }
  }

  const itemsById = new Map<string, { name: string | null }>()
  if (itemIds.length > 0) {
    const { data: itemData } = await supabase
      .from('shop_items')
      .select('id, name')
      .in('id', itemIds)
    for (const item of itemData || []) {
      itemsById.set(item.id, { name: item.name || null })
    }
  }

  const orders = orderRows.map((order) => ({
    ...order,
    shop_items: order.item_id ? itemsById.get(order.item_id) || null : null,
    profiles: profilesById.get(order.user_id) || null,
    user_email: typeof order.contact_email === 'string' ? order.contact_email : null,
  }))

  return NextResponse.json({ orders, total: count ?? data?.length ?? 0 })
}

export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { id, status, remark } = body
    if (!id || !status) {
      return NextResponse.json({ error: '缺少订单ID或状态' }, { status: 400 })
    }
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: '订单状态不合法' }, { status: 400 })
    }

    const { data: oldOrder, error: oldOrderError } = await supabase
      .from('redeem_orders')
      .select('*')
      .eq('id', id)
      .single()
    if (oldOrderError || !oldOrder) {
      return NextResponse.json({ error: '订单不存在或已被删除' }, { status: 404 })
    }
    if (oldOrder.status === status) {
      return NextResponse.json({ success: true, unchanged: true })
    }
    if (['cancelled', 'fulfilled'].includes(oldOrder.status)) {
      return NextResponse.json({ error: '已取消或已完成的订单不能再次变更，避免重复退积分或重复发货。' }, { status: 400 })
    }

    if (status === 'cancelled') {
      const ledger = await getPointLedgerSummary(supabase, oldOrder.user_id)
      const balance = ledger.availablePoints

      const { data: existingRefund, error: existingRefundError } = await supabase
        .from('point_transactions')
        .select('id, amount')
        .eq('source_table', 'redeem_orders')
        .eq('source_id', oldOrder.id)
        .eq('type', 'refund')
        .maybeSingle<RefundTransactionRow>()

      if (existingRefundError) throw new Error(`检查退款流水失败: ${existingRefundError.message}`)
      if (existingRefund && existingRefund.amount !== oldOrder.points_spent) {
        throw new Error('该订单已存在退款流水，但退款金额与订单金额不一致，请人工核对。')
      }

      if (!existingRefund) {
        const { error: refundError } = await supabase.from('point_transactions').insert({
          user_id: oldOrder.user_id,
          amount: oldOrder.points_spent,
          type: 'refund',
          source: 'redeem_order_cancelled',
          source_id: oldOrder.id,
          source_table: 'redeem_orders',
          balance_after: balance + oldOrder.points_spent,
          description: '积分兑换订单取消退回积分',
        })
        if (refundError) throw new Error(`退回积分失败: ${refundError.message}`)
      }
      await syncProfilePointTotals(supabase, oldOrder.user_id)

      if (oldOrder.item_id) {
        const { data: item } = await supabase.from('shop_items').select('stock').eq('id', oldOrder.item_id).single()
        const nextStock = Number(item?.stock || 0) + 1
        const { error: stockError } = await supabase.from('shop_items').update({ stock: nextStock }).eq('id', oldOrder.item_id)
        if (stockError) throw new Error(`恢复库存失败: ${stockError.message}`)
      }
    }

    const updates: Record<string, unknown> = {
      status,
      remark,
      updated_at: new Date().toISOString(),
    }
    if (status === 'approved' && !oldOrder.reviewed_at) {
      updates.reviewed_at = new Date().toISOString()
    }
    if (status === 'fulfilled') {
      updates.shipped_at = new Date().toISOString()
      if (!oldOrder.reviewed_at) updates.reviewed_at = new Date().toISOString()
    }

    const { error: dbError } = await supabase
      .from('redeem_orders')
      .update(updates)
      .eq('id', id)

    if (dbError) throw dbError

    await logAudit({
      admin_id: admin!.id,
      action: 'update',
      target_table: 'redeem_orders',
      target_id: id,
      old_value: oldOrder,
      new_value: { status, remark },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, '更新失败') }, { status: 500 })
  }
}
