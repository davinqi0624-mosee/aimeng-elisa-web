'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Package, Plus, Pencil, Trash2, Loader2, X, Search, Upload,
  FileSpreadsheet, Archive, CheckCircle, AlertTriangle, Image as ImageIcon,
  ChevronRight, Download,
} from 'lucide-react'
import { readExcelWithImages, generateExcelTemplate } from '@/lib/xlsx-images'
import { compressImage, formatFileSize } from '@/lib/image-compress'
import JSZip from 'jszip'

interface Product {
  id: string
  catalog_number: string | null
  name: string
  target: string
  detection_range: string | null
  sensitivity: string | null
  size: string | null
  price: number | null
  status: string
  stock_status: string
  product_image: string | null
  standard_curve_image: string | null
  validation_image: string | null
  additional_image: string | null
  datasheet_pdf: string | null
  created_at: string
}

interface ParsedRow {
  catalog_number: string
  name: string
  target: string
  detection_range: string
  sensitivity: string
  size: string
  price: number | null
  stock_status: string
  status: string
  images: Record<string, { source: 'zip' | 'excel' | null; blob?: Blob; filename?: string }>
}

interface ValidationResult {
  valid: boolean
  error?: string
  width?: number
  height?: number
}

const IMAGE_FIELDS = [
  { key: 'product_image', label: '产品图片' },
  { key: 'standard_curve_image', label: '标准曲线图' },
  { key: 'validation_image', label: '验证图' },
  { key: 'additional_image', label: '附加图片' },
] as const

const COL_MAP: Record<number, string> = {
  9: 'product_image',
  10: 'standard_curve_image',
  11: 'validation_image',
  12: 'additional_image',
}

const IMAGE_REQUIREMENTS: Record<string, { width: number; height: number; label: string }> = {
  product_image: { width: 600, height: 600, label: '产品照片' },
  standard_curve_image: { width: 800, height: 400, label: '标准曲线图' },
  validation_image: { width: 800, height: 400, label: '验证图' },
  additional_image: { width: 600, height: 400, label: '附加图片' },
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({
    name: '', target: '', detection_range: '', sensitivity: '', price: '',
    status: 'active', stock_status: 'in_stock',
    product_image: '', standard_curve_image: '', validation_image: '',
    additional_image: '', datasheet_pdf: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Bulk import wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [zipImages, setZipImages] = useState<Map<string, Blob>>(new Map())
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [imageValidations, setImageValidations] = useState<Record<string, Record<string, ValidationResult>>>({})
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

  const fetchProducts = () => {
    setLoading(true)
    fetch('/api/admin/products')
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchProducts() }, [])

  const resetForm = () => {
    setForm({
      name: '', target: '', detection_range: '', sensitivity: '', price: '',
      status: 'active', stock_status: 'in_stock',
      product_image: '', standard_curve_image: '', validation_image: '',
      additional_image: '', datasheet_pdf: '',
    })
    setEditingProduct(null)
  }

  const openCreate = () => { resetForm(); setShowForm(true) }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setForm({
      name: p.name, target: p.target, detection_range: p.detection_range || '',
      sensitivity: p.sensitivity || '', price: p.price ? String(p.price) : '',
      status: p.status, stock_status: p.stock_status,
      product_image: p.product_image || '', standard_curve_image: p.standard_curve_image || '',
      validation_image: p.validation_image || '', additional_image: p.additional_image || '',
      datasheet_pdf: p.datasheet_pdf || '',
    })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const body = { ...form, price: form.price ? parseFloat(form.price) : null }
    try {
      const res = await fetch('/api/admin/products', {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct ? { id: editingProduct.id, ...body } : body),
      })
      if (res.ok) { setShowForm(false); resetForm(); fetchProducts() }
      else { const d = await res.json(); alert(d.error || '保存失败') }
    } catch { alert('保存失败') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个商品吗？')) return
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchProducts()
    } catch {}
  }

  const handleFileUpload = async (field: string, file: File) => {
    if (!file) return
    if (!editingProduct?.id) {
      alert('请先保存商品基本信息，编辑时再上传图片')
      return
    }

    // Original file size check (5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      alert(`文件过大: ${formatFileSize(file.size)}，请选择小于 5MB 的图片`)
      return
    }

    setUploading(field)
    try {
      // Compress image before upload
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85, maxSizeMB: 1 })
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const path = `products/${editingProduct.id}/${field}_${Date.now()}.${ext}`
      const body = new FormData()
      body.append('file', compressed, file.name)
      body.append('bucket', 'product-assets')
      body.append('path', path)

      // Pass old URL for auto-deletion
      const oldUrl = editingProduct?.[field as keyof Product]
      if (typeof oldUrl === 'string' && oldUrl) {
        body.append('old_url', oldUrl)
      }

      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) {
        alert('上传失败: ' + (data.error || '未知错误'))
      } else {
        setForm((prev) => ({ ...prev, [field]: data.url }))
      }
    } catch (err: any) {
      alert('上传失败: ' + (err.message || '网络错误'))
    } finally {
      setUploading(null)
    }
  }

  function normalizeStockStatus(val: string): string {
    const map: Record<string, string> = {
      '有货': 'in_stock', 'in_stock': 'in_stock',
      '缺货': 'out_of_stock', 'out_of_stock': 'out_of_stock',
      '库存紧张': 'low_stock', '紧张': 'low_stock', 'low_stock': 'low_stock',
    }
    return map[val?.trim()] || 'in_stock'
  }

  function normalizeStatus(val: string): string {
    const map: Record<string, string> = {
      '上架': 'active', 'active': 'active',
      '草稿': 'draft', 'draft': 'draft',
      '归档': 'archived', 'archived': 'archived',
    }
    return map[val?.trim()] || 'draft'
  }

  async function validateImage(blob: Blob, field: string): Promise<ValidationResult> {
    const req = IMAGE_REQUIREMENTS[field]
    if (!req) return { valid: false, error: '未知图片字段' }
    if (blob.size > 5 * 1024 * 1024) return { valid: false, error: '超过 5MB 限制' }
    const ext = blob.type
    if (!ext.includes('image/jpeg') && !ext.includes('image/png') && !ext.includes('image/jpg')) {
      return { valid: false, error: '仅支持 JPG/PNG 格式' }
    }
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(blob)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const tolerance = 0.10
        const minW = req.width * (1 - tolerance)
        const maxW = req.width * (1 + tolerance)
        const minH = req.height * (1 - tolerance)
        const maxH = req.height * (1 + tolerance)
        if (img.width < minW || img.width > maxW || img.height < minH || img.height > maxH) {
          resolve({ valid: false, width: img.width, height: img.height, error: `要求 ${req.width}x${req.height}px, 实际 ${img.width}x${img.height}px` })
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

      // Map embedded images by row-col
      const embeddedMap = new Map<string, Blob>()
      excelImages.forEach((img) => embeddedMap.set(`${img.row}-${img.col}`, img.blob))

      const parsed: ParsedRow[] = []
      const validations: Record<string, Record<string, ValidationResult>> = {}

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const catalog_number = String(row[0] || '').trim()
        const name = String(row[1] || '').trim()
        const target = String(row[2] || '').trim()
        if (!name && !target) continue

        const rowImages: ParsedRow['images'] = {}
        const rowKey = `row-${i}`
        validations[rowKey] = {}

        for (const [colIdx, field] of Object.entries(COL_MAP)) {
          const col = parseInt(colIdx, 10)
          const cellValue = String(row[col] || '').trim()
          let blob: Blob | undefined
          let source: 'zip' | 'excel' | null = null
          let filename: string | undefined

          // Try ZIP match by filename
          if (cellValue && zipMap.has(cellValue.toLowerCase())) {
            blob = zipMap.get(cellValue.toLowerCase())
            source = 'zip'
            filename = cellValue
          }
          // Fall back to embedded Excel image
          if (!blob) {
            const embedded = embeddedMap.get(`${i}-${col}`)
            if (embedded) {
              blob = embedded
              source = 'excel'
            }
          }

          if (blob) {
            rowImages[field] = { source, blob, filename }
            validations[rowKey][field] = await validateImage(blob, field)
          } else {
            rowImages[field] = { source: null }
          }
        }

        parsed.push({
          catalog_number,
          name,
          target,
          detection_range: String(row[3] || '').trim(),
          sensitivity: String(row[4] || '').trim(),
          size: String(row[5] || '').trim() || '96T',
          price: row[6] ? parseFloat(String(row[6])) : null,
          stock_status: normalizeStockStatus(String(row[7] || '')),
          status: normalizeStatus(String(row[8] || '')),
          images: rowImages,
        })
      }

      setParsedRows(parsed)
      setImageValidations(validations)
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
      setImportProgress(`正在导入 ${i + 1}/${parsedRows.length}: ${row.name || '未命名'}...`)
      try {
        const imageUrls: Record<string, string> = {}
        for (const field of IMAGE_FIELDS.map((f) => f.key)) {
          const img = row.images[field]
          if (!img.blob) continue
          const rowKey = `row-${i + 1}`
          const validation = imageValidations[rowKey]?.[field]
          if (!validation?.valid) {
            skippedImages++
            continue
          }
          const ext = img.blob.type.includes('png') ? 'png' : 'jpg'
          const path = `products/bulk/${field}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
          const uploadBody = new FormData()
          uploadBody.append('file', img.blob)
          uploadBody.append('bucket', 'product-assets')
          uploadBody.append('path', path)
          const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body: uploadBody })
          const uploadData = await uploadRes.json()
          if (uploadRes.ok && uploadData.url) {
            imageUrls[field] = uploadData.url
          } else {
            console.error('Bulk import image upload error:', uploadData.error)
            skippedImages++
          }
        }

        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalog_number: row.catalog_number,
            name: row.name,
            target: row.target,
            detection_range: row.detection_range,
            sensitivity: row.sensitivity,
            size: row.size,
            price: row.price,
            status: row.status,
            stock_status: row.stock_status,
            ...imageUrls,
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
          errors.push(`${row.name || '未命名'}: ${d.error || '保存失败'}`)
        }
      } catch (err: any) {
        failed++
        errors.push(`${row.name || '未命名'}: ${err.message || '未知错误'}`)
      }
    }

    // Record batch
    try {
      await fetch('/api/admin/bulk-import-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: batchId,
          type: 'products',
          product_count: parsedRows.length,
          image_count: parsedRows.reduce((sum, r) => sum + Object.values(r.images).filter((i) => i.blob).length, 0),
          status: 'completed',
          details: { success, failed, skippedImages, created_ids: createdIds },
        }),
      })
    } catch {
      // Silently ignore batch tracking errors
    }

    setImportResult({ success, failed, skippedImages, errors, batchId })
    setImporting(false)
    setImportProgress('')
    fetchProducts()
  }

  function closeWizard() {
    setWizardOpen(false)
    setWizardStep(1)
    setExcelFile(null)
    setZipFile(null)
    setZipImages(new Map())
    setParsedRows([])
    setImageValidations({})
    setImportResult(null)
    setImportProgress('')
    if (excelInputRef.current) excelInputRef.current.value = ''
    if (zipInputRef.current) zipInputRef.current.value = ''
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.target.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-700',
      draft: 'bg-amber-50 text-amber-700',
      archived: 'bg-gray-50 text-gray-600',
    }
    const label: Record<string, string> = { active: '上架', draft: '草稿', archived: '归档' }
    return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status] || map.draft}`}>{label[status] || status}</span>
  }

  const getStockBadge = (s: string) => {
    const map: Record<string, string> = {
      in_stock: 'bg-emerald-50 text-emerald-700',
      low_stock: 'bg-orange-50 text-orange-700',
      out_of_stock: 'bg-red-50 text-red-700',
    }
    const label: Record<string, string> = { in_stock: '有货', low_stock: '紧张', out_of_stock: '缺货' }
    return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[s] || map.in_stock}`}>{label[s] || s}</span>
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-cyan-400" /> 商品管理
          </h1>
          <p className="text-sm text-slate-400 mt-1">上架、编辑、下架 ELISA 试剂盒商品</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWizardOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-200 rounded-lg text-sm hover:bg-slate-700 transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> 批量导入
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 transition-colors">
            <Plus className="w-4 h-4" /> 新增商品
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索商品名称、靶标..."
          className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500"
        />
      </div>

      {/* Product Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
          <div className="col-span-3">名称 / 靶标</div>
          <div className="col-span-1">图片</div>
          <div className="col-span-1">价格</div>
          <div className="col-span-2">检测范围 / 灵敏度</div>
          <div className="col-span-1">库存</div>
          <div className="col-span-1">状态</div>
          <div className="col-span-3 text-right">操作</div>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">暂无商品</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.target}</div>
                </div>
                <div className="col-span-1">
                  {p.product_image ? (
                    <img src={p.product_image} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </div>
                <div className="col-span-1 text-sm text-gray-600">{p.price ? `¥${p.price}` : '-'}</div>
                <div className="col-span-2 text-xs text-gray-500">
                  <div>{p.detection_range || '-'}</div>
                  <div>{p.sensitivity || '-'}</div>
                </div>
                <div className="col-span-1">{getStockBadge(p.stock_status)}</div>
                <div className="col-span-1">{getStatusBadge(p.status)}</div>
                <div className="col-span-3 flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
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
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editingProduct ? '编辑商品' : '新增商品'}</h3>
              <button onClick={() => { setShowForm(false); resetForm() }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">商品名称 *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">靶标 *</label>
                  <input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">检测范围</label>
                  <input value={form.detection_range} onChange={(e) => setForm({ ...form, detection_range: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">灵敏度</label>
                  <input value={form.sensitivity} onChange={(e) => setForm({ ...form, sensitivity: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">价格</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">库存状态</label>
                  <select value={form.stock_status} onChange={(e) => setForm({ ...form, stock_status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="in_stock">有货</option>
                    <option value="low_stock">库存紧张</option>
                    <option value="out_of_stock">缺货</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">状态</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="active">上架</option>
                    <option value="draft">草稿</option>
                    <option value="archived">归档</option>
                  </select>
                </div>
              </div>

              {/* Image Uploads */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">图片与文档</h4>
                <div className="grid grid-cols-2 gap-4">
                  {IMAGE_FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="file" accept="image/*"
                          ref={(el) => { fileRefs.current[f.key] = el }}
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(f.key, file) }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileRefs.current[f.key]?.click()}
                          disabled={uploading === f.key || !editingProduct}
                          className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          title={!editingProduct ? '保存商品后才可以上传图片' : ''}
                        >
                          {uploading === f.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          {form[f.key] ? '更换' : '上传'}
                        </button>
                        {form[f.key] && (
                          <img src={form[f.key]} alt="" className="w-8 h-8 rounded object-cover border border-gray-200" />
                        )}
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">说明书 PDF</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file" accept=".pdf"
                        ref={(el) => { fileRefs.current['datasheet_pdf'] = el }}
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload('datasheet_pdf', file) }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileRefs.current['datasheet_pdf']?.click()}
                        disabled={uploading === 'datasheet_pdf' || !editingProduct}
                        className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        title={!editingProduct ? '保存商品后才可以上传图片' : ''}
                      >
                        {uploading === 'datasheet_pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {form.datasheet_pdf ? '更换 PDF' : '上传 PDF'}
                      </button>
                      {form.datasheet_pdf && (
                        <a href={form.datasheet_pdf} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">查看</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50">
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
                <h3 className="text-lg font-bold text-gray-900">批量导入商品</h3>
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
                    <p className="text-sm text-gray-500">上传 Excel 数据表和 ZIP 图片包（可选），图片列支持填写文件名或嵌入图片。</p>
                    <button onClick={generateExcelTemplate} className="flex items-center gap-1.5 text-sm text-cyan-600 hover:text-cyan-700">
                      <Download className="w-4 h-4" /> 下载模板
                    </button>
                  </div>

                  {/* Excel Upload */}
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
                    <p className="text-sm font-medium text-gray-700">
                      {excelFile ? excelFile.name : '点击或拖拽上传 Excel 文件'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">支持 .xlsx, .xls 格式</p>
                  </div>

                  {/* ZIP Upload */}
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
                    <p className="text-sm font-medium text-gray-700">
                      {zipFile ? zipFile.name : '点击或拖拽上传 ZIP 图片包（可选）'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">将图片文件名填入 Excel 对应列即可自动匹配</p>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      共解析 <span className="font-medium text-gray-900">{parsedRows.length}</span> 条商品数据
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> 校验通过</span>
                      <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> 尺寸不符</span>
                      <span className="flex items-center gap-1 text-gray-400"><ImageIcon className="w-3.5 h-3.5" /> 无图片</span>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">名称</th>
                          <th className="px-3 py-2 text-left font-medium">靶标</th>
                          <th className="px-3 py-2 text-left font-medium">价格</th>
                          <th className="px-3 py-2 text-left font-medium">库存/状态</th>
                          <th className="px-3 py-2 text-left font-medium">图片匹配</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRows.map((row, idx) => {
                          const rowKey = `row-${idx + 1}`
                          const imageFields = IMAGE_FIELDS.map((f) => {
                            const img = row.images[f.key]
                            const v = imageValidations[rowKey]?.[f.key]
                            if (!img?.blob) return { key: f.key, status: 'none' as const }
                            if (v?.valid) return { key: f.key, status: 'ok' as const, dims: `${v.width}x${v.height}` }
                            return { key: f.key, status: 'warn' as const, error: v?.error }
                          })
                          const okCount = imageFields.filter((i) => i.status === 'ok').length
                          const warnCount = imageFields.filter((i) => i.status === 'warn').length
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-gray-900">{row.name}</div>
                                <div className="text-xs text-gray-400">{row.detection_range || '-'}</div>
                              </td>
                              <td className="px-3 py-2.5 text-gray-600">{row.target}</td>
                              <td className="px-3 py-2.5 text-gray-600">{row.price ? `¥${row.price}` : '-'}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  {getStockBadge(row.stock_status)}
                                  {getStatusBadge(row.status)}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {imageFields.map((img) => (
                                    <span key={img.key} title={img.error || img.dims || '无图片'} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      img.status === 'ok' ? 'bg-emerald-50 text-emerald-700' :
                                      img.status === 'warn' ? 'bg-amber-50 text-amber-700' :
                                      'bg-gray-50 text-gray-400'
                                    }`}>
                                      {img.status === 'ok' ? <CheckCircle className="w-3 h-3" /> :
                                       img.status === 'warn' ? <AlertTriangle className="w-3 h-3" /> :
                                       <ImageIcon className="w-3 h-3" />}
                                      {IMAGE_REQUIREMENTS[img.key].label}
                                    </span>
                                  ))}
                                </div>
                                {warnCount > 0 && (
                                  <p className="text-[10px] text-amber-600 mt-1">
                                    {warnCount} 张图片尺寸不符，导入时将跳过
                                  </p>
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
                          <div className="text-xs text-gray-500 mt-1">图片跳过</div>
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
