import type { SupabaseClient } from '@supabase/supabase-js'

export type PointRewardType = 'daily_checkin' | 'analysis_4pl'

export function getBeijingDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function claimPointReward(
  supabase: SupabaseClient,
  input: {
    userId: string
    rewardType: PointRewardType
    rewardDate: string
    amount: number
    dataFingerprint?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const { data, error } = await supabase.rpc('claim_point_reward', {
    p_user_id: input.userId,
    p_reward_type: input.rewardType,
    p_reward_date: input.rewardDate,
    p_amount: input.amount,
    p_data_fingerprint: input.dataFingerprint || null,
    p_metadata: input.metadata || {},
  })

  if (error) throw new Error(error.message)

  const row = Array.isArray(data) ? data[0] : data
  return {
    awarded: Boolean(row?.awarded),
    claimId: typeof row?.claim_id === 'string' ? row.claim_id : null,
    balance: Number(row?.balance || 0),
  }
}
