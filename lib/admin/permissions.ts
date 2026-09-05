import { NextRequest } from 'next/server'

// 旧 Supabase-RBAC（admin_roles + requireRole）已于 auth-decoupling 项目退役：
// 管理端鉴权统一走 lib/admin/auth.ts（admin_accounts + JWT 会话）。
// 本文件仅保留 getClientIP 工具函数。

// 获取客户端 IP
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP
  return '127.0.0.1'
}
