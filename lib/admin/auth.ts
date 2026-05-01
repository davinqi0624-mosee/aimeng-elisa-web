import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'aimeng-elisa-admin-default-secret-key-2026'
)

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface AdminPayload {
  id: string
  username: string
  role: 'super' | 'admin'
  display_name: string
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
    secure: process.env.NODE_ENV === 'production',
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
  return verifyAdminToken(token)
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
  return { admin, error: null }
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
