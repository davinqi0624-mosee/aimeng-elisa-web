'use client'

import { useState, useEffect } from 'react'
import { Package, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react'

interface Product {
  id: string
  name: string
  target: string
  detection_range: string | null
  sensitivity: string | null
  price: number | null
  status: string
  stock_status: string
  created_at: string
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', target: '', detection_range: '', sensitivity: '', price: '', status: 'active', stock_status: 'in_stock' })
  const [saving, setSaving] = useState(false)

  const fetchProducts = () => {
    setLoading(true)
    fetch('/api/admin/products')
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const openCreate = () => {
    setEditingProduct(null)
    setForm({ name: '', target: '', detection_range: '', sensitivity: '', price: '', status: 'active', stock_status: 'in_stock' })
    setShowForm(true)
  }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setForm({
      name: p.name,
      target: p.target,
      detection_range: p.detection_range || '',
      sensitivity: p.sensitivity || '',
      price: p.price ? String(p.price) : '',
      status: p.status,
      stock_status: p.stock_status,
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
      if (res.ok) {
        setShowForm(false)
        fetchProducts()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个商品吗？')) return
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchProducts()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            商品管理
          </h1>
          <p className="text-sm text-gray-500">上架、编辑、下架 ELISA 试剂盒商品</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增商品
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">{editingProduct ? '编辑商品' : '新增商品'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">商品名称</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">靶标</label>
              <input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">检测范围</label>
              <input value={form.detection_range} onChange={(e) => setForm({ ...form, detection_range: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">灵敏度</label>
              <input value={form.sensitivity} onChange={(e) => setForm({ ...form, sensitivity: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">价格</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">库存状态</label>
              <select value={form.stock_status} onChange={(e) => setForm({ ...form, stock_status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="in_stock">有货</option>
                <option value="low_stock">库存紧张</option>
                <option value="out_of_stock">缺货</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">状态</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="active">上架</option>
                <option value="draft">草稿</option>
                <option value="archived">归档</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">取消</button>
            <button type="submit" disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">暂无商品数据</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
            <div className="col-span-4">名称 / 靶标</div>
            <div className="col-span-2">价格</div>
            <div className="col-span-2">库存</div>
            <div className="col-span-2">状态</div>
            <div className="col-span-2 text-right">操作</div>
          </div>
          <div className="divide-y divide-gray-100">
            {products.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-4">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.target}</div>
                </div>
                <div className="col-span-2 text-sm text-gray-600">{p.price ? `¥${p.price}` : '-'}</div>
                <div className="col-span-2 text-sm text-gray-600">{p.stock_status === 'in_stock' ? '有货' : p.stock_status === 'low_stock' ? '紧张' : '缺货'}</div>
                <div className="col-span-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${p.status === 'active' ? 'bg-emerald-50 text-emerald-700' : p.status === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'}`}>
                    {p.status === 'active' ? '上架' : p.status === 'draft' ? '草稿' : '归档'}
                  </span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end gap-1">
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
        </div>
      )}
    </div>
  )
}
