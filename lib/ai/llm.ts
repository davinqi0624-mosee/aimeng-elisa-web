import OpenAI from 'openai'
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat/completions'
import {
  type AiProvider,
  type AiTask,
  getAiModelSettings,
  getProviderForAiTask,
  hasRealEnvValue,
} from '@/lib/ai/model-settings'
import { getAiProviderCredential } from '@/lib/ai/provider-secrets'

type ChatRole = 'system' | 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string }

export const DEEPSEEK_CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-v4-flash'
export const KIMI_CHAT_MODEL = process.env.KIMI_CHAT_MODEL || 'kimi-k3'
export const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'
const DEFAULT_AI_TIMEOUT_MS = Number(process.env.AI_MODEL_TIMEOUT_MS || 45_000)
// Long-form tasks can exceed the short chat timeout, so keep a longer default
// for Kimi while still allowing an explicit environment override.
const KIMI_TIMEOUT_MS = Number(process.env.KIMI_TIMEOUT_MS || Math.max(DEFAULT_AI_TIMEOUT_MS, 120_000))
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || DEFAULT_AI_TIMEOUT_MS)

function isMissingOrPlaceholderKey(apiKey: string | undefined) {
  return !hasRealEnvValue(apiKey)
}

// OpenAI client for cloud embeddings
async function getOpenAIClient(): Promise<{ client: OpenAI; model: string }> {
  const { apiKey, baseURL, model } = await getAiProviderCredential('openai')
  if (isMissingOrPlaceholderKey(apiKey)) {
    throw new Error('OPENAI_API_KEY_MISSING: 请配置 OPENAI_API_KEY 环境变量以使用云端嵌入')
  }
  return { client: new OpenAI({ apiKey, baseURL }), model }
}

function getErrorRecord(err: unknown): Record<string, unknown> {
  return err && typeof err === 'object' ? (err as Record<string, unknown>) : {}
}

function translateDeepSeekError(err: unknown): string {
  const record = getErrorRecord(err)
  const response = getErrorRecord(record.response)
  const msg = typeof record.message === 'string' ? record.message : String(err)
  const status = record.status || response.status
  if (msg.includes('Insufficient Balance') || msg.includes('insufficient_quota')) {
    return 'DEEPSEEK_INSUFFICIENT_BALANCE'
  }
  if (status === 401 || status === 403 || msg.includes('401') || msg.includes('403')) {
    return 'DEEPSEEK_AUTH_ERROR'
  }
  if (msg.includes('invalid_request_error')) {
    return `DeepSeek 请求错误: ${msg}`
  }
  if (msg.includes('EMPTY_RESPONSE')) {
    return 'DEEPSEEK_EMPTY_RESPONSE'
  }
  if (msg.includes('Authentication') || msg.includes('auth')) {
    return 'DEEPSEEK_AUTH_ERROR'
  }
  return msg
}

function translateKimiError(err: unknown): string {
  const record = getErrorRecord(err)
  const response = getErrorRecord(record.response)
  const msg = typeof record.message === 'string' ? record.message : String(err)
  const status = record.status || response.status
  if (status === 401 || status === 403 || msg.includes('401') || msg.includes('403')) {
    return 'KIMI_AUTH_ERROR'
  }
  if (status === 429 || msg.includes('rate_limit') || msg.includes('too many')) {
    return 'KIMI_RATE_LIMIT'
  }
  if (msg.includes('insufficient') || msg.includes('quota') || msg.includes('balance')) {
    return 'KIMI_INSUFFICIENT_BALANCE'
  }
  if (msg.includes('invalid_request_error')) {
    return `Kimi 请求错误: ${msg}`
  }
  if (msg.includes('EMPTY_RESPONSE')) {
    return 'KIMI_EMPTY_RESPONSE'
  }
  return msg
}

type ProviderRuntime = {
  client: OpenAI
  model: string
  temperature: number
}

function shouldDisableReasoning(provider: AiProvider, model: string) {
  return provider === 'deepseek' && model.toLowerCase().includes('v4')
}

function withReasoningControl<T extends ChatCompletionCreateParamsStreaming | ChatCompletionCreateParamsNonStreaming>(
  provider: AiProvider,
  runtime: ProviderRuntime,
  payload: T
): T {
  if (!shouldDisableReasoning(provider, runtime.model)) return payload

  return {
    ...payload,
    // DeepSeek v4-flash otherwise emits a long reasoning_content phase before
    // normal content, which makes the website look like it is not responding.
    reasoning_effort: 'none',
  }
}

function buildStreamingChatPayload(
  provider: AiProvider,
  runtime: ProviderRuntime,
  messages: ChatMessage[],
  maxTokens: number
): ChatCompletionCreateParamsStreaming {
  return withReasoningControl(provider, runtime, {
    model: runtime.model,
    messages,
    stream: true,
    temperature: runtime.temperature,
    max_tokens: maxTokens,
  })
}

function buildNonStreamingChatPayload(
  provider: AiProvider,
  runtime: ProviderRuntime,
  messages: ChatMessage[],
  maxTokens: number
): ChatCompletionCreateParamsNonStreaming {
  return withReasoningControl(provider, runtime, {
    model: runtime.model,
    messages,
    stream: false,
    temperature: runtime.temperature,
    max_tokens: maxTokens,
  })
}

async function getProviderRuntime(provider: AiProvider, requestedTemperature: number): Promise<ProviderRuntime> {
  const { apiKey, baseURL, model: configuredModel } = await getAiProviderCredential(provider)
  if (isMissingOrPlaceholderKey(apiKey)) {
    throw new Error(provider === 'kimi' ? 'KIMI_API_KEY_MISSING' : 'DEEPSEEK_API_KEY_MISSING')
  }

  const model = configuredModel || (provider === 'kimi' ? KIMI_CHAT_MODEL : DEEPSEEK_CHAT_MODEL)
  return {
    client: new OpenAI({ apiKey, baseURL }),
    model,
    temperature: provider === 'kimi' && model.toLowerCase().includes('k3') ? 1 : requestedTemperature,
  }
}

function getProviderTimeoutMs(provider: AiProvider) {
  return provider === 'kimi' ? KIMI_TIMEOUT_MS : DEEPSEEK_TIMEOUT_MS
}

async function withProviderTimeout<T>(
  provider: AiProvider,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const timeoutMs = getProviderTimeoutMs(provider)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`${provider.toUpperCase()}_TIMEOUT`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      operation(controller.signal),
      timeoutPromise,
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function translateProviderError(provider: AiProvider, err: unknown) {
  return provider === 'kimi' ? translateKimiError(err) : translateDeepSeekError(err)
}

function getFallbackProvider(
  provider: AiProvider,
  fallbackEnabled: boolean,
  fallbackProvider?: AiProvider | false
): AiProvider | undefined {
  if (fallbackProvider === false) return undefined
  if (fallbackProvider) return fallbackProvider
  if (!fallbackEnabled) return undefined
  return provider === 'deepseek' ? 'kimi' : 'deepseek'
}

/**
 * Generate embedding using OpenAI cloud API (text-embedding-3-small)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const { client, model } = await getOpenAIClient()
  const response = await client.embeddings.create({
    model: model || EMBED_MODEL,
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Stream chat completions through the configured AI provider.
 */
export async function streamChat(
  messages: ChatMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
    provider?: AiProvider
    fallbackProvider?: AiProvider | false
    task?: AiTask
    onProviderUsed?: (provider: AiProvider, model: string) => void
  }
) {
  const settings = await getAiModelSettings()
  const provider = options?.provider || getProviderForAiTask(settings, options?.task)
  const fallbackProvider = getFallbackProvider(provider, settings.fallback_enabled, options?.fallbackProvider)
  try {
    const runtime = await getProviderRuntime(provider, options?.temperature ?? 0.7)
    const response = await withProviderTimeout(provider, (signal) => runtime.client.chat.completions.create(
      buildStreamingChatPayload(provider, runtime, messages, options?.maxTokens ?? 2048),
      { signal }
    ))
    options?.onProviderUsed?.(provider, runtime.model)
    return response
  } catch (err: unknown) {
    console.error(`[${provider} streamChat error]`, err)
    if (fallbackProvider && fallbackProvider !== provider) {
      try {
        const fallbackRuntime = await getProviderRuntime(fallbackProvider, options?.temperature ?? 0.7)
        const response = await withProviderTimeout(fallbackProvider, (signal) => fallbackRuntime.client.chat.completions.create(
          buildStreamingChatPayload(fallbackProvider, fallbackRuntime, messages, options?.maxTokens ?? 2048),
          { signal }
        ))
        options?.onProviderUsed?.(fallbackProvider, fallbackRuntime.model)
        return response
      } catch (fallbackErr: unknown) {
        console.error(`[${fallbackProvider} streamChat fallback error]`, fallbackErr)
        throw new Error(`${translateProviderError(provider, err)}；备用模型也失败：${translateProviderError(fallbackProvider, fallbackErr)}`)
      }
    }
    throw new Error(translateProviderError(provider, err))
  }
}

/**
 * Non-streaming chat for single-shot generation
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
    provider?: AiProvider
    fallbackProvider?: AiProvider | false
    task?: AiTask
    onProviderUsed?: (provider: AiProvider, model: string) => void
  }
): Promise<string> {
  const settings = await getAiModelSettings()
  const provider = options?.provider || getProviderForAiTask(settings, options?.task)
  const fallbackProvider = getFallbackProvider(provider, settings.fallback_enabled, options?.fallbackProvider)
  try {
    const runtime = await getProviderRuntime(provider, options?.temperature ?? 0.6)
    const res = await withProviderTimeout(provider, (signal) => runtime.client.chat.completions.create(
      buildNonStreamingChatPayload(provider, runtime, messages, options?.maxTokens ?? 4096),
      { signal }
    ))
    const content = res.choices[0]?.message?.content || ''
    if (content.trim()) {
      options?.onProviderUsed?.(provider, runtime.model)
      return content
    }

    // Some OpenAI-compatible providers/models may return empty content in
    // non-streaming mode while streaming deltas still contain the answer.
    const stream = await streamChat(messages, { ...options, provider, fallbackProvider: false })
    let streamedContent = ''
    for await (const chunk of stream) {
      streamedContent += chunk.choices[0]?.delta?.content || ''
    }
    if (streamedContent.trim()) {
      options?.onProviderUsed?.(provider, runtime.model)
      return streamedContent
    }
    throw new Error(`${provider.toUpperCase()}_EMPTY_RESPONSE`)
  } catch (err: unknown) {
    console.error(`[${provider} chatCompletion error]`, err)
    if (fallbackProvider && fallbackProvider !== provider) {
      try {
        return await chatCompletion(messages, {
          ...options,
          provider: fallbackProvider,
          fallbackProvider: false,
        })
      } catch (fallbackErr: unknown) {
        console.error(`[${fallbackProvider} chatCompletion fallback error]`, fallbackErr)
        throw new Error(`${translateProviderError(provider, err)}；备用模型也失败：${translateProviderError(fallbackProvider, fallbackErr)}`)
      }
    }
    throw new Error(translateProviderError(provider, err))
  }
}
