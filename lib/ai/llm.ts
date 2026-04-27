import OpenAI from 'openai'
import { Ollama } from 'ollama'

export const DEEPSEEK_CHAT_MODEL = 'deepseek-chat'

// Lazy-init DeepSeek client to ensure env vars are loaded at call time
function getDeepSeekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'

  if (!apiKey || apiKey === 'sk-你复制的key') {
    throw new Error('DEEPSEEK_API_KEY is missing or invalid. Please set it in Vercel environment variables.')
  }

  return new OpenAI({
    apiKey,
    baseURL,
  })
}

// Ollama client for local embeddings only
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const ollama = new Ollama({ host: OLLAMA_HOST })

export const EMBED_MODEL = 'nomic-embed-text'

/**
 * Generate embedding using local Ollama (nomic-embed-text)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const response = await ollama.embed({
    model: EMBED_MODEL,
    input: text,
  })
  return response.embeddings[0]
}

/**
 * Stream chat completions via DeepSeek API
 */
export async function streamChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
) {
  const client = getDeepSeekClient()
  return client.chat.completions.create({
    model: DEEPSEEK_CHAT_MODEL,
    messages,
    stream: true,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  })
}

/**
 * Non-streaming chat for single-shot generation
 */
export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const client = getDeepSeekClient()
  const res = await client.chat.completions.create({
    model: DEEPSEEK_CHAT_MODEL,
    messages,
    stream: false,
    temperature: options?.temperature ?? 0.6,
    max_tokens: options?.maxTokens ?? 4096,
  })
  return res.choices[0]?.message?.content || ''
}
