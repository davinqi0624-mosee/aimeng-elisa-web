import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { consumeAuthToken } from '@/lib/user-auth/tokens'
import { awardRegistrationBonus } from '@/lib/points/registration-bonus'
import { withService } from '@/lib/db/pg'

// 邮箱验证落地页：/auth/verify?token=...
// 成功 → 标记已验证 + 发放 50 积分（幂等）→ 跳登录页带提示；失败 → 登录页带错误提示。
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || ''
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/login?auth_error=missing_token`)
  }

  try {
    const userId = await consumeAuthToken(token, 'email_verify')
    if (!userId) {
      return NextResponse.redirect(`${siteUrl}/login?auth_error=invalid_token`)
    }

    await withService(async (tx) => {
      await tx`
        UPDATE app_users
        SET email_verified_at = COALESCE(email_verified_at, now()), must_change_password = false
        WHERE id = ${userId}
      `
    })

    // 幂等：唯一索引 idx_point_transactions_unique_registration_bonus 兜底
    await awardRegistrationBonus(createAdminClient(), userId)

    return NextResponse.redirect(`${siteUrl}/login?verified=1`)
  } catch (error) {
    console.error('[auth/verify] failed', error)
    return NextResponse.redirect(`${siteUrl}/login?auth_error=server_error`)
  }
}
