import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit, checkDailyPointsQuota, incrementDailyPointsQuota } from '@/lib/admin/audit'
import { getPointLedgerSummary, syncProfilePointTotals } from '@/lib/points/ledger'

export async function POST(request: NextRequest) {
  try {
    const { admin: sessionAdmin, error: authError } = await requireAdminOrSuper(request)
    if (authError) return authError

    const body = await request.json()
    const { targetUserId, amount, reason } = body
    const pointAmount = Number(amount)

    if (!targetUserId || !Number.isFinite(pointAmount) || pointAmount <= 0) {
      return NextResponse.json({ error: '缺少目标用户或积分数量' }, { status: 400 })
    }

    // 普通管理员单笔上限 500、单日上限 2000（super 不限）
    if (sessionAdmin!.role !== 'super') {
      if (pointAmount > 500) {
        return NextResponse.json({ error: '管理员单笔积分发放上限为 500 分' }, { status: 403 })
      }
      const quotaCheck = await checkDailyPointsQuota(sessionAdmin!.id, pointAmount, 2000)
      if (!quotaCheck.allowed) {
        return NextResponse.json({ error: quotaCheck.message }, { status: 429 })
      }
    }

    const supabase = createAdminClient()
    const currentSummary = await getPointLedgerSummary(supabase, targetUserId)
    const { error: txError } = await supabase.from('point_transactions').insert({
      user_id: targetUserId,
      amount: pointAmount,
      balance_after: currentSummary.availablePoints + pointAmount,
      type: 'earn',
      source: 'admin_award',
      description: reason || '管理员积分发放',
    })

    if (txError) throw txError

    await syncProfilePointTotals(supabase, targetUserId)

    if (sessionAdmin!.role !== 'super') {
      await incrementDailyPointsQuota(sessionAdmin!.id, pointAmount)
    }

    await logAudit({
      admin_id: sessionAdmin!.id,
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
