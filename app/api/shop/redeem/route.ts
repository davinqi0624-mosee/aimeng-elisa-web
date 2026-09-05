import { getCurrentUser } from '@/lib/user-auth'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDiscountedPointCost, getPointLedgerSummary, syncProfilePointTotals } from '@/lib/points/ledger'

interface RedeemOrderRow {
  id: string
  points_spent: number
  status: string
  created_at: string
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  shipping_address?: string | null
  shipping_note?: string | null
  remark?: string | null
  shop_items?: { name?: string | null } | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeContactPayload(body: Record<string, unknown>, fallbackEmail?: string | null) {
  return {
    contact_name: cleanText(body.contactName),
    contact_phone: cleanText(body.contactPhone),
    contact_email: cleanText(body.contactEmail) || fallbackEmail || '',
    shipping_address: cleanText(body.shippingAddress),
    shipping_note: cleanText(body.shippingNote),
  }
}

function formatContactRemark(contact: ReturnType<typeof normalizeContactPayload>) {
  return [
    '客户收货信息：',
    `收件人：${contact.contact_name}`,
    `联系电话：${contact.contact_phone}`,
    `邮箱：${contact.contact_email}`,
    `收货地址：${contact.shipping_address}`,
    contact.shipping_note ? `备注：${contact.shipping_note}` : '',
  ].filter(Boolean).join('\n')
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

async function refundFailedRedeem(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  amount: number,
  currentBalance: number,
  sourceId: string,
  description: string,
) {
  const { error } = await admin.from('point_transactions').insert({
    user_id: userId,
    amount,
    type: 'refund',
    source: 'redeem_failed_refund',
    source_id: sourceId,
    source_table: 'shop_items',
    balance_after: currentBalance,
    description,
  })
  if (error) throw new Error(`兑换失败后自动退回积分失败: ${error.message}`)
  await syncProfilePointTotals(admin, userId)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('redeem_orders')
    .select('*, shop_items(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const orders = ((data || []) as RedeemOrderRow[]).map((row) => ({
    id: row.id,
    item_name: row.shop_items?.name || '未知商品',
    points_spent: row.points_spent,
    status: row.status,
    created_at: row.created_at,
    contact_name: row.contact_name || '',
    contact_phone: row.contact_phone || '',
    contact_email: row.contact_email || '',
    shipping_address: row.shipping_address || '',
    shipping_note: row.shipping_note || '',
    remark: row.remark || '',
  }))

  return NextResponse.json({ orders })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const supabase = createAdminClient()

    const body = await request.json()
    const { itemId } = body
    if (!itemId) return NextResponse.json({ error: '缺少商品ID' }, { status: 400 })
    const contact = normalizeContactPayload(body, user.email)
    if (!contact.contact_name) return NextResponse.json({ error: '请填写收件人姓名' }, { status: 400 })
    if (!contact.contact_phone) return NextResponse.json({ error: '请填写联系电话' }, { status: 400 })
    if (!contact.contact_email) return NextResponse.json({ error: '请填写接收发货通知的邮箱' }, { status: 400 })
    if (!contact.shipping_address) return NextResponse.json({ error: '请填写收货地址' }, { status: 400 })

    // 获取商品信息
    const { data: item, error: itemError } = await supabase
      .from('shop_items')
      .select('*')
      .eq('id', itemId)
      .eq('status', 'active')
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: '商品不存在或已下架' }, { status: 400 })
    }

    if (item.stock <= 0) {
      return NextResponse.json({ error: '商品库存不足' }, { status: 400 })
    }

    const ledger = await getPointLedgerSummary(supabase, user.id)
    const balance = ledger.availablePoints
    const cost = getDiscountedPointCost(item.points_required, ledger.totalPoints)

    if (balance < cost.discountedPoints) {
      return NextResponse.json({ error: `积分不足，需要 ${cost.discountedPoints} 积分，当前 ${balance} 积分` }, { status: 400 })
    }

    // 扣除积分
    const admin = createAdminClient()
    const remainingPoints = balance - cost.discountedPoints
    const { error: txError } = await admin.from('point_transactions').insert({
      user_id: user.id,
      amount: cost.discountedPoints,
      type: 'spend',
      source: 'redeem',
      source_id: itemId,
      source_table: 'shop_items',
      balance_after: remainingPoints,
      description: `兑换商品: ${item.name}（${cost.tierLabel}${cost.discountLabel}，原价${cost.originalPoints}积分，实扣${cost.discountedPoints}积分）`,
    })

    if (txError) throw txError

    // 创建兑换订单
    const orderPayload = {
      user_id: user.id,
      item_id: item.id,
      points_spent: cost.discountedPoints,
      status: 'pending',
      ...contact,
    }
    let { data: order, error: orderError } = await admin
      .from('redeem_orders')
      .insert(orderPayload)
      .select('id')
      .single()

    if (orderError && /column .* does not exist|schema cache/i.test(orderError.message || '')) {
      const fallbackResult = await admin
        .from('redeem_orders')
        .insert({
          user_id: user.id,
          item_id: item.id,
          points_spent: cost.discountedPoints,
          status: 'pending',
          remark: [
            formatContactRemark(contact),
            `会员折扣：${cost.tierLabel}${cost.discountLabel}，原价${cost.originalPoints}积分，实扣${cost.discountedPoints}积分。`,
          ].join('\n'),
        })
        .select('id')
        .single()
      order = fallbackResult.data
      orderError = fallbackResult.error
    }

    if (orderError) {
      await refundFailedRedeem(admin, user.id, cost.discountedPoints, balance, itemId, `兑换商品失败自动退款：${item.name}`)
      throw orderError
    }
    const orderId = order?.id
    if (!orderId) {
      await refundFailedRedeem(admin, user.id, cost.discountedPoints, balance, itemId, `兑换商品失败自动退款：${item.name}`)
      throw new Error('兑换订单创建失败，请稍后重试')
    }

    // 扣减库存
    const { error: stockError } = await admin
      .from('shop_items')
      .update({ stock: item.stock - 1 })
      .eq('id', itemId)

    if (stockError) {
      await admin
        .from('redeem_orders')
        .update({ status: 'cancelled', remark: '库存扣减失败，系统自动取消并退回积分。' })
        .eq('id', orderId)
      await refundFailedRedeem(admin, user.id, cost.discountedPoints, balance, itemId, `兑换库存扣减失败自动退款：${item.name}`)
      throw stockError
    }

    await syncProfilePointTotals(admin, user.id)

    return NextResponse.json({
      message: '兑换申请已提交，后台审核通过后工作人员会联系您确认发货信息。',
      orderId,
      remainingPoints,
      originalPoints: cost.originalPoints,
      pointsSpent: cost.discountedPoints,
      savedPoints: cost.savedPoints,
      memberTier: cost.tier,
      memberTierLabel: cost.tierLabel,
      discountLabel: cost.discountLabel,
    })
  } catch (err: unknown) {
    console.error('Redeem error:', err)
    return NextResponse.json({ error: errorMessage(err, '兑换失败') }, { status: 500 })
  }
}
