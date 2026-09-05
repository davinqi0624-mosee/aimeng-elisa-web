'use client'

import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Input, Spin, Tag } from 'antd'
import { DeleteOutlined, EyeInvisibleOutlined, KeyOutlined, SaveOutlined } from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

type ProviderStatus = {
  provider: 'deepseek' | 'kimi' | 'openai'
  label: string
  keyExists: boolean
  keySource: 'database' | 'environment' | 'missing'
  keyTail?: string
  baseURL: string
  model: string
  updatedAt?: string
}

type ProviderForm = {
  apiKey: string
  baseURL: string
  model: string
}

type AiKeysResponse = {
  providers?: ProviderStatus[]
  error?: string
  message?: string
}

const SOURCE_LABELS: Record<ProviderStatus['keySource'], string> = {
  database: '后台加密密钥',
  environment: '服务器环境变量',
  missing: '未配置',
}

function defaultForm(provider?: ProviderStatus): ProviderForm {
  return {
    apiKey: '',
    baseURL: provider?.baseURL || '',
    model: provider?.model || '',
  }
}

function formatDate(value?: string) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('zh-CN')
  } catch {
    return value
  }
}

export default function AdminAiKeysPage() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [forms, setForms] = useState<Record<string, ProviderForm>>({})
  const [loading, setLoading] = useState(true)
  const [savingProvider, setSavingProvider] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const providerMap = useMemo(() => {
    return Object.fromEntries(providers.map((provider) => [provider.provider, provider]))
  }, [providers])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/ai-keys', { cache: 'no-store' })
      const data = await res.json().catch(() => ({} as AiKeysResponse)) as AiKeysResponse
      if (!res.ok || data.error) throw new Error(data.error || 'AI 密钥配置加载失败')
      const nextProviders = data.providers || []
      setProviders(nextProviders)
      setForms(Object.fromEntries(nextProviders.map((provider) => [provider.provider, defaultForm(provider)])))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI 密钥配置加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 页面进入后需要加载服务端密钥状态。
    load()
  }, [])

  function updateForm(provider: string, patch: Partial<ProviderForm>) {
    setForms((prev) => ({
      ...prev,
      [provider]: {
        ...defaultForm(providerMap[provider]),
        ...(prev[provider] || {}),
        ...patch,
      },
    }))
  }

  async function save(provider: ProviderStatus, clearKey = false) {
    setSavingProvider(provider.provider)
    setMessage('')
    setError('')
    try {
      const form = forms[provider.provider] || defaultForm(provider)
      const res = await fetch('/api/admin/ai-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider.provider,
          apiKey: form.apiKey,
          baseURL: form.baseURL,
          model: form.model,
          clearKey,
        }),
      })
      const data = await res.json().catch(() => ({} as AiKeysResponse)) as AiKeysResponse
      if (!res.ok || data.error) throw new Error(data.error || 'AI 密钥配置保存失败')
      const nextProviders = data.providers || []
      setProviders(nextProviders)
      setForms(Object.fromEntries(nextProviders.map((item) => [item.provider, defaultForm(item)])))
      setMessage(data.message || 'AI 密钥配置已保存')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI 密钥配置保存失败')
    } finally {
      setSavingProvider(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<KeyOutlined />}
        title="AI 密钥管理"
        description="仅超级管理员可见。保存后服务端加密存储，只显示配置状态和 key 尾号，不回显完整密钥。"
      />

      {error && <Alert type="error" showIcon message={error} />}
      {message && <Alert type="success" showIcon message={message} />}

      {loading ? (
        <Card>
          <div className="flex min-h-64 items-center justify-center">
            <Spin size="large" />
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {providers.map((provider) => {
            const form = forms[provider.provider] || defaultForm(provider)
            const isSaving = savingProvider === provider.provider

            return (
              <Card
                key={provider.provider}
                title={provider.label}
                extra={
                  <Tag color={provider.keyExists ? 'green' : 'gold'}>
                    {SOURCE_LABELS[provider.keySource]}
                  </Tag>
                }
              >
                <p className="text-xs text-slate-500">Provider: {provider.provider}</p>

                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <EyeInvisibleOutlined />
                    {provider.keyExists ? `Key 已配置，尾号 ${provider.keyTail || '******'}` : 'Key 未配置'}
                  </div>
                  {provider.updatedAt && <p className="mt-1 text-slate-400">更新时间：{formatDate(provider.updatedAt)}</p>}
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-600">新 API Key</div>
                    <Input.Password
                      value={form.apiKey}
                      onChange={(event) => updateForm(provider.provider, { apiKey: event.target.value })}
                      autoComplete="new-password"
                      placeholder="留空则不修改当前 key"
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-600">接口地址 Base URL</div>
                    <Input
                      value={form.baseURL}
                      onChange={(event) => updateForm(provider.provider, { baseURL: event.target.value })}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-600">模型名</div>
                    <Input
                      value={form.model}
                      onChange={(event) => updateForm(provider.provider, { model: event.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={isSaving}
                    onClick={() => save(provider)}
                    className="flex-1"
                  >
                    保存
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    disabled={isSaving || !provider.keyExists}
                    onClick={() => save(provider, true)}
                  >
                    清除
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Alert
        type="info"
        showIcon
        message="安全说明：密钥保存后不会在页面回显。每次保存或清除都会写入后台审计记录，只记录供应商、尾号和变更类型，不记录完整 key。"
      />
    </div>
  )
}
