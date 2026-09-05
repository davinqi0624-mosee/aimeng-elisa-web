import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { withService } from '@/lib/db/pg'
import { getRequestIp } from '@/lib/security/turnstile'

// 用户登录渐进锁定：复用 068 的 admin_login_security 表与 RPC（按哈希键控，
// 与管理员互不干扰）。progressive: 5 fails → 15min, 10 → 1h, 20 → 24h。
// fail-closed：RPC 不可用时拒绝登录。

function digest(value: string) {
  return createHash('sha256').update(value || 'unknown').digest('hex')
}

function keys(request: NextRequest, email: string) {
  return {
    emailHash: digest(email.trim().toLowerCase()),
    ipHash: digest(getRequestIp(request) || 'unknown-ip'),
  }
}

export async function checkUserLoginLock(request: NextRequest, email: string) {
  try {
    const { emailHash, ipHash } = keys(request, email)
    return await withService(async (tx) => {
      const rows = await tx<{ locked: boolean; retry_after_seconds: number }[]>`
        SELECT * FROM check_admin_login_lock(${emailHash}, ${ipHash})
      `
      const row = rows[0]
      return {
        locked: Boolean(row?.locked),
        retryAfterSeconds: Number(row?.retry_after_seconds || 0),
      }
    })
  } catch (error) {
    console.error('[user-login-security] check unavailable', error)
    return { locked: true, retryAfterSeconds: 60, error: '登录安全服务暂不可用，请稍后重试' }
  }
}

export async function recordUserLoginFailure(request: NextRequest, email: string) {
  try {
    const { emailHash, ipHash } = keys(request, email)
    await withService(async (tx) => {
      await tx`SELECT * FROM record_admin_login_failure(${emailHash}, ${ipHash})`
    })
  } catch (error) {
    console.error('[user-login-security] record failed', error)
  }
}

export async function clearUserLoginFailures(request: NextRequest, email: string) {
  try {
    const { emailHash, ipHash } = keys(request, email)
    await withService(async (tx) => {
      await tx`SELECT clear_admin_login_failures(${emailHash}, ${ipHash})`
    })
  } catch (error) {
    console.error('[user-login-security] clear failed', error)
  }
}
