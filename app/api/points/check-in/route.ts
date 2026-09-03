import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimPointReward, getBeijingDate } from '@/lib/points/rewards'

function isMissingRewardFunction(message: string) {
  return /claim_point_reward|function .* does not exist|schema cache/i.test(message)
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const result = await claimPointReward(createAdminClient(), {
      userId: user.id,
      rewardType: 'daily_checkin',
      rewardDate: getBeijingDate(),
      amount: 1,
      metadata: { source: 'authenticated_session' },
    })

    return NextResponse.json({
      success: true,
      awarded: result.awarded,
      balance: result.balance,
      message: result.awarded ? '今日登录签到成功，获得 1 积分。' : '今日登录签到奖励已领取。',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '签到失败'
    if (isMissingRewardFunction(message)) {
      return NextResponse.json({ error: '签到积分功能尚未初始化，请先执行 067_point_rewards_checkin_and_analysis.sql' }, { status: 503 })
    }
    console.error('[points/check-in]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
