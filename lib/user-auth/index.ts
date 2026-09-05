import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import { NextResponse as NR } from 'next/server'
import { withService } from '@/lib/db/pg'
import { hashPassword, verifyPassword } from '@/lib/admin/auth'

// 自建用户会话（模式沿用 lib/admin/auth.ts）：
// jose HS256 + httpOnly cookie + 每请求查库复核 is_active。USER_JWT_SECRET fail-closed：
// 未配置时无法登录（签发抛错），已有令牌按未登录处理（Vercel 预览即此形态）。

function getJwtSecret(): Uint8Array {
  const secret = process.env.USER_JWT_SECRET
  if (!secret) {
    throw new Error('USER_JWT_SECRET 未配置，用户登录/鉴权已禁用（fail-closed）。')
  }
  return new TextEncoder().encode(secret)
}

const COOKIE_NAME = 'user_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function shouldUseSecureCookie() {
  if (process.env.USER_COOKIE_SECURE === 'false') return false
  if (process.env.USER_COOKIE_SECURE === 'true') return true
  return process.env.NODE_ENV === 'production'
}

export { hashPassword, verifyPassword }

export interface UserPayload {
  id: string
  email: string
}

// 与旧 Supabase auth.getUser() 返回形状兼容（id / email / user_metadata.full_name），
// 便于调用点机械替换；新增 email_verified_at / must_change_password 供流程判断。
export type CurrentUser = {
  id: string
  email: string
  email_verified_at: string | null
  must_change_password: boolean
  user_metadata: {
    full_name: string | null
    organization: string | null
    phone: string | null
  }
}

export async function signUserToken(payload: UserPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret())
}

export async function verifyUserToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { clockTolerance: 60 })
    const id = typeof payload.sub === 'string' ? payload.sub : ''
    if (!id) return null
    return { id, email: typeof payload.email === 'string' ? payload.email : '' }
  } catch {
    return null
  }
}

export async function getUserCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

export async function setUserCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearUserCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

async function getActiveUser(id: string): Promise<CurrentUser | null> {
  try {
    return await withService(async (tx) => {
      const rows = await tx<AppUserRow[]>`
        SELECT id, email, full_name, organization, phone, email_verified_at, must_change_password
        FROM app_users WHERE id = ${id} AND is_active LIMIT 1
      `
      const row = rows[0]
      if (!row) return null
      return toCurrentUser(row)
    })
  } catch (error) {
    console.error('[user-auth] getActiveUser failed', error)
    return null
  }
}

type AppUserRow = {
  id: string
  email: string
  full_name: string | null
  organization: string | null
  phone: string | null
  email_verified_at: Date | string | null
  must_change_password: boolean
}

function toCurrentUser(row: AppUserRow): CurrentUser {
  return {
    id: row.id,
    email: row.email,
    email_verified_at: row.email_verified_at ? new Date(row.email_verified_at).toISOString() : null,
    must_change_password: Boolean(row.must_change_password),
    user_metadata: {
      full_name: row.full_name,
      organization: row.organization,
      phone: row.phone,
    },
  }
}

// 服务端组件 / 路由通用：读取当前用户（未登录 / 令牌无效 / 服务禁用 → null）
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getUserCookie()
  if (!token) return null
  const payload = await verifyUserToken(token)
  if (!payload) return null
  return getActiveUser(payload.id)
}

export async function requireUser(
  req: NextRequest
): Promise<{ user: CurrentUser | null; error: NextResponse | null }> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return { user: null, error: NR.json({ error: '请先登录' }, { status: 401 }) }
  }
  const payload = await verifyUserToken(token)
  if (!payload) {
    return { user: null, error: NR.json({ error: '登录已过期，请重新登录' }, { status: 401 }) }
  }
  const user = await getActiveUser(payload.id)
  if (!user) {
    return { user: null, error: NR.json({ error: '账号不存在、已禁用或登录已过期，请重新登录' }, { status: 401 }) }
  }
  return { user, error: null }
}
