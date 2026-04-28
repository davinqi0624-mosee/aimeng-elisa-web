import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type AdminRole = 'super' | 'level1' | 'level2' | null

export async function getAdminRole(): Promise<AdminRole> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  return (data?.role as AdminRole) || null
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: AdminRole[]
): Promise<{ user: any | null; error: NextResponse | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, error: NextResponse.json({ error: '未登录' }, { status: 401 }) }
  }

  const { data } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role = (data?.role as AdminRole) || null
  if (!role || !allowedRoles.includes(role)) {
    return {
      user: null,
      error: NextResponse.json({ error: '无权操作，权限不足' }, { status: 403 }),
    }
  }

  return { user, error: null }
}

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, error: NextResponse.json({ error: '未登录' }, { status: 401 }) }
  }
  return { user, error: null }
}

export async function checkPermission(
  action: string,
  resource: string,
  requiredRole: AdminRole[]
): Promise<boolean> {
  const role = await getAdminRole()
  if (!role) return false
  return requiredRole.includes(role)
}

// 获取客户端 IP
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP
  return '127.0.0.1'
}
