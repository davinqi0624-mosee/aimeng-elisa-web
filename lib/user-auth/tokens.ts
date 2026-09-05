import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { withService } from '@/lib/db/pg'

// 邮箱验证 / 密码重置令牌：明文只在邮件链接中出现，库中仅存 SHA-256 哈希；
// 单次有效（used_at），过期即失效。

export type TokenPurpose = 'email_verify' | 'password_reset'

const TTL_MINUTES: Record<TokenPurpose, number> = {
  email_verify: 60 * 24, // 24h
  password_reset: 30,
}

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url')
  return { raw, hash: hashToken(raw) }
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function createAuthToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const { raw, hash } = generateToken()
  const ttl = TTL_MINUTES[purpose]
  await withService(async (tx) => {
    await tx`
      INSERT INTO user_auth_tokens (user_id, token_hash, purpose, expires_at)
      VALUES (${userId}, ${hash}, ${purpose}, now() + (${ttl} || ' minutes')::interval)
    `
  })
  return raw
}

// 校验并消费令牌（原子：未过期 + 未使用 → 标记使用并返回 user_id）
export async function consumeAuthToken(raw: string, purpose: TokenPurpose): Promise<string | null> {
  const hash = hashToken(raw)
  return withService(async (tx) => {
    const rows = await tx<{ user_id: string }[]>`
      UPDATE user_auth_tokens
      SET used_at = now()
      WHERE token_hash = ${hash}
        AND purpose = ${purpose}
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING user_id
    `
    return rows[0]?.user_id ?? null
  })
}

// 使某用户某类令牌全部失效（发新重置邮件时作废旧链接）
export async function invalidateTokens(userId: string, purpose: TokenPurpose): Promise<void> {
  await withService(async (tx) => {
    await tx`
      UPDATE user_auth_tokens
      SET used_at = now()
      WHERE user_id = ${userId} AND purpose = ${purpose} AND used_at IS NULL
    `
  })
}
