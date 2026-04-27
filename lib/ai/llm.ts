import OpenAI from 'openai'
import { Ollama } from 'ollama'

// DeepSeek client (OpenAI-compatible)
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
})

export const DEEPSEEK_CHAT_MODEL = 'deepseek-chat'

// Ollama client for local embeddings only
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const ollama = new Ollama({ host: OLLAMA_HOST })

export const EMBED_MODEL = 'nomic-embed-text'

/**
 * Generate embedding using local Ollama (nomic-embed-text)
 * DeepSeek does not provide an embedding API, so we keep Ollama for this.
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
  return deepseek.chat.completions.create({
    model: DEEPSEEK_CHAT_MODEL,
    messages,
    stream: true,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  })
}

/**
 * Non-streaming chat for single-shot generation (e.g. experiment protocol)
 */
export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const res = await deepseek.chat.completions.create({
    model: DEEPSEEK_CHAT_MODEL,
    messages,
    stream: false,
    temperature: options?.temperature ?? 0.6,
    max_tokens: options?.maxTokens ?? 4096,
  })
  return res.choices[0]?.message?.content || ''
}
