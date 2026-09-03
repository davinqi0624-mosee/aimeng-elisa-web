import { NextRequest, NextResponse } from 'next/server'
import { requireSuper } from '@/lib/admin/auth'
import { logAudit } from '@/lib/admin/audit'
import { getClientIP } from '@/lib/admin/permissions'
import {
  getAiProviderSecretStatuses,
  updateAiProviderSecret,
  type AiSecretProvider,
} from '@/lib/ai/provider-secrets'

const VALID_PROVIDERS = new Set<AiSecretProvider>(['deepseek', 'kimi', 'openai'])

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidProvider(value: unknown): value is AiSecretProvider {
  return typeof value === 'string' && VALID_PROVIDERS.has(value as AiSecretProvider)
}

export async function GET(request: NextRequest) {
  const { error } = await requireSuper(request)
  if (error) return error

  try {
    const providers = await getAiProviderSecretStatuses()
    return NextResponse.json({ providers })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI 密钥状态读取失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const { admin, error } = await requireSuper(request)
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const provider = body.provider

  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: '不支持的 AI 供应商' }, { status: 400 })
  }

  try {
    const result = await updateAiProviderSecret({
      provider,
      apiKey: clean(body.apiKey),
      baseURL: clean(body.baseURL),
      model: clean(body.model),
      clearKey: body.clearKey === true,
    })

    await logAudit({
      admin_id: admin!.id,
      action: 'ai_provider_secret_update',
      target_table: 'site_settings',
      target_id: provider,
      old_value: {
        provider,
        key_tail: result.oldTail || null,
      },
      new_value: {
        provider,
        key_tail: result.newTail || null,
        key_changed: result.keyChanged,
        base_url_changed: result.baseURLChanged,
        model_changed: result.modelChanged,
      },
      reason: '超级管理员更新 AI 供应商密钥配置',
      ip_address: getClientIP(request),
      user_agent: request.headers.get('user-agent') || undefined,
    })

    const providers = await getAiProviderSecretStatuses()
    return NextResponse.json({ providers, message: 'AI 密钥配置已保存' })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI 密钥配置保存失败' },
      { status: 500 }
    )
  }
}
