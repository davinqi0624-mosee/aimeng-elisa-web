'use client'

import { useState, useEffect } from 'react'
import { Gift, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react'

interface ShopItem {
  id: string
  name: string
  description: string | null
  points_required: number
  stock: number
  image_url: string | null
  status: string
  created_at: string
}

export default function AdminShopPage() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null)
  const [form, setForm] = useState({ name: '', description: '', points_required: '', stock: '', image_url: '', status: 'active' })
  const [saving, setSaving] = useState(false)

  const fetchItems = () => {
    setLoading(true)
    fetch('/api/admin/shop')
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const openCreate = () => {
    setEditingItem(null)
    setForm({ name: '', description: '', points_required: '', stock: '', image_url: '', status: 'active' })
    setShowForm(true)
  }

  const openEdit = (item: ShopItem) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      description: item.description || '',
      points_required: String(item.points_required),
      stock: String(item.stock),
      image_url: item.image_url || '',
      status: item.status,
    })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const body = {
      ...form,
      points_required: parseInt(form.points_required),
      stock: parseInt(form.stock),
    }
    try {
      const res = await fetch('/api/admin/shop', {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem ? { id: editingItem.id, ...body } : body),
      })
      if (res.ok) {
        setShowForm(false)
        fetchItems()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个奖品吗？')) return
    try {
      const res = await fetch(`/api/admin/shop?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchItems()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-600" />
            积分商城管理
          </h1>
          <p className="text-sm text-gray-500">管理积分兑换奖品的上架、库存与积分定价</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增奖品
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">{editingItem ? '编辑奖品' : '新增奖品'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">名称</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">所需积分</label>
              <input type="number" value={form.points_required} onChange={(e) => setForm({ ...form, points_required: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">库存</label>
              <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">状态</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="active">上架</option>
                <option value="inactive">下架</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">图片URL</label>
              <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">描述</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
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
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">暂无奖品数据</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
            <div className="col-span-4">名称</div>
            <div className="col-span-2">积分</div>
            <div className="col-span-2">库存</div>
            <div className="col-span-2">状态</div>
            <div className="col-span-2 text-right">操作</div>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-4 text-sm font-medium text-gray-900 truncate">{item.name}</div>
                <div className="col-span-2 text-sm text-gray-600">{item.points_required}</div>
                <div className="col-span-2 text-sm text-gray-600">{item.stock}</div>
                <div className="col-span-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'}`}>
                    {item.status === 'active' ? '上架' : '下架'}
                  </span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
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
