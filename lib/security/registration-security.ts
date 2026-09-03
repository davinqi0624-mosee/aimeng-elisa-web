import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestIp } from '@/lib/security/turnstile'

function digest(value: string) {
  return createHash('sha256').update(value || 'unknown').digest('hex')
}

export async function reserveRegistrationAttempt(request: NextRequest, email: string) {
  const admin = createAdminClient()
  const ipHash = digest(getRequestIp(request) || 'unknown-ip')
  const emailHash = digest(email.trim().toLowerCase())
  const { data, error } = await admin.rpc('reserve_registration_attempt', {
    p_ip_hash: ipHash,
    p_email_hash: emailHash,
  })
  if (error) {
    console.error('[registration-security] reserve failed', error.message)
    return { allowed: false, retryAfterSeconds: 60, reason: '注册安全服务暂不可用，请稍后重试' }
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed),
    retryAfterSeconds: Number(row?.retry_after_seconds || 0),
    reason: row?.reason || '注册请求过于频繁，请稍后重试',
  }
}
