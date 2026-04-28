import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { data, error } = await supabase
    .from('redeem_orders')
    .select('*, shop_items(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const orders = (data || []).map((row: any) => ({
    id: row.id,
    item_name: row.shop_items?.name || '未知商品',
    points_spent: row.points_spent,
    status: row.status,
    created_at: row.created_at,
  }))

  return NextResponse.json({ orders })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const body = await request.json()
    const { itemId } = body
    if (!itemId) return NextResponse.json({ error: '缺少商品ID' }, { status: 400 })

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

    // 计算用户当前积分余额
    const { data: ptData } = await supabase
      .from('point_transactions')
      .select('amount, type')
      .eq('user_id', user.id)

    const balance = (ptData || []).reduce((sum: number, tx: any) => {
      if (tx.type === 'earn') return sum + tx.amount
      if (tx.type === 'spend') return sum - tx.amount
      return sum
    }, 0)

    if (balance < item.points_required) {
      return NextResponse.json({ error: `积分不足，需要 ${item.points_required} 积分，当前 ${balance} 积分` }, { status: 400 })
    }

    // 扣除积分
    const { error: txError } = await supabase.from('point_transactions').insert({
      user_id: user.id,
      amount: item.points_required,
      type: 'spend',
      source: 'redeem',
      source_id: itemId,
      description: `兑换商品: ${item.name}`,
    })

    if (txError) throw txError

    // 创建兑换订单
    const { data: order, error: orderError } = await supabase
      .from('redeem_orders')
      .insert({
        user_id: user.id,
        item_id: item.id,
        points_spent: item.points_required,
        status: 'pending',
      })
      .select('id')
      .single()

    if (orderError) throw orderError

    // 扣减库存
    const { error: stockError } = await supabase
      .from('shop_items')
      .update({ stock: item.stock - 1 })
      .eq('id', itemId)

    if (stockError) throw stockError

    return NextResponse.json({
      message: '兑换成功',
      orderId: order.id,
      remainingPoints: balance - item.points_required,
    })
  } catch (err: any) {
    console.error('Redeem error:', err)
    return NextResponse.json({ error: err.message || '兑换失败' }, { status: 500 })
  }
}
