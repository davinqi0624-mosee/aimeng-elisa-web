'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileExcelOutlined,
  FileZipOutlined,
  PictureOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'
import { readExcelWithImages } from '@/lib/xlsx-images'
import JSZip from 'jszip'

interface Agent {
  id: string
  province: string
  province_code?: string
  city?: string
  company_name: string
  contact_name?: string
  phone?: string
  email?: string
  wechat_qr?: string
  wechat_qr_code?: string
  address?: string
  is_active: boolean
  sort_order: number
}

interface ParsedAgentRow {
  province: string
  city: string
  company_name: string
  contact_name: string
  phone: string
  email: string
  address: string
  is_active: boolean
  wechat_qr: { source: 'zip' | 'excel' | null; blob?: Blob; filename?: string }
}

interface ValidationResult {
  valid: boolean
  error?: string
  width?: number
  height?: number
}

interface ApiErrorResponse {
  error?: string
}

const PROVINCE_OPTIONS = [
  '北京', '天津', '河北', '山西', '内蒙古',
  '辽宁', '吉林', '黑龙江', '上海', '江苏',
  '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '广西',
  '海南', '重庆', '四川', '贵州', '云南',
  '西藏', '陕西', '甘肃', '青海', '宁夏',
  '新疆', '台湾', '香港', '澳门',
]

const QR_REQUIREMENTS = { width: 400, height: 400, label: '微信二维码' }

function createImportBatchId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export default function AgentsAdminPage() {
  const { message } = App.useApp()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState('')

  const [form, setForm] = useState({
    province: '',
    province_code: '',
    city: '',
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    is_active: true,
    sort_order: 0,
    wechat_qr: '',
  })

  const [qrUploading, setQrUploading] = useState(false)
  const [qrPreview, setQrPreview] = useState('')
  const qrInputRef = useRef<HTMLInputElement>(null)

  // Bulk import wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedAgentRow[]>([])
  const [qrValidation, setQrValidation] = useState<Record<string, ValidationResult>>({})
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [importResult, setImportResult] = useState<{
    success: number
    failed: number
    skippedImages: number
    errors: string[]
    batchId?: string
  } | null>(null)
  const excelInputRef = useRef<HTMLInputElement | null>(null)
  const zipInputRef = useRef<HTMLInputElement | null>(null)

  const fetchAgents = () => {
    setLoading(true)
    setPageError('')
    fetch('/api/admin/agents')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setAgents([])
          setPageError(d.error)
        } else {
          setAgents(d.agents || [])
        }
        setLoading(false)
      })
      .catch((err) => {
        setAgents([])
        setPageError(err.message || '代理商加载失败')
        setLoading(false)
      })
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次后台数据请求。
    fetchAgents()
  }, [])

  const resetForm = () => {
    setForm({
      province: '',
      province_code: '',
      city: '',
      company_name: '',
      contact_name: '',
      phone: '',
      email: '',
      address: '',
      is_active: true,
      sort_order: 0,
      wechat_qr: '',
    })
    setEditingAgent(null)
    setQrPreview('')
    setQrUploading(false)
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setForm({
      province: agent.province,
      province_code: agent.province_code || '',
      city: agent.city || '',
      company_name: agent.company_name,
      contact_name: agent.contact_name || '',
      phone: agent.phone || '',
      email: agent.email || '',
      address: agent.address || '',
      is_active: agent.is_active,
      sort_order: agent.sort_order,
      wechat_qr: agent.wechat_qr || '',
    })
    setQrPreview(agent.wechat_qr || '')
    setShowForm(true)
  }

  const handleQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif']
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
      message.error('仅支持 JPG、JPEG、PNG、GIF 格式的图片')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      message.error('文件超过大小限制')
      return
    }

    setQrUploading(true)

    try {
      const { compressImage } = await import('@/lib/image-compress')
      const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.85, maxSizeMB: 1 })
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const timestamp = Date.now()

      // Path format: agents/{agentId}/qr_{timestamp}.{ext} when editing,
      // agents/qr/qr_{timestamp}.{ext} when creating
      const agentId = editingAgent?.id
      const path = agentId
        ? `agents/${agentId}/qr_${timestamp}.${ext}`
        : `agents/qr/qr_${timestamp}.${ext}`

      const body = new FormData()
      body.append('file', compressed, file.name)
      body.append('bucket', 'agent-assets')
      body.append('path', path)

      const oldUrl = editingAgent?.wechat_qr
      if (oldUrl) body.append('old_url', oldUrl)

      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) {
        console.error('QR upload error:', data.error)
        message.error('二维码上传失败: ' + (data.error || '未知错误'))
        setQrUploading(false)
        return
      }

      setQrPreview(data.url)
      setForm((prev) => ({ ...prev, wechat_qr: data.url }))
    } catch (err: unknown) {
      console.error('QR upload exception:', err)
      message.error('二维码上传失败: ' + (err instanceof Error ? err.message : '网络或服务器错误'))
    } finally {
      setQrUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.province || !form.company_name) {
      message.warning('请填写省份和单位名称')
      return
    }

    setSaving(true)
    try {
      const url = '/api/admin/agents'
      const method = editingAgent ? 'PUT' : 'POST'
      const body = editingAgent
        ? { id: editingAgent.id, ...form }
        : form

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as ApiErrorResponse
        message.error(err.error || '保存失败')
        return
      }

      setShowForm(false)
      resetForm()
      fetchAgents()
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/agents?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as ApiErrorResponse
        message.error(err.error || '删除失败')
        return
      }
      fetchAgents()
    } catch {
      message.error('删除失败')
    }
  }

  async function validateQrImage(blob: Blob): Promise<ValidationResult> {
    if (blob.size > 2 * 1024 * 1024) return { valid: false, error: '超过 2MB 限制' }
    const ext = blob.type
    if (!ext.includes('image/jpeg') && !ext.includes('image/png') && !ext.includes('image/jpg')) {
      return { valid: false, error: '仅支持 JPG/PNG 格式' }
    }
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(blob)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const tolerance = 0.05
        const minW = QR_REQUIREMENTS.width * (1 - tolerance)
        const maxW = QR_REQUIREMENTS.width * (1 + tolerance)
        const minH = QR_REQUIREMENTS.height * (1 - tolerance)
        const maxH = QR_REQUIREMENTS.height * (1 + tolerance)
        if (img.width < minW || img.width > maxW || img.height < minH || img.height > maxH) {
          resolve({ valid: false, width: img.width, height: img.height, error: `要求 ${QR_REQUIREMENTS.width}x${QR_REQUIREMENTS.height}px, 实际 ${img.width}x${img.height}px` })
        } else {
          resolve({ valid: true, width: img.width, height: img.height })
        }
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ valid: false, error: '无法解析图片' }) }
      img.src = url
    })
  }

  async function extractZipImages(file: File): Promise<Map<string, Blob>> {
    const zip = await JSZip.loadAsync(file)
    const map = new Map<string, Blob>()
    const entries = Object.entries(zip.files).filter(([name, entry]) => {
      return !entry.dir && /\.(jpg|jpeg|png)$/i.test(name)
    })
    for (const [name, entry] of entries) {
      const blob = await entry.async('blob')
      const filename = name.split('/').pop()?.toLowerCase() || ''
      if (filename) map.set(filename, blob)
    }
    return map
  }

  async function parseFiles() {
    if (!excelFile) return
    setParsing(true)
    try {
      let zipMap = new Map<string, Blob>()
      if (zipFile) {
        zipMap = await extractZipImages(zipFile)
      }

      const { rows, images: excelImages } = await readExcelWithImages(excelFile)
      if (rows.length < 2) {
        setParsedRows([])
        setParsing(false)
        return
      }

      const embeddedMap = new Map<string, Blob>()
      excelImages.forEach((img) => embeddedMap.set(`${img.row}-${img.col}`, img.blob))

      const parsed: ParsedAgentRow[] = []
      const validations: Record<string, ValidationResult> = {}

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const company_name = String(row[2] || '').trim()
        if (!company_name) continue

        const cellValue = String(row[8] || '').trim()
        let blob: Blob | undefined
        let source: 'zip' | 'excel' | null = null
        let filename: string | undefined

        if (cellValue && zipMap.has(cellValue.toLowerCase())) {
          blob = zipMap.get(cellValue.toLowerCase())
          source = 'zip'
          filename = cellValue
        }
        if (!blob) {
          const embedded = embeddedMap.get(`${i}-8`)
          if (embedded) {
            blob = embedded
            source = 'excel'
          }
        }

        let qrInfo: ParsedAgentRow['wechat_qr'] = { source: null }
        if (blob) {
          qrInfo = { source, blob, filename }
          validations[`row-${i}`] = await validateQrImage(blob)
        }

        parsed.push({
          province: String(row[0] || '').trim(),
          city: String(row[1] || '').trim(),
          company_name,
          contact_name: String(row[3] || '').trim(),
          phone: String(row[4] || '').trim(),
          email: String(row[5] || '').trim(),
          address: String(row[6] || '').trim(),
          is_active: String(row[7] || '').trim().toLowerCase() === 'false' ? false : true,
          wechat_qr: qrInfo,
        })
      }

      setParsedRows(parsed)
      setQrValidation(validations)
      setWizardStep(2)
    } catch (e: unknown) {
      message.error('解析失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
    setParsing(false)
  }

  async function importRows() {
    if (parsedRows.length === 0) return
    setImporting(true)
    setWizardStep(3)
    const batchId = createImportBatchId()
    let success = 0
    let failed = 0
    let skippedImages = 0
    const errors: string[] = []
    const createdIds: string[] = []

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i]
      setImportProgress(`正在导入 ${i + 1}/${parsedRows.length}: ${row.company_name}...`)
      try {
        let wechat_qr_url = ''
        const img = row.wechat_qr
        if (img.blob) {
          const rowKey = `row-${i + 1}`
          const validation = qrValidation[rowKey]
          if (validation?.valid) {
            const ext = img.blob.type.includes('png') ? 'png' : 'jpg'
            const timestamp = Date.now()
            const path = `agents/bulk/qr_${timestamp}_${Math.random().toString(36).slice(2)}.${ext}`
            const body = new FormData()
            body.append('file', img.blob)
            body.append('bucket', 'agent-assets')
            body.append('path', path)
            const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body })
            const uploadData = await uploadRes.json()
            if (uploadRes.ok && uploadData.url) {
              wechat_qr_url = uploadData.url
            } else {
              console.error('Bulk import QR upload error:', uploadData.error)
              skippedImages++
            }
          } else {
            skippedImages++
          }
        }

        const res = await fetch('/api/admin/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            province: row.province,
            city: row.city,
            company_name: row.company_name,
            contact_name: row.contact_name,
            phone: row.phone,
            email: row.email,
            address: row.address,
            is_active: row.is_active,
            sort_order: 0,
            ...(wechat_qr_url ? { wechat_qr: wechat_qr_url } : {}),
          }),
        })
        if (res.ok) {
          success++
          try {
            const d = await res.json()
            if (d.id) createdIds.push(d.id)
          } catch {}
        } else {
          failed++
          const d = await res.json().catch(() => ({})) as ApiErrorResponse
          errors.push(`${row.company_name || '未命名'}: ${d.error || '保存失败'}`)
        }
      } catch (err: unknown) {
        failed++
        errors.push(`${row.company_name || '未命名'}: ${err instanceof Error ? err.message : '未知错误'}`)
      }
    }

    try {
      await fetch('/api/admin/bulk-import-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: batchId,
          type: 'agents',
          product_count: parsedRows.length,
          image_count: parsedRows.filter((r) => r.wechat_qr.blob).length,
          status: 'completed',
          details: { success, failed, skippedImages, created_ids: createdIds },
        }),
      })
    } catch {
      // ignore
    }

    setImportResult({ success, failed, skippedImages, errors, batchId })
    setImporting(false)
    setImportProgress('')
    fetchAgents()
  }

  function closeWizard() {
    setWizardOpen(false)
    setWizardStep(1)
    setExcelFile(null)
    setZipFile(null)
    setParsedRows([])
    setQrValidation({})
    setImportResult(null)
    setImportProgress('')
    if (excelInputRef.current) excelInputRef.current.value = ''
    if (zipInputRef.current) zipInputRef.current.value = ''
  }

  async function downloadAgentTemplate() {
    // We reuse the xlsx helper but generate an agent-specific template
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const wsData = [
      ['province', 'city', 'company_name', 'contact_name', 'phone', 'email', 'address', 'is_active', 'wechat_qr'],
      ['北京', '北京', '北京生物科技有限公司', '张先生', '13800138000', 'beijing@example.com', '北京市海淀区', 'true', '在此单元格嵌入图片或填写ZIP内文件名'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [
      { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 10 }, { wch: 36 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Agents')
    XLSX.writeFile(wb, 'agent_import_template.xlsx')
  }

  const filteredAgents = agents.filter(
    (a) =>
      a.province.includes(searchQuery) ||
      a.company_name.includes(searchQuery) ||
      (a.contact_name || '').includes(searchQuery)
  )

  const columns: ColumnsType<Agent> = [
    {
      title: '省份',
      dataIndex: 'province',
      key: 'province',
      width: 100,
    },
    {
      title: '单位名称',
      dataIndex: 'company_name',
      key: 'company_name',
      ellipsis: true,
    },
    {
      title: '联系人',
      dataIndex: 'contact_name',
      key: 'contact_name',
      width: 110,
      render: (v?: string) => v || '-',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (v?: string) => v || '-',
    },
    {
      title: '微信二维码',
      key: 'wechat_qr',
      width: 100,
      render: (_, agent) =>
        agent.wechat_qr ? (
          <img src={agent.wechat_qr} alt="QR" className="h-8 w-8 rounded border border-slate-200 object-cover" />
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_, agent) => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(agent)} />
          <Popconfirm
            title="确定删除该代理商？"
            onConfirm={() => handleDelete(agent.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const previewColumns: ColumnsType<ParsedAgentRow> = [
    {
      title: '省份 / 城市',
      key: 'province',
      render: (_, row) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{row.province}</div>
          <div className="text-xs text-slate-400">{row.city || '-'}</div>
        </div>
      ),
    },
    {
      title: '单位名称',
      dataIndex: 'company_name',
      key: 'company_name',
    },
    {
      title: '联系人 / 电话',
      key: 'contact',
      render: (_, row) => (
        <div>
          <div className="text-slate-700">{row.contact_name || '-'}</div>
          <div className="text-xs text-slate-400">{row.phone || '-'}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '二维码',
      key: 'qr',
      width: 190,
      render: (_, row, idx) => {
        const v = qrValidation[`row-${idx + 1}`]
        let status: 'ok' | 'warn' | 'none' = 'none'
        if (row.wechat_qr.blob) status = v?.valid ? 'ok' : 'warn'
        return (
          <div>
            {status === 'ok' ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>{QR_REQUIREMENTS.label}</Tag>
            ) : status === 'warn' ? (
              <Tag color="warning" icon={<WarningOutlined />}>{QR_REQUIREMENTS.label}</Tag>
            ) : (
              <Tag icon={<PictureOutlined />}>{QR_REQUIREMENTS.label}</Tag>
            )}
            {status === 'warn' && v?.error && (
              <p className="mt-0.5 text-xs text-amber-600">{v.error}</p>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<EnvironmentOutlined />}
        title="代理商管理"
        description="管理全国各地代理商信息"
        extra={
          <>
            <Button icon={<FileExcelOutlined />} onClick={() => setWizardOpen(true)}>
              批量导入
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增代理商
            </Button>
          </>
        }
      />

      {/* Error */}
      {pageError && <Alert type="error" showIcon message={pageError} style={{ marginBottom: 16 }} />}

      {/* Search */}
      <Input
        className="mb-4"
        allowClear
        prefix={<SearchOutlined className="text-slate-400" />}
        placeholder="搜索省份、单位名称、联系人..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Agent List Table */}
      <Table<Agent>
        rowKey="id"
        columns={columns}
        dataSource={filteredAgents}
        loading={loading}
        locale={{ emptyText: '暂无代理商数据' }}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 家代理商` }}
        scroll={{ x: 900 }}
      />

      {/* Create/Edit Modal */}
      <Modal
        open={showForm}
        title={editingAgent ? '编辑代理商' : '新增代理商'}
        width={600}
        footer={null}
        maskClosable={false}
        keyboard={false}
        onCancel={() => {
          setShowForm(false)
          resetForm()
        }}
      >
        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">省份 *</label>
              <Select
                className="w-full"
                value={form.province}
                onChange={(province) => setForm({ ...form, province, province_code: province })}
                options={PROVINCE_OPTIONS.map((p) => ({ value: p, label: p }))}
                placeholder="请选择省份"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">城市</label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="如：浦东新区"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">单位名称 *</label>
            <Input
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              placeholder="代理商公司名称"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">联系人</label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="如：张经理"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">电话</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="如：138-0000-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">邮箱</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="如：xxx@company.com"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              >
                启用
              </Checkbox>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">详细地址</label>
            <Input.TextArea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="代理商详细地址"
              rows={2}
              className="resize-none"
            />
          </div>

          {/* QR Code Upload */}
          <div>
            <label className="mb-1 block text-xs text-slate-500">微信二维码</label>
            <div className="flex items-center gap-4">
              {qrPreview && (
                <div className="relative">
                  <img
                    src={qrPreview}
                    alt="QR Preview"
                    className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleQrFileChange}
                />
                <Button
                  icon={<UploadOutlined />}
                  disabled={qrUploading}
                  onClick={() => qrInputRef.current?.click()}
                >
                  {qrUploading ? '上传中...' : qrPreview ? '更换二维码' : '上传二维码'}
                </Button>
                {qrPreview && (
                  <p className="mt-1 max-w-[200px] truncate text-xs text-slate-400">{qrPreview}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={saving} disabled={qrUploading}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Wizard */}
      <Modal
        open={wizardOpen}
        title="批量导入代理商"
        width={896}
        maskClosable={false}
        keyboard={false}
        onCancel={closeWizard}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        footer={
          wizardStep === 3
            ? null
            : wizardStep === 1
              ? [
                  <Button key="cancel" onClick={closeWizard}>取消</Button>,
                  <Button key="next" type="primary" onClick={parseFiles} disabled={!excelFile || parsing} loading={parsing}>
                    {parsing ? '解析中...' : '下一步'}
                  </Button>,
                ]
              : [
                  <Button key="back" onClick={() => setWizardStep(1)}>返回</Button>,
                  <Button key="import" type="primary" onClick={importRows} disabled={parsedRows.length === 0 || importing}>
                    开始导入
                  </Button>,
                ]
        }
      >
        <Steps
          className="mb-6"
          size="small"
          current={wizardStep - 1}
          items={[{ title: '上传文件' }, { title: '预览校验' }, { title: '导入结果' }]}
        />

        {wizardStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">上传 Excel 数据表和 ZIP 二维码包（可选），二维码列支持填写文件名或嵌入图片。</p>
              <Button type="link" icon={<DownloadOutlined />} onClick={downloadAgentTemplate}>
                下载模板
              </Button>
            </div>

            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center transition-colors hover:border-cyan-400"
              onClick={() => excelInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setExcelFile(f) }}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setExcelFile(f) }}
              />
              <FileExcelOutlined className="mx-auto mb-3 text-4xl text-slate-300" />
              <p className="text-sm font-medium text-slate-700">{excelFile ? excelFile.name : '点击或拖拽上传 Excel 文件'}</p>
              <p className="mt-1 text-xs text-slate-400">支持 .xlsx, .xls 格式</p>
            </div>

            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center transition-colors hover:border-cyan-400"
              onClick={() => zipInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setZipFile(f) }}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setZipFile(f) }}
              />
              <FileZipOutlined className="mx-auto mb-3 text-4xl text-slate-300" />
              <p className="text-sm font-medium text-slate-700">{zipFile ? zipFile.name : '点击或拖拽上传 ZIP 二维码包（可选）'}</p>
              <p className="mt-1 text-xs text-slate-400">将二维码文件名填入 Excel 对应列即可自动匹配</p>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500">
                共解析 <span className="font-medium text-slate-900">{parsedRows.length}</span> 条代理商数据
              </p>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircleOutlined /> 校验通过</span>
                <span className="flex items-center gap-1 text-amber-600"><WarningOutlined /> 尺寸不符</span>
                <span className="flex items-center gap-1 text-slate-400"><PictureOutlined /> 无图片</span>
              </div>
            </div>

            <Table<ParsedAgentRow>
              size="small"
              rowKey={(_, idx) => `row-${(idx ?? 0) + 1}`}
              columns={previewColumns}
              dataSource={parsedRows}
              pagination={false}
            />
          </div>
        )}

        {wizardStep === 3 && (
          <div className="space-y-6 py-8 text-center">
            {importing ? (
              <>
                <Spin size="large" />
                <p className="mt-4 text-sm text-slate-600">{importProgress}</p>
              </>
            ) : importResult ? (
              <>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-600">{importResult.success}</div>
                    <div className="mt-1 text-xs text-slate-500">导入成功</div>
                  </div>
                  <div className="h-10 w-px bg-slate-200" />
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-500">{importResult.failed}</div>
                    <div className="mt-1 text-xs text-slate-500">导入失败</div>
                  </div>
                  <div className="h-10 w-px bg-slate-200" />
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-500">{importResult.skippedImages}</div>
                    <div className="mt-1 text-xs text-slate-500">二维码跳过</div>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-red-100 bg-red-50 p-4 text-left">
                    <p className="mb-2 text-xs font-medium text-red-700">错误详情：</p>
                    <ul className="space-y-1">
                      {importResult.errors.map((err, i) => (
                        <li key={i} className="text-xs text-red-600">{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button type="primary" onClick={closeWizard}>
                  完成
                </Button>
              </>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  )
}
