import { Ollama } from 'ollama'

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'

export const ollama = new Ollama({ host: OLLAMA_HOST })

export const EMBED_MODEL = 'nomic-embed-text'
export const CHAT_MODEL = 'qwen2.5:14b'

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await ollama.embed({
    model: EMBED_MODEL,
    input: text,
  })
  return response.embeddings[0]
}

export async function streamChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
) {
  return ollama.chat({
    model: CHAT_MODEL,
    messages,
    stream: true,
    options: {
      temperature: options?.temperature ?? 0.7,
      num_predict: options?.maxTokens ?? 2048,
    },
  })
}
