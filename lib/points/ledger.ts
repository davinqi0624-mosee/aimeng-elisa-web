import type { SupabaseClient } from '@supabase/supabase-js'

export type PointTransactionType = 'earn' | 'spend' | 'refund'

export interface PointTransactionRow {
  amount: number | null
  type: string | null
}

export interface PointLedgerSummary {
  availablePoints: number
  totalPoints: number
}

export type MemberTierCode = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface MemberTierRule {
  code: MemberTierCode
  label: string
  minPoints: number
  discountRate: number
  discountLabel: string
}

export const MEMBER_TIER_RULES: MemberTierRule[] = [
  { code: 'bronze', label: '青铜会员', minPoints: 0, discountRate: 1, discountLabel: '无折扣' },
  { code: 'silver', label: '白银会员', minPoints: 3500, discountRate: 0.95, discountLabel: '95折' },
  { code: 'gold', label: '黄金会员', minPoints: 8000, discountRate: 0.9, discountLabel: '9折' },
  { code: 'platinum', label: '铂金会员', minPoints: 15000, discountRate: 0.88, discountLabel: '88折' },
]

export function summarizePointTransactions(transactions: PointTransactionRow[]): PointLedgerSummary {
  return transactions.reduce<PointLedgerSummary>((summary, transaction) => {
    const amount = Number(transaction.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) return summary

    if (transaction.type === 'earn') {
      return {
        availablePoints: summary.availablePoints + amount,
        totalPoints: summary.totalPoints + amount,
      }
    }
    if (transaction.type === 'refund') {
      return {
        ...summary,
        availablePoints: summary.availablePoints + amount,
      }
    }
    if (transaction.type === 'spend') {
      return {
        ...summary,
        availablePoints: summary.availablePoints - amount,
      }
    }

    return summary
  }, { availablePoints: 0, totalPoints: 0 })
}

export async function getPointLedgerSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<PointLedgerSummary> {
  const { data, error } = await supabase
    .from('point_transactions')
    .select('amount, type')
    .eq('user_id', userId)

  if (error) throw new Error(`读取积分流水失败: ${error.message}`)

  return summarizePointTransactions((data || []) as PointTransactionRow[])
}

export async function syncProfilePointTotals(
  supabase: SupabaseClient,
  userId: string,
): Promise<PointLedgerSummary> {
  const summary = await getPointLedgerSummary(supabase, userId)
  const { error } = await supabase
    .from('profiles')
    .update({
      total_points: summary.totalPoints,
      available_points: summary.availablePoints,
    })
    .eq('id', userId)

  if (error) throw new Error(`同步用户积分余额失败: ${error.message}`)
  return summary
}

export function getTierByTotalPoints(totalPoints: number) {
  return getMemberTierRule(totalPoints).code
}

export function getMemberTierRule(totalPoints: number): MemberTierRule {
  const normalizedTotal = Math.max(0, Number(totalPoints) || 0)
  return [...MEMBER_TIER_RULES]
    .reverse()
    .find((tier) => normalizedTotal >= tier.minPoints) || MEMBER_TIER_RULES[0]
}

export function getNextMemberTierRule(totalPoints: number): MemberTierRule | null {
  const normalizedTotal = Math.max(0, Number(totalPoints) || 0)
  return MEMBER_TIER_RULES.find((tier) => normalizedTotal < tier.minPoints) || null
}

export function getDiscountedPointCost(pointsRequired: number, totalPoints: number) {
  const originalPoints = Math.max(0, Math.ceil(Number(pointsRequired) || 0))
  const tier = getMemberTierRule(totalPoints)
  const discountedPoints = Math.ceil(originalPoints * tier.discountRate)

  return {
    originalPoints,
    discountedPoints,
    savedPoints: Math.max(0, originalPoints - discountedPoints),
    discountRate: tier.discountRate,
    discountLabel: tier.discountLabel,
    tier: tier.code,
    tierLabel: tier.label,
  }
}
