import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestIp } from '@/lib/security/turnstile'

export type AiUsageDecision = {
  allowed: boolean
  retryAfterSeconds: number
  reason?: string
}

function hash(value: string) {
  return createHash('sha256').update(value || 'unknown').digest('hex')
}

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function limits() {
  return {
    ipTenMinute: toPositiveInt(process.env.AI_IP_10M_LIMIT, 12),
    ipDay: toPositiveInt(process.env.AI_IP_DAY_LIMIT, 60),
    userTenMinute: toPositiveInt(process.env.AI_USER_10M_LIMIT, 8),
    userDay: toPositiveInt(process.env.AI_USER_DAY_LIMIT, 30),
    anonymousDay: toPositiveInt(process.env.AI_ANONYMOUS_DAY_LIMIT, 10),
    globalDay: toPositiveInt(process.env.AI_GLOBAL_DAY_LIMIT, 500),
  }
}

export async function reserveAiRequest(
  request: NextRequest,
  userId: string | null,
  estimatedTokens: number,
): Promise<AiUsageDecision> {
  const ipHash = hash(getRequestIp(request) || 'unknown-ip')
  const safeTokens = Math.max(1, Math.min(Math.floor(estimatedTokens), 5000))
  const configured = limits()

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('reserve_ai_request', {
      p_ip_hash: ipHash,
      p_user_id: userId,
      p_estimated_tokens: safeTokens,
      p_ip_10m_limit: configured.ipTenMinute,
      p_ip_day_limit: configured.ipDay,
      p_user_10m_limit: configured.userTenMinute,
      p_user_day_limit: configured.userDay,
      p_anonymous_day_limit: configured.anonymousDay,
      p_global_day_limit: configured.globalDay,
    })

    if (error) {
      console.error('[ai/usage] reserve failed', error.message)
      return { allowed: false, retryAfterSeconds: 60, reason: 'AI 安全额度服务暂不可用，请稍后重试' }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Number(row?.retry_after_seconds || 60)),
        reason: row?.reason || 'AI 使用频率已达到安全上限，请稍后再试',
      }
    }

    return { allowed: true, retryAfterSeconds: 0 }
  } catch (error) {
    console.error('[ai/usage] unavailable', error)
    return { allowed: false, retryAfterSeconds: 60, reason: 'AI 安全额度服务暂不可用，请稍后重试' }
  }
}

export function estimateAiTokens(messages: Array<{ content?: unknown }>) {
  const chars = messages.reduce((total, message) => total + (typeof message.content === 'string' ? message.content.length : 0), 0)
  return Math.max(200, Math.ceil(chars / 2.5) + 600)
}
