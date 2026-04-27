import { NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/ai/llm'

export async function GET() {
  try {
    const reply = await chatCompletion(
      [{ role: 'user', content: 'Say "Hello from DeepSeek" in Chinese, only the greeting.' }],
      { temperature: 0.3, maxTokens: 50 }
    )
    return NextResponse.json({
      success: true,
      reply,
      env: {
        keyExists: !!process.env.DEEPSEEK_API_KEY,
        keyPrefix: process.env.DEEPSEEK_API_KEY ? process.env.DEEPSEEK_API_KEY.slice(0, 10) + '...' : 'MISSING',
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        env: {
          keyExists: !!process.env.DEEPSEEK_API_KEY,
          keyPrefix: process.env.DEEPSEEK_API_KEY ? process.env.DEEPSEEK_API_KEY.slice(0, 10) + '...' : 'MISSING',
          baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
        },
      },
      { status: 500 }
    )
  }
}
