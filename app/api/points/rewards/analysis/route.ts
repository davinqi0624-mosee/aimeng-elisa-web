import { getCurrentUser } from '@/lib/user-auth'
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimPointReward, getBeijingDate } from '@/lib/points/rewards'

type NumericRow = { concentration?: unknown; od?: unknown }

function asNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function isMissingRewardFunction(message: string) {
  return /claim_point_reward|function .* does not exist|schema cache/i.test(message)
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const body = await request.json() as {
      rawInput?: unknown
      fitModel?: unknown
      r2?: unknown
      standards?: unknown
      samples?: unknown
    }
    const rawInput = typeof body.rawInput === 'string' ? body.rawInput.trim() : ''
    if (body.fitModel !== '4pl') return NextResponse.json({ error: '只有 4PL 拟合可以获得本项积分' }, { status: 400 })
    if (!rawInput || rawInput.length > 500_000) return NextResponse.json({ error: '分析数据无效' }, { status: 400 })

    const standards = Array.isArray(body.standards) ? body.standards as NumericRow[] : []
    const samples = Array.isArray(body.samples) ? body.samples as NumericRow[] : []
    const normalizedStandards = standards.map((row) => ({
      concentration: asNumber(row.concentration),
      od: asNumber(row.od),
    }))
    const normalizedSamples = samples.map((row) => ({ od: asNumber(row.od) }))
    const distinctConcentrations = new Set(
      normalizedStandards
        .filter((row) => row.concentration !== null)
        .map((row) => row.concentration),
    )
    const validStandardData = normalizedStandards.length >= 4 &&
      distinctConcentrations.size >= 4 &&
      normalizedStandards.every((row) => row.concentration !== null && row.concentration >= 0 && row.od !== null && row.od >= 0 && row.od <= 4)
    const validSampleData = normalizedSamples.length > 0 &&
      normalizedSamples.length <= 1000 &&
      normalizedSamples.every((row) => row.od !== null && row.od >= 0 && row.od <= 4)
    const r2 = asNumber(body.r2)

    if (!validStandardData || !validSampleData || r2 === null || r2 < 0 || r2 > 1.000001) {
      return NextResponse.json({ awarded: false, message: '本次数据未达到有效 4PL 分析奖励条件。' }, { status: 200 })
    }

    const canonicalData = JSON.stringify({
      rawInput,
      standards: normalizedStandards,
      samples: normalizedSamples,
      r2: Number(r2.toFixed(8)),
    })
    const dataFingerprint = createHash('sha256').update(canonicalData).digest('hex')
    const result = await claimPointReward(createAdminClient(), {
      userId: user.id,
      rewardType: 'analysis_4pl',
      rewardDate: getBeijingDate(),
      amount: 2,
      dataFingerprint,
      metadata: {
        standardCount: normalizedStandards.length,
        sampleCount: normalizedSamples.length,
        r2: Number(r2.toFixed(6)),
      },
    })

    return NextResponse.json({
      success: true,
      awarded: result.awarded,
      balance: result.balance,
      message: result.awarded ? '本次 4PL 分析有效，获得 2 积分。' : '今日 4PL 分析奖励已领取，继续计算不受影响。',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '4PL 奖励处理失败'
    if (isMissingRewardFunction(message)) {
      return NextResponse.json({ error: '4PL 积分功能尚未初始化，请先执行 067_point_rewards_checkin_and_analysis.sql' }, { status: 503 })
    }
    console.error('[points/rewards/analysis]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
