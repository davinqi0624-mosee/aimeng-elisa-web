import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'aimeng-elisa-admin-default-secret-key-2026'
)

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function shouldUseSecureAdminCookie() {
  if (process.env.ADMIN_COOKIE_SECURE === 'false') return false
  if (process.env.ADMIN_COOKIE_SECURE === 'true') return true
  return process.env.NODE_ENV === 'production'
}

export interface AdminPayload {
  id: string
  username: string
  role: 'super' | 'admin'
  display_name: string
  permissions: string[]
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signAdminToken(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 })
    return payload as unknown as AdminPayload
  } catch {
    return null
  }
}

export async function getAdminCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

export async function setAdminCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureAdminCookie(),
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearAdminCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getCurrentAdmin(): Promise<AdminPayload | null> {
  const token = await getAdminCookie()
  if (!token) return null
  const payload = await verifyAdminToken(token)
  if (!payload) return null
  return getActiveAdmin(payload.id)
}

// Middleware-style helpers for API routes
export async function requireAdminSession(req: NextRequest): Promise<{ admin: AdminPayload | null; error: NextResponse | null }> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return { admin: null, error: NextResponse.json({ error: '未登录' }, { status: 401 }) }
  }
  const admin = await verifyAdminToken(token)
  if (!admin) {
    return { admin: null, error: NextResponse.json({ error: '登录已过期' }, { status: 401 }) }
  }
  const activeAdmin = await getActiveAdmin(admin.id)
  if (!activeAdmin) {
    return { admin: null, error: NextResponse.json({ error: '账号不存在、已禁用或登录已过期，请重新登录' }, { status: 401 }) }
  }
  return { admin: activeAdmin, error: null }
}

async function getActiveAdmin(id: string): Promise<AdminPayload | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('admin_accounts')
      .select('id, username, role, display_name, is_active')
      .eq('id', id)
      .single()

    if (!data || !data.is_active) return null
    if (data.role !== 'super' && data.role !== 'admin') return null

    if (data.role === 'super') {
      return {
        id: data.id,
        username: data.username,
        role: data.role,
        display_name: data.display_name || data.username,
        permissions: [],
      }
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('admin_permissions')
      .select('permission_code')
      .eq('admin_id', data.id)
      .eq('is_allowed', true)

    if (permissionError) return null

    return {
      id: data.id,
      username: data.username,
      role: data.role,
      display_name: data.display_name || data.username,
      permissions: (permissionRows || []).map((row) => row.permission_code),
    }
  } catch {
    return null
  }
}

export async function requireSuper(req: NextRequest): Promise<{ admin: AdminPayload | null; error: NextResponse | null }> {
  const { admin, error } = await requireAdminSession(req)
  if (error) return { admin: null, error }
  if (admin!.role !== 'super') {
    return { admin: null, error: NextResponse.json({ error: '需要超级管理员权限' }, { status: 403 }) }
  }
  return { admin, error: null }
}

export async function requireAdminOrSuper(req: NextRequest): Promise<{ admin: AdminPayload | null; error: NextResponse | null }> {
  const { admin, error } = await requireAdminSession(req)
  if (error) return { admin: null, error }
  if (admin!.role !== 'super' && admin!.role !== 'admin') {
    return { admin: null, error: NextResponse.json({ error: '权限不足' }, { status: 403 }) }
  }
  return { admin, error: null }
}

export async function requireAdminPermission(
  req: NextRequest,
  permission: string
): Promise<{ admin: AdminPayload | null; error: NextResponse | null }> {
  const { admin, error } = await requireAdminSession(req)
  if (error) return { admin: null, error }

  if (admin!.role !== 'super' && !admin!.permissions.includes(permission)) {
    return {
      admin: null,
      error: NextResponse.json({ error: '当前管理员没有此项操作权限' }, { status: 403 }),
    }
  }

  return { admin, error: null }
}
