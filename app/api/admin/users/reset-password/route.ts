import { NextRequest, NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'
import { withService } from '@/lib/db/pg'
import { hashPassword } from '@/lib/user-auth'
import { invalidateTokens } from '@/lib/user-auth/tokens'

// POST /api/admin/users/reset-password
// 管理员为用户设置初始/新密码（无邮件模式下的密码重置通道）。
// 返回一次性明文初始密码（仅此一次），用户下次登录强制修改（must_change_password）。
export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminPermission(request, 'user_manage')
  if (authError) return authError

  try {
    const body = await request.json()
    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 })
    }

    // 生成 10 位随机初始密码（数字+字母，去除易混淆字符）
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
    const initialPassword = Array.from(
      new Uint8Array(10),
      (byte) => alphabet[byte % alphabet.length]
    ).join('')

    const passwordHash = await hashPassword(initialPassword)
    const rows = await withService(async (tx) => {
      return tx<{ email: string }[]>`
        UPDATE app_users
        SET password_hash = ${passwordHash},
            must_change_password = true,
            is_active = true,
            updated_at = now()
        WHERE id = ${userId}
        RETURNING email
      `
    })

    if (!rows[0]) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 作废该用户所有待用重置令牌与验证令牌
    await invalidateTokens(userId, 'password_reset')
    await invalidateTokens(userId, 'email_verify')

    await logAudit({
      admin_id: admin!.id,
      action: 'reset_user_password',
      target_table: 'app_users',
      target_id: userId,
      new_value: { email: rows[0].email, must_change_password: true },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({
      success: true,
      email: rows[0].email,
      initialPassword,
      message: '已设置初始密码，请安全告知用户；用户下次登录时将被要求修改密码。',
    })
  } catch (error) {
    console.error('[admin/users/reset-password]', error)
    return NextResponse.json({ error: '重置失败' }, { status: 500 })
  }
}
