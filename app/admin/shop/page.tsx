'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import { Alert, App, Button, Input, InputNumber, Modal, Popconfirm, Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, GiftOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'
import { SHOP_REDEMPTION_NOTICE } from '@/lib/shop/constants'
import { SHOP_CATEGORIES, getShopCategoryLabel, type ShopCategory } from '@/lib/shop/categories'

interface ShopItem {
  id: string
  name: string
  description: string | null
  points_required: number
  stock: number
  image_url: string | null
  status: string
  category: ShopCategory | null
  created_at: string
}

interface ShopItemsResponse {
  items?: ShopItem[]
  error?: string
}

interface ApiErrorResponse {
  error?: string
  url?: string
}

export default function AdminShopPage() {
  const { message } = App.useApp()
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null)
  const [form, setForm] = useState({ name: '', description: '', points_required: '', stock: '', image_url: '', status: 'active', category: '' as ShopCategory | '' })
  const [saving, setSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadNote, setImageUploadNote] = useState('')
  const [formError, setFormError] = useState('')
  const [loadError, setLoadError] = useState('')
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const fetchItems = useCallback(() => {
    setLoading(true)
    setLoadError('')
    fetch('/api/admin/shop')
      .then((r) => r.json())
      .then((d: ShopItemsResponse) => {
        if (d.error) {
          setItems([])
          setLoadError(d.error)
        } else {
          setItems(d.items || [])
        }
      })
      .catch((err: unknown) => {
        setItems([])
        setLoadError(err instanceof Error ? err.message : '积分商城奖品加载失败')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次后台数据请求。
    fetchItems()
  }, [fetchItems])

  const openCreate = () => {
    setEditingItem(null)
    setForm({ name: '', description: '', points_required: '', stock: '', image_url: '', status: 'active', category: '' })
    setFormError('')
    setImageUploadNote('')
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
      category: item.category || '',
    })
    setFormError('')
    setImageUploadNote('')
    setShowForm(true)
  }

  const handleImageUpload = async (file: File) => {
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
      message.error('仅支持 JPG、JPEG、PNG、GIF、WebP 格式的图片')
      return
    }

    // Validate file size (max 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      message.error('图片大小不能超过 5MB')
      return
    }

    setImageUploading(true)
    setImageUploadNote('')
    try {
      const { compressImage, formatFileSize } = await import('@/lib/image-compress')
      const compressed = await compressImage(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.8,
        maxSizeMB: 0.45,
        outputType: 'image/webp',
      })
      const timestamp = Date.now()
      const itemId = editingItem?.id || 'new'
      const path = `shop/${itemId}/${timestamp}.webp`
      const optimizedName = `${file.name.replace(/\.[^.]+$/, '') || 'shop-item'}.webp`

      const body = new FormData()
      body.append('file', compressed, optimizedName)
      body.append('bucket', 'product-assets')
      body.append('path', path)

      const oldUrl = editingItem?.image_url
      if (oldUrl) body.append('old_url', oldUrl)

      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      if (!res.ok) {
        message.error('图片上传失败: ' + (data.error || '未知错误'))
      } else if (data.url) {
        const imageUrl = data.url
        setForm((prev) => ({ ...prev, image_url: imageUrl }))
        setImageUploadNote(`已自动优化：${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}（WebP）`)
      }
    } catch (err: unknown) {
      console.error('Image upload exception:', err)
      message.error('图片上传失败: ' + (err instanceof Error ? err.message : '网络或服务器错误'))
    } finally {
      setImageUploading(false)
    }
  }

  const handleSave = async () => {
    setFormError('')
    const pointsRequired = Number(form.points_required)
    const stockCount = Number(form.stock)
    if (!Number.isFinite(pointsRequired) || pointsRequired <= 0) {
      setFormError('所需积分必须大于 0')
      return
    }
    if (!Number.isFinite(stockCount) || stockCount < 0) {
      setFormError('库存不能小于 0')
      return
    }
    if (!form.category) {
      setFormError('请选择商品分类')
      return
    }
    setSaving(true)
    const body = {
      ...form,
      points_required: pointsRequired,
      stock: stockCount,
    }
    try {
      const res = await fetch('/api/admin/shop', {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem ? { id: editingItem.id, ...body } : body),
      })
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      if (res.ok) {
        setShowForm(false)
        fetchItems()
      } else {
        setFormError(data.error || '保存失败')
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : '网络或服务器错误')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoadError('')
    try {
      const res = await fetch(`/api/admin/shop?id=${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      if (res.ok) {
        fetchItems()
      } else {
        setLoadError(data.error || '删除失败')
        message.error(data.error || '删除失败')
      }
    } catch (err: unknown) {
      const failMessage = err instanceof Error ? err.message : '删除失败'
      setLoadError(failMessage)
      message.error(failMessage)
    }
  }

  const columns: ColumnsType<ShopItem> = [
    {
      title: '名称',
      key: 'name',
      render: (_, item) => (
        <div className="flex min-w-0 items-center gap-2">
          {item.image_url && (
            <img src={item.image_url} alt="" className="h-8 w-8 rounded border border-gray-200 bg-gray-50 object-contain" />
          )}
          <span className="truncate text-sm font-medium text-slate-900">{item.name}</span>
        </div>
      ),
    },
    {
      title: '分类',
      key: 'category',
      width: 130,
      render: (_, item) => <Tag color={item.category ? 'blue' : 'gold'}>{getShopCategoryLabel(item.category)}</Tag>,
    },
    {
      title: '积分',
      dataIndex: 'points_required',
      key: 'points_required',
      width: 90,
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 80,
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_, item) => (item.status === 'active' ? <Tag color="green">上架</Tag> : <Tag>下架</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_, item) => (
        <>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(item)} />
          <Popconfirm title="确定删除这个奖品吗？" okText="删除" cancelText="取消" onConfirm={() => handleDelete(item.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<GiftOutlined />}
        title="积分商城管理"
        description="管理积分兑换奖品的上架、库存与积分定价"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增奖品
          </Button>
        }
      />

      {loadError && <Alert className="mb-4" type="error" showIcon message={loadError} />}

      <Modal
        open={showForm}
        title={editingItem ? '编辑奖品' : '新增奖品'}
        width={640}
        onCancel={() => setShowForm(false)}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setShowForm(false)}>取消</Button>,
          <Button key="save" type="primary" loading={saving} onClick={() => handleSave()}>保存</Button>,
        ]}
      >
          <form
            onSubmit={(e) => { e.preventDefault(); void handleSave() }}
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">名称</span>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">所需积分</span>
                <InputNumber
                  className="w-full"
                  value={form.points_required}
                  onChange={(value) => setForm({ ...form, points_required: value === null ? '' : String(value) })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">库存</span>
                <InputNumber
                  className="w-full"
                  value={form.stock}
                  onChange={(value) => setForm({ ...form, stock: value === null ? '' : String(value) })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">状态</span>
                <Select
                  className="w-full"
                  value={form.status}
                  onChange={(value: string) => setForm({ ...form, status: value })}
                  options={[
                    { value: 'active', label: '上架' },
                    { value: 'inactive', label: '下架' },
                  ]}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">商品分类 *</span>
                <Select
                  className="w-full"
                  value={form.category}
                  onChange={(value: ShopCategory | '') => setForm({ ...form, category: value })}
                  options={[{ value: '', label: '请选择分类' }, ...SHOP_CATEGORIES.map((category) => ({ value: category.code, label: category.label }))]}
                />
              </label>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs text-slate-500">奖品图片</span>
                <div className="flex items-center gap-4">
                  {form.image_url && (
                    <img src={form.image_url} alt="预览" className="h-16 w-16 rounded-lg border border-gray-200 bg-gray-50 object-contain" />
                  )}
                  <div className="flex-1">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
                    />
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() => imageInputRef.current?.click()}
                      loading={imageUploading}
                    >
                      {imageUploading ? '上传中...' : form.image_url ? '更换图片' : '上传图片'}
                    </Button>
                    {form.image_url && (
                      <p className="mt-1 max-w-xs truncate text-xs text-slate-400">{form.image_url}</p>
                    )}
                    {imageUploadNote && (
                      <p className="mt-1 text-xs font-medium text-emerald-600">{imageUploadNote}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs text-slate-500">描述</span>
                <Input.TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                <p className="mt-1 text-xs text-slate-400">兑换须知由系统统一展示，不需要粘贴到商品描述中：{SHOP_REDEMPTION_NOTICE}</p>
              </div>
            </div>
            {formError && <Alert className="mt-4" type="error" showIcon message={formError} />}
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>
      </Modal>

      <Table<ShopItem>
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={false}
        locale={{ emptyText: '暂无奖品数据' }}
      />
    </div>
  )
}
