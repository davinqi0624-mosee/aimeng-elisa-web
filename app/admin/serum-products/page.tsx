'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Beaker, Edit3, Image as ImageIcon, Plus, Save, Trash2, Upload, X } from 'lucide-react'

type SerumCategory = 'fbs' | 'animal-serum'

interface SerumProductRow {
  id: string
  slug: string
  category: SerumCategory
  name: string
  english_name: string
  catalog_number: string
  origin: string
  serum_type: string
  package_size: string
  image_url: string
  summary: string
  description: string[]
  applications: string[]
  quality_items: { label: string; value: string }[]
  cell_applications: string[]
  comparison_points: { label: string; aimeng: string; common: string }[]
  status: string
  sort_order: number
}

interface SerumProductsResponse {
  products?: SerumProductRow[]
  error?: string
}

interface ApiErrorResponse {
  error?: string
  url?: string
}

const emptyProduct: SerumProductRow = {
  id: '',
  slug: '',
  category: 'fbs',
  name: '',
  english_name: '',
  catalog_number: '',
  origin: '',
  serum_type: '',
  package_size: '500ml',
  image_url: '',
  summary: '',
  description: [],
  applications: [],
  quality_items: [],
  cell_applications: [],
  comparison_points: [],
  status: 'active',
  sort_order: 0,
}

function linesToArray(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function arrayToLines(value?: string[]) {
  return (value || []).join('\n')
}

function qualityToText(value?: { label: string; value: string }[]) {
  return (value || []).map((item) => `${item.label}：${item.value}`).join('\n')
}

function textToQuality(value: string) {
  return value
    .split('\n')
    .map((line) => {
      const [label, ...rest] = line.split(/[:：]/)
      return { label: (label || '').trim(), value: rest.join('：').trim() }
    })
    .filter((item) => item.label || item.value)
}

function comparisonToText(value?: { label: string; aimeng: string; common: string }[]) {
  return (value || []).map((item) => `${item.label}|${item.aimeng}|${item.common}`).join('\n')
}

function textToComparison(value: string) {
  return value
    .split('\n')
    .map((line) => {
      const [label, aimeng, common] = line.split('|')
      return {
        label: (label || '').trim(),
        aimeng: (aimeng || '').trim(),
        common: (common || '').trim(),
      }
    })
    .filter((item) => item.label || item.aimeng || item.common)
}

export default function AdminSerumProductsPage() {
  const [products, setProducts] = useState<SerumProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SerumProductRow | null>(null)
  const [setupError, setSetupError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const [descriptionText, setDescriptionText] = useState('')
  const [applicationsText, setApplicationsText] = useState('')
  const [qualityText, setQualityText] = useState('')
  const [cellText, setCellText] = useState('')
  const [comparisonText, setComparisonText] = useState('')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setSetupError('')
    try {
      const res = await fetch('/api/admin/serum-products')
      const data = await res.json().catch(() => ({})) as SerumProductsResponse
      if (!res.ok) {
        setSetupError(data.error || '血清产品表未初始化')
        setProducts([])
      } else {
        setProducts(data.products || [])
      }
    } catch (err: unknown) {
      setSetupError(err instanceof Error ? err.message : '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次后台数据请求。
    fetchProducts()
  }, [fetchProducts])

  function openEditor(product?: SerumProductRow) {
    const next = product || emptyProduct
    setEditing({ ...next })
    setSaveError('')
    setUploadError('')
    setDescriptionText(arrayToLines(next.description))
    setApplicationsText(arrayToLines(next.applications))
    setQualityText(qualityToText(next.quality_items))
    setCellText(arrayToLines(next.cell_applications))
    setComparisonText(comparisonToText(next.comparison_points))
  }

  async function uploadImage(file: File) {
    if (!editing) return
    setUploadError('')
    setUploading(true)
    try {
      if (!file.type.startsWith('image/')) {
        setUploadError('请选择图片文件，支持 JPG、PNG、WebP。')
        return
      }
      const ext = file.name.split('.').pop() || 'jpg'
      const body = new FormData()
      body.append('file', file)
      body.append('bucket', 'product-assets')
      body.append('path', `serum-products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`)
      if (editing.image_url) body.append('old_url', editing.image_url)

      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      if (!res.ok) {
        setUploadError(data.error || '图片上传失败')
        return
      }
      if (data.url) setEditing({ ...editing, image_url: data.url })
      if (imageInputRef.current) imageInputRef.current.value = ''
    } catch (error: unknown) {
      setUploadError(error instanceof Error ? error.message : '图片上传失败，请稍后重试')
    } finally {
      setUploading(false)
    }
  }

  async function saveProduct() {
    if (!editing) return
    setSaveError('')
    if (!editing.name.trim()) {
      setSaveError('请填写产品名称')
      return
    }
    if (!editing.catalog_number.trim()) {
      setSaveError('请填写货号，客户后续会按货号查询 COA 和产品资料')
      return
    }
    setSaving(true)
    const payload = {
      ...editing,
      description: linesToArray(descriptionText),
      applications: linesToArray(applicationsText),
      quality_items: textToQuality(qualityText),
      cell_applications: linesToArray(cellText),
      comparison_points: textToComparison(comparisonText),
    }
    const isNew = !editing.id
    try {
      const res = await fetch('/api/admin/serum-products', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      if (!res.ok) {
        setSaveError(data.error || '保存失败')
        return
      }
      setEditing(null)
      fetchProducts()
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('确定删除这个血清产品？')) return
    const res = await fetch(`/api/admin/serum-products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      alert(data.error || '删除失败')
      return
    }
    fetchProducts()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
              <Beaker className="h-6 w-6 text-emerald-400" />
              血清产品管理
            </h1>
            <p className="mt-1 text-sm text-slate-400">维护胎牛血清和动物血制品橱窗、产品详情、检测参数和应用场景。</p>
          </div>
          <button
            onClick={() => openEditor()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            新增血清产品
          </button>
        </div>

        {setupError && (
          <div className="mb-5 rounded-lg border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-200">
            <p className="font-semibold">数据库还没有初始化血清产品表</p>
            <p className="mt-1 text-amber-100/80">请执行 `supabase/migrations/027_serum_products.sql`。执行后刷新本页即可上传血清产品。</p>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">产品</th>
                <th className="px-4 py-3 text-left">分类</th>
                <th className="px-4 py-3 text-left">货号/规格</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">加载中...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">暂无后台血清产品，前台会继续显示默认示例数据。</td></tr>
              ) : products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{product.name}</div>
                    <div className="text-xs text-slate-500">{product.english_name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{product.category === 'fbs' ? '胎牛血清' : '动物血制品'}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-blue-300">{product.catalog_number || '-'}</div>
                    <div className="text-xs text-slate-500">{product.package_size || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">{product.status === 'active' ? '上架' : product.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEditor(product)} className="mr-2 rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-blue-300">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteProduct(product.id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-red-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-hidden bg-black/60 p-2 sm:p-6">
          <div className="flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl sm:h-[calc(100dvh-3rem)]">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-lg font-bold text-white">{editing.id ? '编辑血清产品' : '新增血清产品'}</h2>
              <button onClick={() => setEditing(null)} className="rounded p-1.5 text-slate-400 hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 pb-10 [-webkit-overflow-scrolling:touch]">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1.5 text-sm">
                  分类
                  <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as SerumCategory })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
                    <option value="fbs">胎牛血清</option>
                    <option value="animal-serum">动物血制品</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm">
                  产品名称
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  英文名称
                  <input value={editing.english_name || ''} onChange={(e) => setEditing({ ...editing, english_name: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  货号
                  <input value={editing.catalog_number || ''} onChange={(e) => setEditing({ ...editing, catalog_number: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  血源地
                  <input value={editing.origin || ''} onChange={(e) => setEditing({ ...editing, origin: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  血清类型
                  <input value={editing.serum_type || ''} onChange={(e) => setEditing({ ...editing, serum_type: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  包装规格
                  <input value={editing.package_size || ''} onChange={(e) => setEditing({ ...editing, package_size: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  排序
                  <input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  状态
                  <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
                    <option value="active">上架</option>
                    <option value="draft">草稿</option>
                    <option value="archived">归档</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white"><ImageIcon className="h-4 w-4" /> 产品图片</p>
                  {editing.image_url ? (
                    <img src={editing.image_url} alt={editing.name} className="mb-3 h-32 w-full rounded-lg bg-white object-contain" />
                  ) : (
                    <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-900 text-xs text-slate-500">暂无图片</div>
                  )}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? '上传中...' : '上传图片'}
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                  />
                  <label className="mt-3 grid gap-1.5 text-xs text-slate-400">
                    图片 URL（没有 service role 时可先粘贴图片链接）
                    <input
                      value={editing.image_url || ''}
                      onChange={(e) => {
                        setUploadError('')
                        setEditing({ ...editing, image_url: e.target.value })
                      }}
                      placeholder="https://..."
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                    />
                  </label>
                  {uploadError && (
                    <p className="mt-2 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs leading-5 text-red-200">
                      {uploadError}
                    </p>
                  )}
                </div>
                <label className="grid gap-1.5 text-sm">
                  产品摘要
                  <textarea value={editing.summary || ''} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} className="min-h-40 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  产品介绍（一行一段）
                  <textarea value={descriptionText} onChange={(e) => setDescriptionText(e.target.value)} className="min-h-36 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  应用分类（一行一个）
                  <textarea value={applicationsText} onChange={(e) => setApplicationsText(e.target.value)} className="min-h-36 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  检测项目及参数（一行一个：项目：参数）
                  <textarea value={qualityText} onChange={(e) => setQualityText(e.target.value)} className="min-h-36 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  适用细胞/应用范围（一行一个）
                  <textarea value={cellText} onChange={(e) => setCellText(e.target.value)} className="min-h-36 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                </label>
              </div>

              <label className="grid gap-1.5 text-sm">
                对比点（可选，一行一个：项目|爱萌优宁|常规方式）
                <textarea value={comparisonText} onChange={(e) => setComparisonText(e.target.value)} className="min-h-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
              </label>
            </div>

            <div className="shrink-0 border-t border-slate-700 bg-slate-900 px-6 py-4">
              {saveError && (
                <p className="mb-3 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm leading-6 text-red-200">
                  {saveError}
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">取消</button>
                <button onClick={saveProduct} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
