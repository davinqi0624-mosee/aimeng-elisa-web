import OpenAI from 'openai'

export const DEEPSEEK_CHAT_MODEL = 'deepseek-chat'
export const EMBED_MODEL = 'text-embedding-3-small'

// Lazy-init DeepSeek client to ensure env vars are read at call time
function getDeepSeekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'

  if (!apiKey || apiKey === 'sk-你复制的key') {
    throw new Error('DEEPSEEK_API_KEY_MISSING')
  }

  return new OpenAI({
    apiKey,
    baseURL,
  })
}

// OpenAI client for cloud embeddings
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY_MISSING: 请配置 OPENAI_API_KEY 环境变量以使用云端嵌入')
  }
  return new OpenAI({ apiKey })
}

function translateDeepSeekError(err: any): string {
  const msg = err?.message || String(err)
  if (msg.includes('Insufficient Balance') || msg.includes('insufficient_quota')) {
    return 'DEEPSEEK_INSUFFICIENT_BALANCE'
  }
  if (msg.includes('invalid_request_error')) {
    return `DeepSeek 请求错误: ${msg}`
  }
  if (msg.includes('Authentication') || msg.includes('auth')) {
    return 'DEEPSEEK_AUTH_ERROR'
  }
  return msg
}

/**
 * Generate embedding using OpenAI cloud API (text-embedding-3-small)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient()
  const response = await client.embeddings.create({
    model: EMBED_MODEL,
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Stream chat completions via DeepSeek API
 */
export async function streamChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
) {
  const client = getDeepSeekClient()
  try {
    return await client.chat.completions.create({
      model: DEEPSEEK_CHAT_MODEL,
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    })
  } catch (err: any) {
    console.error('[DeepSeek streamChat error]', err)
    throw new Error(translateDeepSeekError(err))
  }
}

/**
 * Non-streaming chat for single-shot generation
 */
export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const client = getDeepSeekClient()
  try {
    const res = await client.chat.completions.create({
      model: DEEPSEEK_CHAT_MODEL,
      messages,
      stream: false,
      temperature: options?.temperature ?? 0.6,
      max_tokens: options?.maxTokens ?? 4096,
    })
    return res.choices[0]?.message?.content || ''
  } catch (err: any) {
    console.error('[DeepSeek chatCompletion error]', err)
    throw new Error(translateDeepSeekError(err))
  }
}
