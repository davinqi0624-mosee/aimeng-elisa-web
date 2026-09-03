import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, getClientIP } from '@/lib/admin/permissions'
import { logAudit, checkDailyPointsQuota, incrementDailyPointsQuota } from '@/lib/admin/audit'
import { getPointLedgerSummary, syncProfilePointTotals } from '@/lib/points/ledger'

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
    if (authError) return authError

    const supabase = await createClient()
    const body = await request.json()
    const { targetUserId, amount, reason } = body
    const pointAmount = Number(amount)

    if (!targetUserId || !Number.isFinite(pointAmount) || pointAmount <= 0) {
      return NextResponse.json({ error: '缺少目标用户或积分数量' }, { status: 400 })
    }

    // level2 单笔上限 500 分
    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (adminRole?.role === 'level2' && pointAmount > 500) {
      return NextResponse.json({ error: 'L2 管理员单笔积分发放上限为 500 分' }, { status: 403 })
    }

    // level2 单日上限 2000 分
    if (adminRole?.role === 'level2') {
      const quotaCheck = await checkDailyPointsQuota(user.id, pointAmount, 2000)
      if (!quotaCheck.allowed) {
        return NextResponse.json({ error: quotaCheck.message }, { status: 429 })
      }
    }

    const admin = createAdminClient()
    const currentSummary = await getPointLedgerSummary(admin, targetUserId)
    const { error: txError } = await admin.from('point_transactions').insert({
      user_id: targetUserId,
      amount: pointAmount,
      balance_after: currentSummary.availablePoints + pointAmount,
      type: 'earn',
      source: 'admin_award',
      description: reason || '管理员积分发放',
    })

    if (txError) throw txError

    await syncProfilePointTotals(admin, targetUserId)

    if (adminRole?.role === 'level2') {
      await incrementDailyPointsQuota(user.id, pointAmount)
    }

    await logAudit({
      admin_id: user.id,
      action: 'award_points',
      target_table: 'point_transactions',
      new_value: { target_user_id: targetUserId, amount: pointAmount, reason },
      reason: reason || '管理员积分发放',
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true, message: `已发放 ${pointAmount} 积分` })
  } catch (err: unknown) {
    console.error('Award points error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message || '发放失败' : '发放失败' }, { status: 500 })
  }
}
