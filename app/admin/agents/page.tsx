'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Building2,
  User,
  Phone,
  Mail,
  MapPinned,
  Upload,
  CheckCircle2,
  FileSpreadsheet,
  Archive,
  AlertTriangle,
  Image as ImageIcon,
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react'
import { readExcelWithImages, generateExcelTemplate } from '@/lib/xlsx-images'
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

export default function AgentsAdminPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)

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

  const [qrFile, setQrFile] = useState<File | null>(null)
  const [qrUploading, setQrUploading] = useState(false)
  const [qrPreview, setQrPreview] = useState('')
  const qrInputRef = useRef<HTMLInputElement>(null)

  // Bulk import wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [zipImages, setZipImages] = useState<Map<string, Blob>>(new Map())
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
    fetch('/api/agents')
      .then((r) => r.json())
      .then((d) => {
        setAgents(d.agents || [])
        setLoading(false)
      })
      .catch(() => {
        setAgents([])
        setLoading(false)
      })
  }

  useEffect(() => {
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
    setQrFile(null)
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
    setQrFile(null)
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
      alert('仅支持 JPG、JPEG、PNG、GIF 格式的图片')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('文件超过大小限制')
      return
    }

    setQrFile(file)
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
        alert('二维码上传失败: ' + (data.error || '未知错误'))
        setQrUploading(false)
        return
      }

      setQrPreview(data.url)
      setForm((prev) => ({ ...prev, wechat_qr: data.url }))
    } catch (err: any) {
      console.error('QR upload exception:', err)
      alert('二维码上传失败: ' + (err.message || '网络或服务器错误'))
    } finally {
      setQrUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.province || !form.company_name) return

    setSaving(true)
    try {
      const url = '/api/agents'
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
        const err = await res.json()
        alert(err.error || '保存失败')
        return
      }

      setShowForm(false)
      resetForm()
      fetchAgents()
    } catch {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该代理商？')) return
    try {
      const res = await fetch(`/api/agents?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || '删除失败')
        return
      }
      fetchAgents()
    } catch {
      alert('删除失败')
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
        setZipImages(zipMap)
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
    } catch (e: any) {
      alert('解析失败: ' + (e.message || '未知错误'))
    }
    setParsing(false)
  }

  async function importRows() {
    if (parsedRows.length === 0) return
    setImporting(true)
    setWizardStep(3)
    const batchId = crypto.randomUUID()
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

        const res = await fetch('/api/agents', {
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
          const d = await res.json().catch(() => ({}))
          errors.push(`${row.company_name || '未命名'}: ${d.error || '保存失败'}`)
        }
      } catch (err: any) {
        failed++
        errors.push(`${row.company_name || '未命名'}: ${err.message || '未知错误'}`)
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
    setZipImages(new Map())
    setParsedRows([])
    setQrValidation({})
    setImportResult(null)
    setImportProgress('')
    if (excelInputRef.current) excelInputRef.current.value = ''
    if (zipInputRef.current) zipInputRef.current.value = ''
  }

  function downloadAgentTemplate() {
    // We reuse the xlsx helper but generate an agent-specific template
    const XLSX = require('xlsx')
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            代理商管理
          </h1>
          <p className="text-sm text-slate-400 mt-1">管理全国各地代理商信息</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            批量导入
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增代理商
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索省份、单位名称、联系人..."
          className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500"
        />
      </div>

      {/* Agent List Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
          <div className="col-span-2">省份</div>
          <div className="col-span-2">单位名称</div>
          <div className="col-span-2">联系人</div>
          <div className="col-span-2">电话</div>
          <div className="col-span-1">微信二维码</div>
          <div className="col-span-1">状态</div>
          <div className="col-span-2 text-right">操作</div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">加载中...</div>
        ) : filteredAgents.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">暂无代理商数据</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-2 text-sm text-gray-900">{agent.province}</div>
                <div className="col-span-2 text-sm text-gray-700 truncate">{agent.company_name}</div>
                <div className="col-span-2 text-sm text-gray-600">{agent.contact_name || '-'}</div>
                <div className="col-span-2 text-sm text-gray-600">{agent.phone || '-'}</div>
                <div className="col-span-1">
                  {agent.wechat_qr ? (
                    <img src={agent.wechat_qr} alt="QR" className="w-8 h-8 object-cover rounded border border-gray-200" />
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div className="col-span-1">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      agent.is_active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {agent.is_active ? '启用' : '禁用'}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEdit(agent)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingAgent ? '编辑代理商' : '新增代理商'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    省份 *
                  </label>
                  <select
                    value={form.province}
                    onChange={(e) => {
                      const province = e.target.value
                      setForm({
                        ...form,
                        province,
                        province_code: province,
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  >
                    <option value="">请选择省份</option>
                    {PROVINCE_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">城市</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="如：浦东新区"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  单位名称 *
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) =>
                    setForm({ ...form, company_name: e.target.value })
                  }
                  placeholder="代理商公司名称"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">联系人</label>
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) =>
                      setForm({ ...form, contact_name: e.target.value })
                    }
                    placeholder="如：张经理"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">电话</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="如：138-0000-0000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="如：xxx@company.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-cyan-600"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    启用
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">详细地址</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="代理商详细地址"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              {/* QR Code Upload */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">微信二维码</label>
                <div className="flex items-center gap-4">
                  {qrPreview && (
                    <div className="relative">
                      <img
                        src={qrPreview}
                        alt="QR Preview"
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={qrInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleQrFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrInputRef.current?.click()}
                      disabled={qrUploading}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {qrUploading ? '上传中...' : qrPreview ? '更换二维码' : '上传二维码'}
                    </button>
                    {qrPreview && (
                      <p className="text-xs text-gray-400 mt-1 truncate max-w-[200px]">{qrPreview}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving || qrUploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Wizard */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Wizard Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">批量导入代理商</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        wizardStep >= step ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {step}
                      </div>
                      <span className={`text-xs ${wizardStep >= step ? 'text-gray-700' : 'text-gray-400'}`}>
                        {step === 1 ? '上传文件' : step === 2 ? '预览校验' : '导入结果'}
                      </span>
                      {step < 3 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={closeWizard} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            {/* Wizard Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {wizardStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">上传 Excel 数据表和 ZIP 二维码包（可选），二维码列支持填写文件名或嵌入图片。</p>
                    <button onClick={downloadAgentTemplate} className="flex items-center gap-1.5 text-sm text-cyan-600 hover:text-cyan-700">
                      <Download className="w-4 h-4" /> 下载模板
                    </button>
                  </div>

                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-cyan-400 transition-colors cursor-pointer bg-gray-50/50"
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
                    <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700">{excelFile ? excelFile.name : '点击或拖拽上传 Excel 文件'}</p>
                    <p className="text-xs text-gray-400 mt-1">支持 .xlsx, .xls 格式</p>
                  </div>

                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-cyan-400 transition-colors cursor-pointer bg-gray-50/50"
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
                    <Archive className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700">{zipFile ? zipFile.name : '点击或拖拽上传 ZIP 二维码包（可选）'}</p>
                    <p className="text-xs text-gray-400 mt-1">将二维码文件名填入 Excel 对应列即可自动匹配</p>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      共解析 <span className="font-medium text-gray-900">{parsedRows.length}</span> 条代理商数据
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> 校验通过</span>
                      <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> 尺寸不符</span>
                      <span className="flex items-center gap-1 text-gray-400"><ImageIcon className="w-3.5 h-3.5" /> 无图片</span>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">省份 / 城市</th>
                          <th className="px-3 py-2 text-left font-medium">单位名称</th>
                          <th className="px-3 py-2 text-left font-medium">联系人 / 电话</th>
                          <th className="px-3 py-2 text-left font-medium">状态</th>
                          <th className="px-3 py-2 text-left font-medium">二维码</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRows.map((row, idx) => {
                          const rowKey = `row-${idx + 1}`
                          const v = qrValidation[rowKey]
                          const img = row.wechat_qr
                          let status: 'ok' | 'warn' | 'none' = 'none'
                          if (img.blob) status = v?.valid ? 'ok' : 'warn'
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-gray-900">{row.province}</div>
                                <div className="text-xs text-gray-400">{row.city || '-'}</div>
                              </td>
                              <td className="px-3 py-2.5 text-gray-700">{row.company_name}</td>
                              <td className="px-3 py-2.5">
                                <div className="text-gray-700">{row.contact_name || '-'}</div>
                                <div className="text-xs text-gray-400">{row.phone || '-'}</div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'}`}>
                                  {row.is_active ? '启用' : '禁用'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  status === 'ok' ? 'bg-emerald-50 text-emerald-700' :
                                  status === 'warn' ? 'bg-amber-50 text-amber-700' :
                                  'bg-gray-50 text-gray-400'
                                }`}>
                                  {status === 'ok' ? <CheckCircle2 className="w-3 h-3" /> :
                                   status === 'warn' ? <AlertTriangle className="w-3 h-3" /> :
                                   <ImageIcon className="w-3 h-3" />}
                                  {QR_REQUIREMENTS.label}
                                </span>
                                {status === 'warn' && v?.error && (
                                  <p className="text-[10px] text-amber-600 mt-0.5">{v.error}</p>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-6 text-center py-8">
                  {importing ? (
                    <>
                      <Loader2 className="w-10 h-10 animate-spin text-cyan-600 mx-auto" />
                      <p className="text-sm text-gray-600 mt-4">{importProgress}</p>
                    </>
                  ) : importResult ? (
                    <>
                      <div className="flex items-center justify-center gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-emerald-600">{importResult.success}</div>
                          <div className="text-xs text-gray-500 mt-1">导入成功</div>
                        </div>
                        <div className="w-px h-10 bg-gray-200" />
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-500">{importResult.failed}</div>
                          <div className="text-xs text-gray-500 mt-1">导入失败</div>
                        </div>
                        <div className="w-px h-10 bg-gray-200" />
                        <div className="text-center">
                          <div className="text-3xl font-bold text-amber-500">{importResult.skippedImages}</div>
                          <div className="text-xs text-gray-500 mt-1">二维码跳过</div>
                        </div>
                      </div>
                      {importResult.errors.length > 0 && (
                        <div className="text-left bg-red-50 border border-red-100 rounded-lg p-4 max-h-48 overflow-y-auto">
                          <p className="text-xs font-medium text-red-700 mb-2">错误详情：</p>
                          <ul className="space-y-1">
                            {importResult.errors.map((err, i) => (
                              <li key={i} className="text-xs text-red-600">{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <button onClick={closeWizard} className="px-5 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700">
                        完成
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>

            {/* Wizard Footer */}
            {wizardStep !== 3 && (
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                {wizardStep === 1 && (
                  <>
                    <button onClick={closeWizard} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
                    <button
                      onClick={parseFiles}
                      disabled={!excelFile || parsing}
                      className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {parsing ? <><Loader2 className="w-4 h-4 animate-spin" /> 解析中...</> : '下一步'}
                    </button>
                  </>
                )}
                {wizardStep === 2 && (
                  <>
                    <button onClick={() => setWizardStep(1)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">返回</button>
                    <button
                      onClick={importRows}
                      disabled={parsedRows.length === 0 || importing}
                      className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                    >
                      开始导入
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
