import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  MEMBER_TIER_RULES,
  getMemberTierRule,
  getNextMemberTierRule,
  getPointLedgerSummary,
} from '@/lib/points/ledger'

interface UserMetadata {
  full_name?: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const summary = await getPointLedgerSummary(supabase, user.id)
  const balance = summary.availablePoints
  const tierRule = getMemberTierRule(summary.totalPoints)
  const nextTierRule = getNextMemberTierRule(summary.totalPoints)

  // 从 profiles 表读取基本信息
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // 从 admin_roles 表读取管理员角色
  const { data: adminRole } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = (adminRole?.role as string) || 'user'
  const userMetadata = user.user_metadata as UserMetadata
  const displayName = profile?.full_name || userMetadata.full_name || user.email

  return NextResponse.json({
    balance,
    totalPoints: summary.totalPoints,
    tier: tierRule.code,
    tierLabel: tierRule.label,
    discountRate: tierRule.discountRate,
    discountLabel: tierRule.discountLabel,
    nextTier: nextTierRule
      ? {
          code: nextTierRule.code,
          label: nextTierRule.label,
          minPoints: nextTierRule.minPoints,
          pointsNeeded: Math.max(0, nextTierRule.minPoints - summary.totalPoints),
        }
      : null,
    tierRules: MEMBER_TIER_RULES,
    userId: user.id,
    displayName,
    role,
    isStaff: role === 'level2' || role === 'level1' || role === 'super',
    isAdmin: role === 'level1' || role === 'super',
    isSuper: role === 'super',
  })
}
