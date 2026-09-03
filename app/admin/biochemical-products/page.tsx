'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Beaker, Check, Edit3, FileUp, Loader2, Plus, Search, X } from 'lucide-react'
import { buildProductDocumentDownloadUrl } from '@/lib/products/document-download'

type ProductStatus = 'active' | 'draft' | 'archived'

type BiochemicalProduct = {
  id: string
  catalog_number: string
  indicator_name: string
  specifications: string[]
  wavelength: string
  price_48t: number | string | null
  price_96t: number | string
  status: ProductStatus
  sort_order: number
}

type ProductForm = {
  catalog_number: string
  indicator_name: string
  has_48t: boolean
  wavelength: string
  price_48t: string
  price_96t: string
  status: ProductStatus
  sort_order: string
}

type BiochemicalDocument = {
  id: string
  file_url: string
  file_name: string
  created_at: string
}

const EMPTY_FORM: ProductForm = {
  catalog_number: '',
  indicator_name: '',
  has_48t: false,
  wavelength: '',
  price_48t: '',
  price_96t: '',
  status: 'draft',
  sort_order: '0',
}

function statusLabel(status: ProductStatus) {
  return status === 'active' ? '前台已发布' : status === 'draft' ? '草稿' : '已归档'
}

function statusClass(status: ProductStatus) {
  return status === 'active'
    ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20'
    : status === 'draft'
      ? 'bg-amber-400/10 text-amber-300 border-amber-400/20'
      : 'bg-slate-700 text-slate-400 border-slate-600'
}

function errorMessage(value: unknown, fallback: string) {
  return value instanceof Error ? value.message || fallback : fallback
}

export default function AdminBiochemicalProductsPage() {
  const [products, setProducts] = useState<BiochemicalProduct[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [editing, setEditing] = useState<BiochemicalProduct | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [document, setDocument] = useState<BiochemicalDocument | null>(null)
  const [documentLoading, setDocumentLoading] = useState(false)
  const [documentSaving, setDocumentSaving] = useState(false)
  const [documentDragActive, setDocumentDragActive] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      const response = await fetch(`/api/admin/biochemical-products?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '读取产品失败')
      setProducts(data.products || [])
      setNeedsMigration(Boolean(data.needsMigration))
    } catch (loadError) {
      setError(errorMessage(loadError, '读取生化产品失败'))
      setProducts([])
      setNeedsMigration(false)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProducts(), 0)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  const counts = useMemo(() => ({
    all: products.length,
    active: products.filter((product) => product.status === 'active').length,
    draft: products.filter((product) => product.status === 'draft').length,
    archived: products.filter((product) => product.status === 'archived').length,
  }), [products])

  function beginCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDocument(null)
    setDocumentDragActive(false)
    setError('')
  }

  function beginEdit(product: BiochemicalProduct) {
    setEditing(product)
    setForm({
      catalog_number: product.catalog_number,
      indicator_name: product.indicator_name,
      has_48t: product.specifications.includes('48T'),
      wavelength: product.wavelength,
      price_48t: product.price_48t === null ? '' : String(product.price_48t),
      price_96t: String(product.price_96t),
      status: product.status,
      sort_order: String(product.sort_order || 0),
    })
    setDocument(null)
    setDocumentDragActive(false)
    setDocumentLoading(true)
    void fetch(`/api/admin/biochemical-products/${encodeURIComponent(product.id)}/document`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '读取说明书失败')
        setDocument(data.document || null)
      })
      .catch((loadError: unknown) => setError(errorMessage(loadError, '读取说明书失败')))
      .finally(() => setDocumentLoading(false))
    setError('')
  }

  function setField<K extends keyof ProductForm>(field: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault()
    if (!form.catalog_number.trim() || !form.indicator_name.trim() || !form.wavelength.trim() || !form.price_96t || (form.has_48t && !form.price_48t)) {
      setError('请填写货号、指标名称、操作波长和96T价格；如果选择48T，还需要填写48T价格。')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin/biochemical-products', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          catalog_number: form.catalog_number,
          indicator_name: form.indicator_name,
          specifications: form.has_48t ? ['48T', '96T'] : ['96T'],
          wavelength: form.wavelength,
          price_48t: form.has_48t ? Number(form.price_48t) : null,
          price_96t: Number(form.price_96t),
          status: form.status,
          sort_order: Number(form.sort_order) || 0,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存失败')
      setForm(EMPTY_FORM)
      setEditing(null)
      await loadProducts()
    } catch (saveError) {
      setError(errorMessage(saveError, '保存生化产品失败'))
    } finally {
      setSaving(false)
    }
  }

  async function archiveProduct(product: BiochemicalProduct) {
    if (!window.confirm(`确认归档“${product.indicator_name} / ${product.catalog_number}”吗？归档后前台不再显示。`)) return
    setError('')
    try {
      const response = await fetch(`/api/admin/biochemical-products?id=${encodeURIComponent(product.id)}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '归档失败')
      if (editing?.id === product.id) {
        setEditing(null)
        setForm(EMPTY_FORM)
      }
      await loadProducts()
    } catch (archiveError) {
      setError(errorMessage(archiveError, '归档生化产品失败'))
    }
  }

  async function uploadDocument(file: File) {
    if (!editing) return
    setDocumentSaving(true)
    setError('')
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch(`/api/admin/biochemical-products/${encodeURIComponent(editing.id)}/document`, { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '说明书上传失败')
      setDocument(data.document)
    } catch (uploadError) {
      setError(errorMessage(uploadError, '说明书上传失败'))
    } finally {
      setDocumentSaving(false)
    }
  }

  function handleDocumentDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDocumentDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void uploadDocument(file)
  }

  async function deleteDocument() {
    if (!editing || !document || !window.confirm('确认删除当前生化产品的操作说明书吗？删除后客户将无法查看和下载。')) return
    setDocumentSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/biochemical-products/${encodeURIComponent(editing.id)}/document`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '删除说明书失败')
      setDocument(null)
    } catch (deleteError) {
      setError(errorMessage(deleteError, '删除说明书失败'))
    } finally {
      setDocumentSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-950 px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-300">
              <Beaker className="h-5 w-5" />
              <span className="text-sm font-semibold">独立产品目录</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white">生化法试剂盒</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">仅维护货号、指标名称、检测波长、96T规格和单盒价格。此处与 ELISA 商品管理完全分开。</p>
          </div>
          <button type="button" onClick={beginCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
            <Plus className="h-4 w-4" /> 新增生化产品
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ['全部目录', counts.all, 'text-white'],
            ['前台已发布', counts.active, 'text-emerald-300'],
            ['草稿', counts.draft, 'text-amber-300'],
            ['已归档', counts.archived, 'text-slate-400'],
          ].map(([label, count, color]) => (
            <div key={String(label)} className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`mt-1 text-xl font-bold ${color}`}>{count}</p>
            </div>
          ))}
        </div>

        {error && <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

        {needsMigration && (
          <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
            当前数据库还是旧版生化产品结构。旧记录可以查看，但双规格和对应价格暂时不能保存；请先在 Supabase SQL Editor 执行 <code className="rounded bg-black/20 px-1.5 py-0.5 text-xs">supabase/migrations/070_biochemical_product_specifications.sql</code>。
          </div>
        )}

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-lg border border-slate-800 bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索货号、指标或波长" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-400" />
              </div>
              <span className="text-xs text-slate-500">共 {products.length} 条</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> 正在读取目录</div>
            ) : products.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">{search ? '没有找到匹配产品' : '还没有生化法试剂盒，点击右上角开始新增'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-950/70 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">指标名称</th>
                      <th className="px-4 py-3 font-medium">货号</th>
                      <th className="px-4 py-3 font-medium">规格</th>
                      <th className="px-4 py-3 font-medium">波长</th>
                      <th className="px-4 py-3 font-medium">96T价格</th>
                      <th className="px-4 py-3 font-medium">状态</th>
                      <th className="px-4 py-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-white">{product.indicator_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-300">{product.catalog_number}</td>
                        <td className="px-4 py-3 text-slate-300">{product.specifications?.join(' / ') || '96T'}</td>
                        <td className="px-4 py-3 text-slate-300">{product.wavelength}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-300">{product.price_48t !== null && product.price_48t !== undefined ? `48T ¥${Number(product.price_48t).toLocaleString('zh-CN')} / ` : ''}96T ¥{Number(product.price_96t).toLocaleString('zh-CN')}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded border px-2 py-1 text-xs ${statusClass(product.status)}`}>{statusLabel(product.status)}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => beginEdit(product)} title="编辑" className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-300"><Edit3 className="h-4 w-4" /></button>
                            {product.status !== 'archived' && <button type="button" onClick={() => void archiveProduct(product)} title="归档" className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-300"><Archive className="h-4 w-4" /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">{editing ? '编辑生化产品' : '新增生化产品'}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">保存后根据状态决定是否展示到前台。</p>
              </div>
              {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setDocument(null) }} title="取消编辑" className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>}
            </div>

            <form onSubmit={saveProduct} className="mt-5 space-y-4">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-400">货号 *</span><input value={form.catalog_number} onChange={(event) => setField('catalog_number', event.target.value)} placeholder="例如 LV90001" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-400">指标名称 *</span><input value={form.indicator_name} onChange={(event) => setField('indicator_name', event.target.value)} placeholder="例如 SOD、MDA、ALT" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-400">规格 *</span><div className="grid grid-cols-2 gap-2"><label className="flex h-10 items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm font-semibold text-cyan-200"><input type="checkbox" checked readOnly className="accent-cyan-400" />96T</label><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300"><input type="checkbox" checked={form.has_48t} onChange={(event) => setField('has_48t', event.target.checked)} className="accent-cyan-400" />48T</label></div></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-400">操作波长 *</span><input value={form.wavelength} onChange={(event) => setField('wavelength', event.target.value)} placeholder="例如 450 nm、570 nm" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400" /></label>
              <div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-400">96T价格 *</span><input type="number" min="0" step="0.01" value={form.price_96t} onChange={(event) => setField('price_96t', event.target.value)} placeholder="手动输入" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400" /></label>{form.has_48t && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-400">48T价格 *</span><input type="number" min="0" step="0.01" value={form.price_48t} onChange={(event) => setField('price_48t', event.target.value)} placeholder="手动输入" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400" /></label>}</div>
              <div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-400">前台状态</span><select value={form.status} onChange={(event) => setField('status', event.target.value as ProductStatus)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-cyan-400"><option value="draft">草稿</option><option value="active">发布</option><option value="archived">归档</option></select></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-400">排列序号</span><input type="number" value={form.sort_order} onChange={(event) => setField('sort_order', event.target.value)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-cyan-400" /></label></div>
              <button type="submit" disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{saving ? '保存中...' : editing ? '保存修改' : '保存产品'}</button>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-5">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-white">操作说明书 PDF</h3><p className="mt-1 text-xs leading-5 text-slate-500">必须先保存产品资料，再返回点击编辑上传。单个文件不超过 20MB。</p></div></div>
              {!editing ? <div className="mt-4 rounded-lg border border-dashed border-slate-700 px-3 py-5 text-center text-xs text-slate-500"><FileUp className="mx-auto mb-2 h-5 w-5 text-slate-600" />保存产品后，点击列表中的编辑按钮即可上传说明书。</div> : documentLoading ? <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />正在读取说明书状态</p> : <>
                <label onDragOver={(event) => { event.preventDefault(); setDocumentDragActive(true) }} onDragLeave={() => setDocumentDragActive(false)} onDrop={handleDocumentDrop} className={`mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-5 text-center transition-colors ${documentDragActive ? 'border-cyan-300 bg-cyan-400/10' : 'border-slate-700 bg-slate-950/40 hover:border-cyan-400/60 hover:bg-cyan-400/5'} ${documentSaving ? 'pointer-events-none opacity-50' : ''}`}>
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={documentSaving} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadDocument(file) }} />
                  {documentSaving ? <Loader2 className="h-6 w-6 animate-spin text-cyan-300" /> : <FileUp className="h-6 w-6 text-cyan-300" />}
                  <span className="mt-2 text-xs font-semibold text-slate-300">点击选择 PDF，或将 PDF 拖到这里</span>
                  <span className="mt-1 text-[11px] text-slate-500">上传后会自动替换当前有效说明书</span>
                </label>
                {document ? <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3"><p className="truncate text-xs font-semibold text-emerald-200" title={document.file_name}>{document.file_name}</p><div className="mt-3 flex items-center gap-3"><a href={document.file_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">在线预览</a><a href={buildProductDocumentDownloadUrl(document.file_url, document.file_name)} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">下载</a><button type="button" onClick={() => void deleteDocument()} disabled={documentSaving} className="ml-auto text-xs font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-50">删除</button></div></div> : <p className="mt-3 text-xs text-amber-300">尚未上传说明书，前台详情页会显示“说明书暂未上传”。</p>}
              </>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
