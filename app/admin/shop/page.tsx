'use client'

import { useState, useEffect, useRef } from 'react'
import { Gift, Plus, Pencil, Trash2, Loader2, X, Upload } from 'lucide-react'

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
  const [imageUploading, setImageUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

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

  const handleImageUpload = async (file: File) => {
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif']
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
      alert('仅支持 JPG、JPEG、PNG、GIF 格式的图片')
      return
    }

    // Validate file size (max 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB')
      return
    }

    setImageUploading(true)
    try {
      const { compressImage } = await import('@/lib/image-compress')
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.85, maxSizeMB: 1 })
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const timestamp = Date.now()
      const itemId = editingItem?.id || 'new'
      const path = `shop/${itemId}/${timestamp}.${ext}`

      const body = new FormData()
      body.append('file', compressed, file.name)
      body.append('bucket', 'product-assets')
      body.append('path', path)

      const oldUrl = editingItem?.image_url
      if (oldUrl) body.append('old_url', oldUrl)

      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) {
        alert('图片上传失败: ' + (data.error || '未知错误'))
      } else {
        setForm((prev) => ({ ...prev, image_url: data.url }))
      }
    } catch (err: any) {
      console.error('Image upload exception:', err)
      alert('图片上传失败: ' + (err.message || '网络或服务器错误'))
    } finally {
      setImageUploading(false)
    }
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
              <label className="block text-xs text-gray-500 mb-1">奖品图片</label>
              <div className="flex items-center gap-4">
                {form.image_url && (
                  <img src={form.image_url} alt="预览" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                )}
                <div className="flex-1">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {imageUploading ? '上传中...' : form.image_url ? '更换图片' : '上传图片'}
                  </button>
                  {form.image_url && (
                    <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{form.image_url}</p>
                  )}
                </div>
              </div>
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
                <div className="col-span-4 flex items-center gap-2">
                  {item.image_url && (
                    <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover border border-gray-200" />
                  )}
                  <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                </div>
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
