import type { SupabaseClient } from '@supabase/supabase-js'
import { getPointLedgerSummary, syncProfilePointTotals } from '@/lib/points/ledger'

export const REGISTRATION_BONUS_POINTS = 50

function isDuplicateBonusError(message?: string) {
  return /duplicate key|unique constraint|idx_point_transactions_unique_registration_bonus/i.test(message || '')
}

export async function awardRegistrationBonus(admin: SupabaseClient, userId: string) {
  const { data: existingBonus, error: existingError } = await admin
    .from('point_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'registration_bonus')
    .eq('source_table', 'profiles')
    .eq('source_id', userId)
    .eq('type', 'earn')
    .maybeSingle()

  if (existingError) throw new Error(`检查注册奖励失败: ${existingError.message}`)
  if (existingBonus) return false

  const summary = await getPointLedgerSummary(admin, userId)
  const { error: bonusError } = await admin.from('point_transactions').insert({
    user_id: userId,
    amount: REGISTRATION_BONUS_POINTS,
    type: 'earn',
    source: 'registration_bonus',
    source_id: userId,
    source_table: 'profiles',
    balance_after: summary.availablePoints + REGISTRATION_BONUS_POINTS,
    description: '注册会员赠送积分（邮箱验证后发放）',
  })

  if (bonusError) {
    if (isDuplicateBonusError(bonusError.message)) return false
    throw new Error(`发放注册奖励失败: ${bonusError.message}`)
  }

  await syncProfilePointTotals(admin, userId)
  return true
}
