import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, getClientIP } from '@/lib/admin/permissions'
import { logAudit, checkDailyPointsQuota, incrementDailyPointsQuota } from '@/lib/admin/audit'

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
    if (authError) return authError

    const supabase = await createClient()
    const body = await request.json()
    const { targetUserId, amount, reason } = body

    if (!targetUserId || !amount || amount <= 0) {
      return NextResponse.json({ error: '缺少目标用户或积分数量' }, { status: 400 })
    }

    // level2 单笔上限 500 分
    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (adminRole?.role === 'level2' && amount > 500) {
      return NextResponse.json({ error: 'L2 管理员单笔积分发放上限为 500 分' }, { status: 403 })
    }

    // level2 单日上限 2000 分
    if (adminRole?.role === 'level2') {
      const quotaCheck = await checkDailyPointsQuota(user.id, amount, 2000)
      if (!quotaCheck.allowed) {
        return NextResponse.json({ error: quotaCheck.message }, { status: 429 })
      }
    }

    const { error: txError } = await supabase.from('point_transactions').insert({
      user_id: targetUserId,
      amount,
      type: 'earn',
      source: 'admin_award',
      description: reason || '管理员积分发放',
    })

    if (txError) throw txError

    if (adminRole?.role === 'level2') {
      await incrementDailyPointsQuota(user.id, amount)
    }

    await logAudit({
      admin_id: user.id,
      action: 'award_points',
      target_table: 'point_transactions',
      new_value: { target_user_id: targetUserId, amount, reason },
      reason: reason || '管理员积分发放',
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true, message: `已发放 ${amount} 积分` })
  } catch (err: any) {
    console.error('Award points error:', err)
    return NextResponse.json({ error: err.message || '发放失败' }, { status: 500 })
  }
}
