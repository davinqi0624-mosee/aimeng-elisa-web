import { createAdminClient } from '@/lib/supabase/admin'

export type AiProvider = 'deepseek' | 'kimi'
export type AiTask = 'chat' | 'longform' | 'protocol' | 'datasheet'

export type AiModelSettings = {
  default_chat_provider: AiProvider
  longform_provider: AiProvider
  protocol_provider: AiProvider
  datasheet_provider: AiProvider
  fallback_enabled: boolean
}

const CACHE_TTL_MS = 30_000
let cachedSettings: { value: AiModelSettings; expiresAt: number } | null = null

export function normalizeProvider(value: unknown, fallback: AiProvider): AiProvider {
  return value === 'kimi' || value === 'deepseek' ? value : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export function getEnvAiModelSettings(): AiModelSettings {
  return {
    default_chat_provider: normalizeProvider(process.env.AI_DEFAULT_CHAT_PROVIDER, 'deepseek'),
    longform_provider: normalizeProvider(process.env.AI_LONGFORM_PROVIDER, 'kimi'),
    protocol_provider: normalizeProvider(process.env.AI_PROTOCOL_PROVIDER, 'kimi'),
    datasheet_provider: normalizeProvider(process.env.AI_DATASHEET_PROVIDER, 'kimi'),
    fallback_enabled: process.env.AI_ENABLE_KIMI_FALLBACK !== 'false',
  }
}

export function normalizeAiModelSettings(value: unknown): AiModelSettings {
  const defaults = getEnvAiModelSettings()
  if (!value || typeof value !== 'object') return defaults

  const settings = value as Partial<AiModelSettings>
  return {
    default_chat_provider: normalizeProvider(settings.default_chat_provider, defaults.default_chat_provider),
    longform_provider: normalizeProvider(settings.longform_provider, defaults.longform_provider),
    protocol_provider: normalizeProvider(settings.protocol_provider, defaults.protocol_provider),
    datasheet_provider: normalizeProvider(settings.datasheet_provider, defaults.datasheet_provider),
    fallback_enabled: normalizeBoolean(settings.fallback_enabled, defaults.fallback_enabled),
  }
}

export function getProviderForAiTask(settings: AiModelSettings, task?: AiTask): AiProvider {
  if (task === 'longform') return settings.longform_provider
  if (task === 'protocol') return settings.protocol_provider
  if (task === 'datasheet') return settings.datasheet_provider
  return settings.default_chat_provider
}

export function clearAiModelSettingsCache() {
  cachedSettings = null
}

function canReadDatabaseSettings() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function isMissingAiModelsColumn(message?: string) {
  return Boolean(
    message?.includes('site_settings') &&
      (message.includes('schema cache') || message.includes('does not exist') || message.includes('ai_models'))
  )
}

export async function getAiModelSettings(options?: { refresh?: boolean }): Promise<AiModelSettings> {
  if (!options?.refresh && cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return cachedSettings.value
  }

  const fallback = getEnvAiModelSettings()
  if (!canReadDatabaseSettings()) return fallback

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('site_settings')
      .select('ai_models')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      if (!isMissingAiModelsColumn(error.message)) {
        console.warn('[ai-model-settings] load failed:', error.message)
      }
      return fallback
    }

    const value = normalizeAiModelSettings(data?.ai_models)
    cachedSettings = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  } catch (err) {
    console.warn('[ai-model-settings] using env defaults:', err instanceof Error ? err.message : err)
    return fallback
  }
}

export function hasRealEnvValue(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized !== '' &&
    !normalized.includes('your-') &&
    !normalized.includes('placeholder') &&
    !normalized.includes('你复制的key')
  )
}

export function getAiModelEnvStatus() {
  return {
    deepseek: {
      keyExists: hasRealEnvValue(process.env.DEEPSEEK_API_KEY),
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-v4-flash',
    },
    kimi: {
      keyExists: hasRealEnvValue(process.env.KIMI_API_KEY),
      baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
      model: process.env.KIMI_CHAT_MODEL || 'kimi-k3',
    },
  }
}
