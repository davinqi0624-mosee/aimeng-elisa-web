import { NextRequest, NextResponse } from 'next/server'
import { requireSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  clearAiModelSettingsCache,
  getAiModelEnvStatus,
  getAiModelSettings,
  normalizeAiModelSettings,
} from '@/lib/ai/model-settings'

function isMissingAiModelsColumn(message?: string) {
  return Boolean(
    message?.includes('site_settings') &&
      (message.includes('schema cache') || message.includes('does not exist') || message.includes('ai_models'))
  )
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const settings = await getAiModelSettings({ refresh: true })

  return NextResponse.json({
    settings,
    env: getAiModelEnvStatus(),
  })
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const settings = normalizeAiModelSettings(body)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('site_settings')
    .upsert({ id: 1, ai_models: settings }, { onConflict: 'id' })
    .select('ai_models')
    .single()

  if (error) {
    if (isMissingAiModelsColumn(error.message)) {
      return NextResponse.json(
        { error: 'AI 模型设置表结构尚未初始化，请先执行 supabase/migrations/055_ai_model_settings.sql。' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  clearAiModelSettingsCache()

  return NextResponse.json({
    settings: normalizeAiModelSettings(data?.ai_models),
    env: getAiModelEnvStatus(),
    message: 'AI 模型设置已保存',
  })
}
