'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Card, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, ExperimentOutlined, PictureOutlined, PlusOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

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
  const { message } = App.useApp()
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
    const res = await fetch(`/api/admin/serum-products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      message.error(data.error || '删除失败')
      return
    }
    fetchProducts()
  }

  const columns: ColumnsType<SerumProductRow> = [
    {
      title: '产品',
      key: 'name',
      render: (_, product) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{product.name}</div>
          <div className="text-xs text-slate-500">{product.english_name}</div>
        </div>
      ),
    },
    {
      title: '分类',
      key: 'category',
      width: 110,
      render: (_, product) => (product.category === 'fbs' ? '胎牛血清' : '动物血制品'),
    },
    {
      title: '货号/规格',
      key: 'catalog',
      render: (_, product) => (
        <div>
          <div className="font-mono text-xs text-slate-700">{product.catalog_number || '-'}</div>
          <div className="text-xs text-slate-500">{product.package_size || '-'}</div>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_, product) => (product.status === 'active' ? <Tag color="green">上架</Tag> : <Tag>{product.status}</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_, product) => (
        <>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditor(product)} />
          <Popconfirm
            title="确定删除这个血清产品？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => deleteProduct(product.id)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<ExperimentOutlined />}
        title="血清产品管理"
        description="维护胎牛血清和动物血制品橱窗、产品详情、检测参数和应用场景。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
            新增血清产品
          </Button>
        }
      />

      {setupError && (
        <Alert
          className="mb-5"
          type="warning"
          showIcon
          message="数据库还没有初始化血清产品表"
          description="请执行 `supabase/migrations/027_serum_products.sql`。执行后刷新本页即可上传血清产品。"
        />
      )}

      <Table<SerumProductRow>
        rowKey="id"
        columns={columns}
        dataSource={products}
        loading={loading}
        pagination={false}
        locale={{ emptyText: '暂无后台血清产品，前台会继续显示默认示例数据。' }}
      />

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? '编辑血清产品' : '新增血清产品'}
        width={1024}
        onCancel={() => setEditing(null)}
        footer={
          <>
            {saveError && <Alert type="error" showIcon message={saveError} style={{ marginBottom: 12, textAlign: 'left' }} />}
            <Space>
              <Button onClick={() => setEditing(null)}>取消</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={saveProduct} loading={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </Space>
          </>
        }
      >
        {editing && (
          <div className="space-y-5">
            <div className="grid gap-x-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">分类</span>
                <Select
                  className="w-full"
                  value={editing.category}
                  onChange={(value: SerumCategory) => setEditing({ ...editing, category: value })}
                  options={[
                    { value: 'fbs', label: '胎牛血清' },
                    { value: 'animal-serum', label: '动物血制品' },
                  ]}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">产品名称</span>
                <Input className="w-full" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">英文名称</span>
                <Input className="w-full" value={editing.english_name || ''} onChange={(e) => setEditing({ ...editing, english_name: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">货号</span>
                <Input className="w-full" value={editing.catalog_number || ''} onChange={(e) => setEditing({ ...editing, catalog_number: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">血源地</span>
                <Input className="w-full" value={editing.origin || ''} onChange={(e) => setEditing({ ...editing, origin: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">血清类型</span>
                <Input className="w-full" value={editing.serum_type || ''} onChange={(e) => setEditing({ ...editing, serum_type: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">包装规格</span>
                <Input className="w-full" value={editing.package_size || ''} onChange={(e) => setEditing({ ...editing, package_size: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">排序</span>
                <InputNumber
                  className="w-full"
                  value={editing.sort_order || 0}
                  onChange={(value) => setEditing({ ...editing, sort_order: Number(value) || 0 })}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">状态</span>
                <Select
                  className="w-full"
                  value={editing.status}
                  onChange={(value: string) => setEditing({ ...editing, status: value })}
                  options={[
                    { value: 'active', label: '上架' },
                    { value: 'draft', label: '草稿' },
                    { value: 'archived', label: '归档' },
                  ]}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <Card size="small" title={<span className="flex items-center gap-1.5"><PictureOutlined /> 产品图片</span>}>
                {editing.image_url ? (
                  <img src={editing.image_url} alt={editing.name} className="mb-3 h-32 w-full rounded-lg bg-white object-contain" />
                ) : (
                  <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">暂无图片</div>
                )}
                <Button block icon={<UploadOutlined />} onClick={() => imageInputRef.current?.click()} loading={uploading}>
                  {uploading ? '上传中...' : '上传图片'}
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
                <p className="mt-3 text-xs text-slate-500">图片 URL（没有 service role 时可先粘贴图片链接）</p>
                <Input
                  className="mt-1"
                  value={editing.image_url || ''}
                  onChange={(e) => {
                    setUploadError('')
                    setEditing({ ...editing, image_url: e.target.value })
                  }}
                  placeholder="https://..."
                />
                {uploadError && <Alert className="mt-2" type="error" showIcon message={uploadError} />}
              </Card>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">产品摘要</span>
                <Input.TextArea
                  className="min-h-40"
                  value={editing.summary || ''}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                />
              </label>
            </div>

            <div className="grid gap-x-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">产品介绍（一行一段）</span>
                <Input.TextArea className="min-h-36" value={descriptionText} onChange={(e) => setDescriptionText(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">应用分类（一行一个）</span>
                <Input.TextArea className="min-h-36" value={applicationsText} onChange={(e) => setApplicationsText(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">检测项目及参数（一行一个：项目：参数）</span>
                <Input.TextArea className="min-h-36" value={qualityText} onChange={(e) => setQualityText(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-600">适用细胞/应用范围（一行一个）</span>
                <Input.TextArea className="min-h-36" value={cellText} onChange={(e) => setCellText(e.target.value)} />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-600">对比点（可选，一行一个：项目|爱萌优宁|常规方式）</span>
              <Input.TextArea className="min-h-28" value={comparisonText} onChange={(e) => setComparisonText(e.target.value)} />
            </label>
          </div>
        )}
      </Modal>
    </div>
  )
}
