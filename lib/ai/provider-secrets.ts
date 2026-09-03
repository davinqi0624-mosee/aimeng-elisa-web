import 'server-only'

import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasRealEnvValue, type AiProvider } from '@/lib/ai/model-settings'

export type AiSecretProvider = AiProvider | 'openai'

export type AiProviderSecretInput = {
  provider: AiSecretProvider
  apiKey?: string
  baseURL?: string
  model?: string
  clearKey?: boolean
}

export type AiProviderSecretStatus = {
  provider: AiSecretProvider
  label: string
  keyExists: boolean
  keySource: 'database' | 'environment' | 'missing'
  keyTail?: string
  baseURL: string
  model: string
  updatedAt?: string
}

type StoredProviderSecret = {
  encryptedApiKey?: string
  keyTail?: string
  baseURL?: string
  model?: string
  updatedAt?: string
}

type StoredSecrets = Partial<Record<AiSecretProvider, StoredProviderSecret>>

const CACHE_TTL_MS = 30_000
let cachedSecrets: { value: StoredSecrets; expiresAt: number } | null = null

const PROVIDER_LABELS: Record<AiSecretProvider, string> = {
  deepseek: 'DeepSeek',
  kimi: 'Kimi K3',
  openai: 'OpenAI Embedding',
}

const DEFAULT_BASE_URLS: Record<AiSecretProvider, string> = {
  deepseek: 'https://api.deepseek.com',
  kimi: 'https://api.moonshot.cn/v1',
  openai: 'https://api.openai.com/v1',
}

const DEFAULT_MODELS: Record<AiSecretProvider, string> = {
  deepseek: 'deepseek-v4-flash',
  kimi: 'kimi-k3',
  openai: 'text-embedding-3-small',
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getEncryptionSecret() {
  return clean(process.env.AI_CREDENTIALS_ENCRYPTION_KEY) || clean(process.env.ADMIN_JWT_SECRET)
}

function getEncryptionKey() {
  const secret = getEncryptionSecret()
  if (!hasRealEnvValue(secret)) {
    throw new Error('AI_CREDENTIALS_ENCRYPTION_KEY_MISSING')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

function encryptText(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

function decryptText(value: string) {
  const parts = value.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('AI_CREDENTIAL_FORMAT_INVALID')
  }

  const [, ivText, tagText, encryptedText] = parts
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivText, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

function keyTail(value: string) {
  return value.slice(-6)
}

function getEnvKey(provider: AiSecretProvider) {
  if (provider === 'kimi') return process.env.KIMI_API_KEY
  if (provider === 'openai') return process.env.OPENAI_API_KEY
  return process.env.DEEPSEEK_API_KEY
}

function getEnvBaseURL(provider: AiSecretProvider) {
  if (provider === 'kimi') return process.env.KIMI_BASE_URL
  if (provider === 'openai') return process.env.OPENAI_BASE_URL
  return process.env.DEEPSEEK_BASE_URL
}

function getEnvModel(provider: AiSecretProvider) {
  if (provider === 'kimi') return process.env.KIMI_CHAT_MODEL
  if (provider === 'openai') return process.env.OPENAI_EMBED_MODEL
  return process.env.DEEPSEEK_CHAT_MODEL
}

function normalizeStoredSecrets(value: unknown): StoredSecrets {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  const result: StoredSecrets = {}

  for (const provider of ['deepseek', 'kimi', 'openai'] as AiSecretProvider[]) {
    const item = record[provider]
    if (!item || typeof item !== 'object') continue
    const stored = item as StoredProviderSecret
    result[provider] = {
      encryptedApiKey: clean(stored.encryptedApiKey) || undefined,
      keyTail: clean(stored.keyTail) || undefined,
      baseURL: clean(stored.baseURL) || undefined,
      model: clean(stored.model) || undefined,
      updatedAt: clean(stored.updatedAt) || undefined,
    }
  }

  return result
}

export function clearAiProviderSecretsCache() {
  cachedSecrets = null
}

export async function getStoredAiProviderSecrets(options?: { refresh?: boolean }) {
  if (!options?.refresh && cachedSecrets && cachedSecrets.expiresAt > Date.now()) {
    return cachedSecrets.value
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('site_settings')
      .select('ai_provider_secrets')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      if (!error.message.includes('ai_provider_secrets')) {
        console.warn('[ai-provider-secrets] load failed:', error.message)
      }
      return {}
    }

    const value = normalizeStoredSecrets(data?.ai_provider_secrets)
    cachedSecrets = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  } catch (error) {
    console.warn('[ai-provider-secrets] using env only:', error instanceof Error ? error.message : error)
    return {}
  }
}

export async function getAiProviderSecretStatuses(): Promise<AiProviderSecretStatus[]> {
  const stored = await getStoredAiProviderSecrets({ refresh: true })

  return (['deepseek', 'kimi', 'openai'] as AiSecretProvider[]).map((provider) => {
    const storedProvider = stored[provider]
    const envKey = getEnvKey(provider)
    const hasDbKey = Boolean(storedProvider?.encryptedApiKey)
    const hasEnvKey = hasRealEnvValue(envKey)
    const baseURL = storedProvider?.baseURL || getEnvBaseURL(provider) || DEFAULT_BASE_URLS[provider]
    const model = storedProvider?.model || getEnvModel(provider) || DEFAULT_MODELS[provider]

    return {
      provider,
      label: PROVIDER_LABELS[provider],
      keyExists: hasDbKey || hasEnvKey,
      keySource: hasDbKey ? 'database' : hasEnvKey ? 'environment' : 'missing',
      keyTail: hasDbKey ? storedProvider?.keyTail : hasEnvKey ? keyTail(envKey || '') : undefined,
      baseURL,
      model,
      updatedAt: storedProvider?.updatedAt,
    }
  })
}

export async function getAiProviderCredential(provider: AiSecretProvider) {
  const stored = await getStoredAiProviderSecrets()
  const storedProvider = stored[provider]
  const baseURL = storedProvider?.baseURL || getEnvBaseURL(provider) || DEFAULT_BASE_URLS[provider]
  const model = storedProvider?.model || getEnvModel(provider) || DEFAULT_MODELS[provider]

  if (storedProvider?.encryptedApiKey) {
    return {
      apiKey: decryptText(storedProvider.encryptedApiKey),
      baseURL,
      model,
      source: 'database' as const,
    }
  }

  return {
    apiKey: getEnvKey(provider) || '',
    baseURL,
    model,
    source: 'environment' as const,
  }
}

export async function updateAiProviderSecret(input: AiProviderSecretInput) {
  const provider = input.provider
  const supabase = createAdminClient()
  const stored = await getStoredAiProviderSecrets({ refresh: true })
  const previous = stored[provider] || {}
  const apiKey = clean(input.apiKey)
  const baseURL = clean(input.baseURL)
  const model = clean(input.model)

  const next: StoredProviderSecret = {
    ...previous,
    baseURL: baseURL || previous.baseURL || undefined,
    model: model || previous.model || undefined,
    updatedAt: new Date().toISOString(),
  }

  if (input.clearKey) {
    delete next.encryptedApiKey
    delete next.keyTail
  } else if (apiKey) {
    next.encryptedApiKey = encryptText(apiKey)
    next.keyTail = keyTail(apiKey)
  }

  const nextSecrets: StoredSecrets = {
    ...stored,
    [provider]: next,
  }

  const { error } = await supabase
    .from('site_settings')
    .upsert({ id: 1, ai_provider_secrets: nextSecrets, updated_at: new Date().toISOString() }, { onConflict: 'id' })

  if (error) {
    if (error.message.includes('ai_provider_secrets')) {
      throw new Error('AI 密钥管理表结构尚未初始化，请先执行 supabase/migrations/061_ai_provider_secrets.sql。')
    }
    throw new Error(error.message)
  }

  clearAiProviderSecretsCache()
  return {
    provider,
    oldTail: previous.keyTail,
    newTail: next.keyTail,
    keyChanged: input.clearKey || Boolean(apiKey),
    baseURLChanged: baseURL ? baseURL !== previous.baseURL : false,
    modelChanged: model ? model !== previous.model : false,
  }
}
