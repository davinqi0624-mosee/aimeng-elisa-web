'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Alert, Button, Card, Input, Select, Spin, Switch, Tag, Upload } from 'antd'
import {
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  QrcodeOutlined,
  RobotOutlined,
  SafetyOutlined,
  SaveOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

type CustomerServiceSettings = {
  service_name: string
  phone: string
  email: string
  wechat_id: string
  wechat_qr_url: string
  work_hours: string
  address: string
  note: string
  is_active: boolean
}

type LabTemplateSettings = {
  elisa_analysis_template_url: string
  elisa_analysis_template_name: string
  elisa_analysis_template_uploaded_at?: string
  elisa_testing_service_form_url: string
  elisa_testing_service_form_name: string
  elisa_testing_service_form_uploaded_at?: string
}

type AiProvider = 'deepseek' | 'kimi'

type AiModelSettings = {
  default_chat_provider: AiProvider
  longform_provider: AiProvider
  protocol_provider: AiProvider
  datasheet_provider: AiProvider
  fallback_enabled: boolean
}

type AiModelEnvStatus = {
  deepseek?: { keyExists?: boolean; baseURL?: string; model?: string }
  kimi?: { keyExists?: boolean; baseURL?: string; model?: string }
}

const DEFAULT_SERVICE_SETTINGS: CustomerServiceSettings = {
  service_name: '爱萌优宁官方客服',
  phone: '400-888-0123',
  email: 'service@animaluni.com',
  wechat_id: '',
  wechat_qr_url: '',
  work_hours: '周一至周五 9:00 - 18:00',
  address: '上海市浦东新区张江高科技园区科苑路88号',
  note: '添加客服时请备注产品货号或产品名称，方便快速确认库存、报价、货期和资料。',
  is_active: true,
}

const DEFAULT_LAB_TEMPLATE_SETTINGS: LabTemplateSettings = {
  elisa_analysis_template_url: '/downloads/AM-ELISA数据分析模板.xlsx',
  elisa_analysis_template_name: 'AM-ELISA数据分析模板.xlsx',
  elisa_testing_service_form_url: '/downloads/AMUN-ELISA-testing-service-form.docx',
  elisa_testing_service_form_name: 'AMUN Elisa实验代测表.docx',
}

const DEFAULT_AI_MODEL_SETTINGS: AiModelSettings = {
  default_chat_provider: 'deepseek',
  longform_provider: 'kimi',
  protocol_provider: 'kimi',
  datasheet_provider: 'kimi',
  fallback_enabled: true,
}

const AI_PROVIDER_OPTIONS: Array<{ value: AiProvider; label: string; desc: string }> = [
  { value: 'deepseek', label: 'DeepSeek', desc: '适合日常客服，成本更好控制' },
  { value: 'kimi', label: 'Kimi K3', desc: '适合长文、方案和复杂总结' },
]

function providerLabel(value?: AiProvider) {
  return value === 'kimi' ? 'Kimi K3' : 'DeepSeek'
}

function createUploadId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export default function AdminSettingsPage() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [serviceSettings, setServiceSettings] = useState<CustomerServiceSettings>(DEFAULT_SERVICE_SETTINGS)
  const [serviceLoading, setServiceLoading] = useState(true)
  const [savingService, setSavingService] = useState(false)
  const [uploadingQr, setUploadingQr] = useState(false)
  const [serviceMessage, setServiceMessage] = useState('')
  const [serviceError, setServiceError] = useState('')
  const [labTemplateSettings, setLabTemplateSettings] = useState<LabTemplateSettings>(DEFAULT_LAB_TEMPLATE_SETTINGS)
  const [labTemplateLoading, setLabTemplateLoading] = useState(true)
  const [uploadingLabTemplate, setUploadingLabTemplate] = useState(false)
  const [uploadingServiceForm, setUploadingServiceForm] = useState(false)
  const [labTemplateMessage, setLabTemplateMessage] = useState('')
  const [labTemplateError, setLabTemplateError] = useState('')
  const [aiModelSettings, setAiModelSettings] = useState<AiModelSettings>(DEFAULT_AI_MODEL_SETTINGS)
  const [aiModelEnv, setAiModelEnv] = useState<AiModelEnvStatus>({})
  const [aiModelLoading, setAiModelLoading] = useState(true)
  const [savingAiModel, setSavingAiModel] = useState(false)
  const [aiModelMessage, setAiModelMessage] = useState('')
  const [aiModelError, setAiModelError] = useState('')

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d) => {
        setRole(d.role || null)
        setLoading(false)
      })
      .catch(() => {
        setRole(null)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (role !== 'super') return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- super 权限确认后需要进入客服配置加载态。
    setServiceLoading(true)
    fetch('/api/admin/customer-service')
      .then((r) => r.json())
      .then((data) => {
        setServiceSettings({ ...DEFAULT_SERVICE_SETTINGS, ...(data.settings || {}) })
        setServiceError(data.needsSetup ? data.error || '' : '')
      })
      .catch((err) => {
        setServiceError(err instanceof Error ? err.message : '官方客服配置加载失败')
      })
      .finally(() => setServiceLoading(false))
  }, [role])

  useEffect(() => {
    if (role !== 'super') return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- super 权限确认后需要进入模板配置加载态。
    setLabTemplateLoading(true)
    fetch('/api/admin/lab-template-settings')
      .then((r) => r.json())
      .then((data) => {
        setLabTemplateSettings({ ...DEFAULT_LAB_TEMPLATE_SETTINGS, ...(data.settings || {}) })
        setLabTemplateError(data.needsSetup ? data.error || '' : '')
      })
      .catch((err) => {
        setLabTemplateError(err instanceof Error ? err.message : 'ELISA 数据分析模板配置加载失败')
      })
      .finally(() => setLabTemplateLoading(false))
  }, [role])

  useEffect(() => {
    if (role !== 'super') return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- super 权限确认后需要进入 AI 模型配置加载态。
    setAiModelLoading(true)
    fetch('/api/admin/ai-model-settings')
      .then((r) => r.json())
      .then((data) => {
        setAiModelSettings({ ...DEFAULT_AI_MODEL_SETTINGS, ...(data.settings || {}) })
        setAiModelEnv(data.env || {})
        setAiModelError(data.error || '')
      })
      .catch((err) => {
        setAiModelError(err instanceof Error ? err.message : 'AI 模型设置加载失败')
      })
      .finally(() => setAiModelLoading(false))
  }, [role])

  const updateServiceField = <K extends keyof CustomerServiceSettings>(
    key: K,
    value: CustomerServiceSettings[K]
  ) => {
    setServiceSettings((prev) => ({ ...prev, [key]: value }))
  }

  const updateAiModelField = <K extends keyof AiModelSettings>(
    key: K,
    value: AiModelSettings[K]
  ) => {
    setAiModelSettings((prev) => ({ ...prev, [key]: value }))
  }

  const saveAiModelSettings = async () => {
    setSavingAiModel(true)
    setAiModelError('')
    setAiModelMessage('')
    try {
      const res = await fetch('/api/admin/ai-model-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiModelSettings),
      })
      const data = await res.json().catch(() => ({} as {
        settings?: AiModelSettings
        env?: AiModelEnvStatus
        error?: string
        message?: string
      }))
      if (!res.ok || data.error) throw new Error(data.error || 'AI 模型设置保存失败')
      setAiModelSettings({ ...DEFAULT_AI_MODEL_SETTINGS, ...(data.settings || {}) })
      setAiModelEnv(data.env || {})
      setAiModelMessage(data.message || 'AI 模型设置已保存')
    } catch (err: unknown) {
      setAiModelError(err instanceof Error ? err.message : 'AI 模型设置保存失败')
    } finally {
      setSavingAiModel(false)
    }
  }

  const uploadOfficialQr = async (file: File) => {
    setUploadingQr(true)
    setServiceError('')
    setServiceMessage('')
    try {
      const body = new FormData()
      const ext = file.name.split('.').pop() || 'png'
      body.append('file', file)
      body.append('bucket', 'page-assets')
      body.append('path', `customer-service/official-wechat-${createUploadId()}.${ext}`)
      if (serviceSettings.wechat_qr_url) body.append('old_url', serviceSettings.wechat_qr_url)

      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }))
      if (!res.ok || data.error || !data.url) throw new Error(data.error || '二维码上传失败')
      updateServiceField('wechat_qr_url', data.url)
      setServiceMessage('二维码已上传，请点击保存配置后生效')
    } catch (err: unknown) {
      setServiceError(err instanceof Error ? err.message : '二维码上传失败')
    } finally {
      setUploadingQr(false)
    }
  }

  const saveLabTemplateSettings = async (settings: LabTemplateSettings) => {
    const res = await fetch('/api/admin/lab-template-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    const data = await res.json().catch(() => ({} as {
      settings?: LabTemplateSettings
      error?: string
      message?: string
    }))
    if (!res.ok || data.error) throw new Error(data.error || '模板配置保存失败')
    setLabTemplateSettings({ ...DEFAULT_LAB_TEMPLATE_SETTINGS, ...(data.settings || {}) })
    setLabTemplateMessage(data.message || 'ELISA 数据分析模板已更新')
  }

  const uploadLabTemplate = async (file: File) => {
    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      setLabTemplateError('请上传 .xlsx 或 .xls 格式的 Excel 模板')
      return
    }

    setUploadingLabTemplate(true)
    setLabTemplateError('')
    setLabTemplateMessage('')
    try {
      const body = new FormData()
      const ext = lowerName.endsWith('.xls') ? 'xls' : 'xlsx'
      const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
      body.append('file', file)
      body.append('bucket', 'page-assets')
      body.append('path', `settings/templates/elisa-analysis-template-${safeTimestamp}.${ext}`)
      if (labTemplateSettings.elisa_analysis_template_url) {
        body.append('old_url', labTemplateSettings.elisa_analysis_template_url)
      }

      const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body })
      const uploadData = await uploadRes.json().catch(() => ({} as { url?: string; error?: string }))
      if (!uploadRes.ok || uploadData.error || !uploadData.url) {
        throw new Error(uploadData.error || '模板上传失败')
      }

      await saveLabTemplateSettings({
        ...labTemplateSettings,
        elisa_analysis_template_url: uploadData.url,
        elisa_analysis_template_name: file.name,
        elisa_analysis_template_uploaded_at: new Date().toISOString(),
      })
    } catch (err: unknown) {
      setLabTemplateError(err instanceof Error ? err.message : '模板上传失败')
    } finally {
      setUploadingLabTemplate(false)
    }
  }

  const uploadTestingServiceForm = async (file: File) => {
    const lowerName = file.name.toLowerCase()
    const allowedExtensions = ['.docx', '.doc', '.pdf']
    if (!allowedExtensions.some((ext) => lowerName.endsWith(ext))) {
      setLabTemplateError('请上传 .docx、.doc 或 .pdf 格式的代测申请表')
      return
    }

    setUploadingServiceForm(true)
    setLabTemplateError('')
    setLabTemplateMessage('')
    try {
      const ext = lowerName.split('.').pop() || 'docx'
      const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const body = new FormData()
      body.append('file', file)
      body.append('bucket', 'page-assets')
      body.append('path', `settings/templates/elisa-testing-service-form-${safeTimestamp}.${ext}`)
      if (labTemplateSettings.elisa_testing_service_form_url) {
        body.append('old_url', labTemplateSettings.elisa_testing_service_form_url)
      }

      const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body })
      const uploadData = await uploadRes.json().catch(() => ({} as { url?: string; error?: string }))
      if (!uploadRes.ok || uploadData.error || !uploadData.url) {
        throw new Error(uploadData.error || '代测申请表上传失败')
      }

      await saveLabTemplateSettings({
        ...labTemplateSettings,
        elisa_testing_service_form_url: uploadData.url,
        elisa_testing_service_form_name: file.name,
        elisa_testing_service_form_uploaded_at: new Date().toISOString(),
      })
    } catch (err: unknown) {
      setLabTemplateError(err instanceof Error ? err.message : '代测申请表上传失败')
    } finally {
      setUploadingServiceForm(false)
    }
  }

  const saveServiceSettings = async () => {
    setSavingService(true)
    setServiceError('')
    setServiceMessage('')
    try {
      const res = await fetch('/api/admin/customer-service', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceSettings),
      })
      const data = await res.json().catch(() => ({} as { settings?: CustomerServiceSettings; error?: string; message?: string }))
      if (!res.ok || data.error) throw new Error(data.error || '保存失败')
      setServiceSettings({ ...DEFAULT_SERVICE_SETTINGS, ...(data.settings || {}) })
      setServiceMessage(data.message || '官方客服配置已保存')
    } catch (err: unknown) {
      setServiceError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingService(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    )
  }

  if (role !== 'super') {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <Alert type="warning" showIcon message="仅超级管理员可访问系统设置" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={<SettingOutlined />} title="系统设置" description="系统环境变量与 API 配置（仅 super 可见）" />

      <Card
        title={
          <span className="flex items-center gap-2">
            <QrcodeOutlined className="text-blue-600" />
            官方客服配置
          </span>
        }
      >
        <p className="mb-4 text-xs text-slate-500">
          仅用于商品详情页“联系客服咨询”弹窗；代理商二维码仍在代理商分布页面单独管理。
        </p>

        {serviceError && <Alert type="error" showIcon message={serviceError} className="mb-3" />}
        {serviceMessage && <Alert type="success" showIcon message={serviceMessage} className="mb-3" />}

        {serviceLoading ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
            <div className="space-y-3">
              <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                {serviceSettings.wechat_qr_url ? (
                  <Image
                    src={serviceSettings.wechat_qr_url}
                    alt="官方客服二维码"
                    width={192}
                    height={192}
                    className="h-48 w-48 rounded-xl object-contain"
                  />
                ) : (
                  <div className="text-center text-xs text-slate-400">
                    <QrcodeOutlined className="mb-2 block text-2xl" />
                    未上传二维码
                  </div>
                )}
              </div>
              <Upload
                accept="image/png,image/jpeg,image/webp,image/gif"
                showUploadList={false}
                beforeUpload={(file) => {
                  uploadOfficialQr(file)
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploadingQr} className="w-48">
                  上传官方二维码
                </Button>
              </Upload>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">客服名称</span>
                <Input value={serviceSettings.service_name} onChange={(e) => updateServiceField('service_name', e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">客服电话</span>
                <Input value={serviceSettings.phone} onChange={(e) => updateServiceField('phone', e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">客服邮箱</span>
                <Input value={serviceSettings.email} onChange={(e) => updateServiceField('email', e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">客服微信号</span>
                <Input value={serviceSettings.wechat_id} onChange={(e) => updateServiceField('wechat_id', e.target.value)} />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-slate-500">工作时间</span>
                <Input value={serviceSettings.work_hours} onChange={(e) => updateServiceField('work_hours', e.target.value)} />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-slate-500">公司地址</span>
                <Input value={serviceSettings.address} onChange={(e) => updateServiceField('address', e.target.value)} />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-slate-500">弹窗说明</span>
                <Input.TextArea rows={3} value={serviceSettings.note} onChange={(e) => updateServiceField('note', e.target.value)} />
              </label>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Switch
                  checked={serviceSettings.is_active}
                  onChange={(checked) => updateServiceField('is_active', checked)}
                />
                启用官方客服弹窗配置
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={saveServiceSettings}
                  loading={savingService}
                >
                  保存官方客服配置
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <FileExcelOutlined className="text-emerald-600" />
            常用下载文件
          </span>
        }
      >
        <p className="mb-4 text-xs text-slate-500">
          用于前台客户下载的通用文件；上传新版文件后，相关前台入口会自动下载最新版本。
        </p>

        {labTemplateError && <Alert type="error" showIcon message={labTemplateError} className="mb-3" />}
        {labTemplateMessage && <Alert type="success" showIcon message={labTemplateMessage} className="mb-3" />}

        {labTemplateLoading ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card
              size="small"
              title={
                <span className="flex items-center gap-2">
                  <FileExcelOutlined className="text-emerald-600" />
                  ELISA 数据分析模板
                </span>
              }
            >
              <p className="text-xs text-slate-500">用于实验数据分析页面的“下载 Excel 模板”。</p>
              <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">当前文件</p>
                <p className="mt-1 break-all text-sm font-medium text-slate-900">
                  {labTemplateSettings.elisa_analysis_template_name}
                </p>
                <p className="mt-1 break-all text-xs text-slate-500">
                  {labTemplateSettings.elisa_analysis_template_url}
                </p>
                {labTemplateSettings.elisa_analysis_template_uploaded_at && (
                  <p className="mt-2 text-xs text-slate-400">
                    更新时间：{new Date(labTemplateSettings.elisa_analysis_template_uploaded_at).toLocaleString('zh-CN')}
                  </p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  icon={<DownloadOutlined />}
                  href={labTemplateSettings.elisa_analysis_template_url}
                  download={labTemplateSettings.elisa_analysis_template_name}
                >
                  下载检查
                </Button>
                <Upload
                  accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  showUploadList={false}
                  disabled={uploadingLabTemplate}
                  beforeUpload={(file) => {
                    uploadLabTemplate(file)
                    return false
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={uploadingLabTemplate}>
                    上传替换
                  </Button>
                </Upload>
              </div>
            </Card>

            <Card
              size="small"
              title={
                <span className="flex items-center gap-2">
                  <FileTextOutlined className="text-blue-600" />
                  ELISA 代测申请表
                </span>
              }
            >
              <p className="text-xs text-slate-500">用于产品详情页、订购区域和搜索页的“下载代测申请表”。</p>
              <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">当前文件</p>
                <p className="mt-1 break-all text-sm font-medium text-slate-900">
                  {labTemplateSettings.elisa_testing_service_form_name}
                </p>
                <p className="mt-1 break-all text-xs text-slate-500">
                  {labTemplateSettings.elisa_testing_service_form_url}
                </p>
                {labTemplateSettings.elisa_testing_service_form_uploaded_at && (
                  <p className="mt-2 text-xs text-slate-400">
                    更新时间：{new Date(labTemplateSettings.elisa_testing_service_form_uploaded_at).toLocaleString('zh-CN')}
                  </p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  icon={<DownloadOutlined />}
                  href={labTemplateSettings.elisa_testing_service_form_url}
                  download={labTemplateSettings.elisa_testing_service_form_name}
                >
                  下载检查
                </Button>
                <Upload
                  accept=".docx,.doc,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  showUploadList={false}
                  disabled={uploadingServiceForm}
                  beforeUpload={(file) => {
                    uploadTestingServiceForm(file)
                    return false
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={uploadingServiceForm}>
                    上传替换
                  </Button>
                </Upload>
              </div>
            </Card>
          </div>
        )}
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <RobotOutlined className="text-indigo-600" />
            AI 模型设置
          </span>
        }
      >
        <p className="mb-4 text-xs text-slate-500">
          API Key 只在服务器环境变量中维护；这里切换不同任务优先调用的模型。
        </p>

        {aiModelError && <Alert type="error" showIcon message={aiModelError} className="mb-3" />}
        {aiModelMessage && <Alert type="success" showIcon message={aiModelMessage} className="mb-3" />}

        {aiModelLoading ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {([
                { key: 'default_chat_provider', label: 'AI 客服日常回答', hint: '保存后作为客服主模型；失败时可按备用策略切换。' },
                { key: 'longform_provider', label: '每日知识 / 长文总结', hint: '保存后作为每日知识和长文任务的主模型。' },
                { key: 'protocol_provider', label: '实验方案生成', hint: '保存后作为实验方案 protocol 的主模型。' },
                { key: 'datasheet_provider', label: '说明书生成 / 总结', hint: '保存后作为说明书生成和总结的主模型。' },
              ] as Array<{ key: keyof Pick<AiModelSettings, 'default_chat_provider' | 'longform_provider' | 'protocol_provider' | 'datasheet_provider'>; label: string; hint: string }>).map((item) => (
                <div key={item.key} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.hint}</span>
                  <Select
                    className="w-full"
                    value={aiModelSettings[item.key]}
                    onChange={(value: AiProvider) => updateAiModelField(item.key, value)}
                    options={AI_PROVIDER_OPTIONS}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <div className="flex items-start gap-3 text-sm text-slate-800">
                <Switch
                  checked={aiModelSettings.fallback_enabled}
                  onChange={(checked) => updateAiModelField('fallback_enabled', checked)}
                />
                <span>
                  <span className="block font-semibold">启用备用模型自动切换</span>
                  <span className="mt-1 block text-xs text-slate-600">
                    当前策略：主模型失败时自动切到另一个模型，例如 DeepSeek 报错或额度不足时切 Kimi。
                  </span>
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {([
                { key: 'deepseek', label: 'DeepSeek' },
                { key: 'kimi', label: 'Kimi K3' },
              ] as const).map((item) => {
                const env = aiModelEnv[item.key] || {}
                return (
                  <div key={item.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <Tag color={env.keyExists ? 'green' : 'gold'}>
                        {env.keyExists ? 'Key 已配置' : 'Key 未配置'}
                      </Tag>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">模型：{env.model || '未设置'}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">接口：{env.baseURL || '未设置'}</p>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                当前配置：客服 {providerLabel(aiModelSettings.default_chat_provider)}；每日知识/长文 {providerLabel(aiModelSettings.longform_provider)}；实验方案 {providerLabel(aiModelSettings.protocol_provider)}；说明书 {providerLabel(aiModelSettings.datasheet_provider)}。
              </p>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={saveAiModelSettings}
                loading={savingAiModel}
              >
                保存 AI 模型设置
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <SafetyOutlined className="text-blue-600" />
            环境变量
          </span>
        }
      >
        <p className="mb-4 text-xs text-slate-500">请在 Vercel/服务器环境变量中管理以下配置</p>
        <div className="grid grid-cols-1 gap-3 text-sm">
          {[
            { key: 'NEXT_PUBLIC_SUPABASE_URL', desc: 'Supabase 项目 URL' },
            { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', desc: 'Supabase 匿名密钥' },
            { key: 'DEEPSEEK_API_KEY', desc: 'DeepSeek API 密钥' },
            { key: 'KIMI_API_KEY', desc: 'Kimi API 密钥' },
            { key: 'KIMI_BASE_URL', desc: 'Kimi 接口地址' },
            { key: 'KIMI_CHAT_MODEL', desc: 'Kimi 对话模型' },
            { key: 'OLLAMA_HOST', desc: 'Ollama 本地服务地址（可选）' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <code className="font-mono text-xs text-slate-700">{item.key}</code>
              <span className="text-xs text-slate-500">{item.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <Alert
        type="warning"
        showIcon
        message="安全提示"
        description="API Key 与数据库密钥属于敏感信息，请勿在客户端代码中硬编码。如需修改，请通过 Vercel Dashboard 或服务器环境变量管理。"
      />
    </div>
  )
}
