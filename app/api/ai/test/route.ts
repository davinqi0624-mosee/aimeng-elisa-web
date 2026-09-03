import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/ai/llm'
import { getAiModelEnvStatus, getAiModelSettings } from '@/lib/ai/model-settings'
import { requireAdminSession } from '@/lib/admin/auth'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

export async function GET(request: NextRequest) {
  // 安全加固：AI 连通性测试需要管理员会话，防止匿名消耗模型额度
  const { error: authError } = await requireAdminSession(request)
  if (authError) return authError

  try {
    const settings = await getAiModelSettings({ refresh: true })
    const reply = await chatCompletion(
      [{ role: 'user', content: '请只回复一句中文：AI 模型已成功接入爱萌优宁网站。' }],
      { task: 'chat', temperature: 0.3, maxTokens: 80 }
    )
    return NextResponse.json({
      success: true,
      reply,
      settings,
      env: getAiModelEnvStatus(),
    })
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(err, 'AI 测试失败'),
        stack: process.env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined,
        env: getAiModelEnvStatus(),
      },
      { status: 500 }
    )
  }
}
