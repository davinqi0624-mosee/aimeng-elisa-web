import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestIp } from '@/lib/security/turnstile'

function digest(value: string) {
  return createHash('sha256').update(value || 'unknown').digest('hex')
}

function keys(request: NextRequest, username: string) {
  return {
    usernameHash: digest(username.trim().toLowerCase()),
    ipHash: digest(getRequestIp(request) || 'unknown-ip'),
  }
}

export async function checkAdminLoginLock(request: NextRequest, username: string) {
  try {
    const admin = createAdminClient()
    const { usernameHash, ipHash } = keys(request, username)
    const { data, error } = await admin.rpc('check_admin_login_lock', {
      p_username_hash: usernameHash,
      p_ip_hash: ipHash,
    })
    if (error) {
      console.error('[admin/login-security] check failed', error.message)
      return { locked: true, retryAfterSeconds: 60, error: '登录安全服务暂不可用，请稍后重试' }
    }
    const row = Array.isArray(data) ? data[0] : data
    return { locked: Boolean(row?.locked), retryAfterSeconds: Number(row?.retry_after_seconds || 0) }
  } catch (error) {
    console.error('[admin/login-security] check unavailable', error)
    return { locked: true, retryAfterSeconds: 60, error: '登录安全服务暂不可用，请稍后重试' }
  }
}

export async function recordAdminLoginFailure(request: NextRequest, username: string) {
  const admin = createAdminClient()
  const { usernameHash, ipHash } = keys(request, username)
  const { data, error } = await admin.rpc('record_admin_login_failure', {
    p_username_hash: usernameHash,
    p_ip_hash: ipHash,
  })
  if (error) {
    console.error('[admin/login-security] record failed', error.message)
    return { retryAfterSeconds: 0 }
  }
  const row = Array.isArray(data) ? data[0] : data
  return { retryAfterSeconds: Number(row?.retry_after_seconds || 0) }
}

export async function clearAdminLoginFailures(request: NextRequest, username: string) {
  try {
    const admin = createAdminClient()
    const { usernameHash, ipHash } = keys(request, username)
    await admin.rpc('clear_admin_login_failures', {
      p_username_hash: usernameHash,
      p_ip_hash: ipHash,
    })
  } catch (error) {
    console.error('[admin/login-security] clear failed', error)
  }
}
