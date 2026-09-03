import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireSuper } from '@/lib/admin/auth'
import { chatCompletion, getEmbedding } from '@/lib/ai/llm'
import { getAiModelSettings } from '@/lib/ai/model-settings'

type CheckStatus = 'pass' | 'warn' | 'fail'

interface CheckResult {
  key: string
  label: string
  status: CheckStatus
  message: string
  latencyMs?: number
}

function hasRealValue(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && !normalized.includes('your-') && !normalized.includes('placeholder')
}

async function timedCheck(
  key: string,
  label: string,
  fn: () => Promise<{ status: CheckStatus; message: string }>
): Promise<CheckResult> {
  const start = Date.now()
  try {
    const result = await fn()
    return { key, label, ...result, latencyMs: Date.now() - start }
  } catch (err: unknown) {
    return {
      key,
      label,
      status: 'fail',
      message: err instanceof Error ? err.message || '检查失败' : '检查失败',
      latencyMs: Date.now() - start,
    }
  }
}

async function checkRoute(origin: string, path: string): Promise<CheckResult> {
  return timedCheck(`route:${path}`, path, async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(new URL(path, origin), {
        headers: { 'user-agent': 'aimeng-admin-maintenance/1.0' },
        signal: controller.signal,
      })

      if (!response.ok) {
        return { status: 'fail', message: `HTTP ${response.status}` }
      }

      return { status: 'pass', message: '可访问' }
    } finally {
      clearTimeout(timer)
    }
  })
}

export async function POST(request: NextRequest) {
  const { error } = await requireSuper(request)
  if (error) return error

  const origin = request.nextUrl.origin
  const checks: CheckResult[] = []

  checks.push({
    key: 'env:deepseek',
    label: 'DeepSeek API Key',
    status: hasRealValue(process.env.DEEPSEEK_API_KEY) ? 'pass' : 'fail',
    message: hasRealValue(process.env.DEEPSEEK_API_KEY) ? '已配置' : '未配置或仍是占位符',
  })

  checks.push({
    key: 'env:kimi',
    label: 'Kimi API Key',
    status: hasRealValue(process.env.KIMI_API_KEY) ? 'pass' : 'warn',
    message: hasRealValue(process.env.KIMI_API_KEY) ? '已配置' : '未配置，Kimi 备用/长文任务不可用',
  })

  checks.push({
    key: 'env:openai',
    label: 'OpenAI API Key',
    status: hasRealValue(process.env.OPENAI_API_KEY) ? 'pass' : 'warn',
    message: hasRealValue(process.env.OPENAI_API_KEY) ? '已配置' : '未配置，RAG 向量检索会降级',
  })

  checks.push({
    key: 'env:supabase',
    label: 'Supabase 基础配置',
    status: hasRealValue(process.env.NEXT_PUBLIC_SUPABASE_URL) && hasRealValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? 'pass' : 'fail',
    message: '检查 URL 与匿名密钥',
  })

  const aiSettings = await getAiModelSettings({ refresh: true })
  checks.push({
    key: 'ai:model-routing',
    label: 'AI 模型路由',
    status: 'pass',
    message: `客服：${aiSettings.default_chat_provider}；长文：${aiSettings.longform_provider}；实验方案：${aiSettings.protocol_provider}；说明书：${aiSettings.datasheet_provider}；备用：${aiSettings.fallback_enabled ? '开启' : '关闭'}`,
  })

  checks.push(await timedCheck('deepseek', 'DeepSeek 云端大模型', async () => {
    const reply = await chatCompletion(
      [{ role: 'user', content: '请只回复：运维巡检通过' }],
      { provider: 'deepseek', fallbackProvider: false, temperature: 0.2, maxTokens: 40 }
    )
    return reply.trim()
      ? { status: 'pass', message: '已接通并返回内容' }
      : { status: 'warn', message: '接口可调用，但返回内容为空' }
  }))

  checks.push(await timedCheck('kimi', 'Kimi 云端大模型', async () => {
    const reply = await chatCompletion(
      [{ role: 'user', content: '请只回复：运维巡检通过' }],
      { provider: 'kimi', fallbackProvider: false, temperature: 1, maxTokens: 300 }
    )
    return reply.trim()
      ? { status: 'pass', message: '已接通并返回内容' }
      : { status: 'warn', message: '接口可调用，但返回内容为空' }
  }))

  checks.push(await timedCheck('openai-embedding', 'OpenAI Embedding', async () => {
    await getEmbedding('AIMENG RAG health check')
    return { status: 'pass', message: '向量模型可用' }
  }))

  checks.push(await timedCheck('supabase-read', 'Supabase 数据读取', async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const key = serviceKey || anonKey

    if (!supabaseUrl || !key) {
      return { status: 'fail', message: '缺少 Supabase 环境变量' }
    }

    const supabase = createSupabaseClient(supabaseUrl, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { count, error: dbError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })

    if (dbError) {
      return { status: 'fail', message: dbError.message }
    }

    return { status: 'pass', message: `产品表可读取，记录数 ${count ?? 0}` }
  }))

  const routeChecks = await Promise.all([
    checkRoute(origin, '/'),
    checkRoute(origin, '/products'),
    checkRoute(origin, '/chat'),
    checkRoute(origin, '/lab/analysis'),
    checkRoute(origin, '/knowledge'),
    checkRoute(origin, '/api/knowledge/daily?all=true'),
  ])

  checks.push(...routeChecks)

  const summary = {
    pass: checks.filter((item) => item.status === 'pass').length,
    warn: checks.filter((item) => item.status === 'warn').length,
    fail: checks.filter((item) => item.status === 'fail').length,
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary,
    checks,
  })
}
