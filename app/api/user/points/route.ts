import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  // 计算积分余额
  const { data: ptData } = await supabase
    .from('point_transactions')
    .select('amount, type')
    .eq('user_id', user.id)

  const balance = (ptData || []).reduce((sum: number, tx: any) => {
    if (tx.type === 'earn') return sum + tx.amount
    if (tx.type === 'spend') return sum - tx.amount
    return sum
  }, 0)

  // 会员等级
  let tier = 'free'
  if (balance >= 5000) tier = 'platinum'
  else if (balance >= 2000) tier = 'gold'
  else if (balance >= 500) tier = 'silver'

  return NextResponse.json({
    balance,
    tier,
    userId: user.id,
    displayName: (user.user_metadata as any)?.full_name || user.email,
  })
}
