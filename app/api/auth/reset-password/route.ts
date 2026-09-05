import { NextRequest, NextResponse } from 'next/server'
import { withService } from '@/lib/db/pg'
import { consumeAuthToken } from '@/lib/user-auth/tokens'
import {
  hashPassword,
  verifyPassword,
  signUserToken,
  setUserCookie,
  requireUser,
} from '@/lib/user-auth'

// 两种用法：
// 1) 令牌模式（邮件链接）：{ token, password } → 消费令牌、写新密码、自动登录
// 2) 登录态模式（修改密码 / 管理员设的初始密码）：{ currentPassword, password }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const password = typeof body.password === 'string' ? body.password : ''
    if (!password || password.length < 6) {
      return NextResponse.json({ error: '新密码至少需要6位字符' }, { status: 400 })
    }

    const token = typeof body.token === 'string' ? body.token : ''
    if (token) {
      const userId = await consumeAuthToken(token, 'password_reset')
      if (!userId) {
        return NextResponse.json({ error: '重置链接无效或已过期，请重新申请' }, { status: 400 })
      }
      const passwordHash = await hashPassword(password)
      const rows = await withService(async (tx) => {
        return tx<{ email: string }[]>`
          UPDATE app_users
          SET password_hash = ${passwordHash}, must_change_password = false, updated_at = now()
          WHERE id = ${userId} AND is_active
          RETURNING email
        `
      })
      if (!rows[0]) {
        return NextResponse.json({ error: '账号已被停用' }, { status: 403 })
      }
      const jwt = await signUserToken({ id: userId, email: rows[0].email })
      await setUserCookie(jwt)
      return NextResponse.json({ success: true, message: '密码已重置，已自动登录。' })
    }

    // 登录态修改密码
    const { user, error } = await requireUser(request)
    if (error) return error

    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    if (!currentPassword) {
      return NextResponse.json({ error: '请输入当前密码' }, { status: 400 })
    }

    const hashRows = await withService(async (tx) => {
      return tx<{ password_hash: string | null }[]>`
        SELECT password_hash FROM app_users WHERE id = ${user!.id} LIMIT 1
      `
    })
    const currentHash = hashRows[0]?.password_hash
    if (!currentHash || !(await verifyPassword(currentPassword, currentHash))) {
      return NextResponse.json({ error: '当前密码不正确' }, { status: 401 })
    }

    const passwordHash = await hashPassword(password)
    await withService(async (tx) => {
      await tx`
        UPDATE app_users
        SET password_hash = ${passwordHash}, must_change_password = false, updated_at = now()
        WHERE id = ${user!.id}
      `
    })

    return NextResponse.json({ success: true, message: '密码已更新。' })
  } catch (err: unknown) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: '请求失败，请稍后重试' }, { status: 500 })
  }
}
