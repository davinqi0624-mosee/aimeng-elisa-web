'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, Input, InputNumber, Modal, Popconfirm, Select, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, ExperimentOutlined, InboxOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'
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

function statusTag(status: ProductStatus) {
  if (status === 'active') return <Tag color="green">{statusLabel(status)}</Tag>
  if (status === 'draft') return <Tag color="gold">{statusLabel(status)}</Tag>
  return <Tag>{statusLabel(status)}</Tag>
}

function errorMessage(value: unknown, fallback: string) {
  return value instanceof Error ? value.message || fallback : fallback
}

export default function AdminBiochemicalProductsPage() {
  const [products, setProducts] = useState<BiochemicalProduct[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BiochemicalProduct | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [document, setDocument] = useState<BiochemicalDocument | null>(null)
  const [documentLoading, setDocumentLoading] = useState(false)
  const [documentSaving, setDocumentSaving] = useState(false)
  const [documentDragActive, setDocumentDragActive] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      const response = await fetch(`/api/admin/biochemical-products?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '读取产品失败')
      setProducts(data.products || [])
      setNeedsMigration(Boolean(data.needsMigration))
    } catch (error) {
      setLoadError(errorMessage(error, '读取生化产品失败'))
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

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setDocument(null)
    setDocumentDragActive(false)
    setFormError('')
  }

  function beginCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDocument(null)
    setDocumentDragActive(false)
    setFormError('')
    setFormOpen(true)
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
    setFormError('')
    setFormOpen(true)
    setDocumentLoading(true)
    void fetch(`/api/admin/biochemical-products/${encodeURIComponent(product.id)}/document`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '读取说明书失败')
        setDocument(data.document || null)
      })
      .catch((error: unknown) => setFormError(errorMessage(error, '读取说明书失败')))
      .finally(() => setDocumentLoading(false))
  }

  function setField<K extends keyof ProductForm>(field: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveProduct() {
    if (!form.catalog_number.trim() || !form.indicator_name.trim() || !form.wavelength.trim() || !form.price_96t || (form.has_48t && !form.price_48t)) {
      setFormError('请填写货号、指标名称、操作波长和96T价格；如果选择48T，还需要填写48T价格。')
      return
    }

    setSaving(true)
    setFormError('')
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
      closeForm()
      await loadProducts()
    } catch (error) {
      setFormError(errorMessage(error, '保存生化产品失败'))
    } finally {
      setSaving(false)
    }
  }

  async function archiveProduct(product: BiochemicalProduct) {
    setLoadError('')
    try {
      const response = await fetch(`/api/admin/biochemical-products?id=${encodeURIComponent(product.id)}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '归档失败')
      if (editing?.id === product.id) {
        closeForm()
      }
      await loadProducts()
    } catch (error) {
      setLoadError(errorMessage(error, '归档生化产品失败'))
    }
  }

  async function uploadDocument(file: File) {
    if (!editing) return
    setDocumentSaving(true)
    setFormError('')
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch(`/api/admin/biochemical-products/${encodeURIComponent(editing.id)}/document`, { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '说明书上传失败')
      setDocument(data.document)
    } catch (error) {
      setFormError(errorMessage(error, '说明书上传失败'))
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
    if (!editing || !document) return
    setDocumentSaving(true)
    setFormError('')
    try {
      const response = await fetch(`/api/admin/biochemical-products/${encodeURIComponent(editing.id)}/document`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '删除说明书失败')
      setDocument(null)
    } catch (error) {
      setFormError(errorMessage(error, '删除说明书失败'))
    } finally {
      setDocumentSaving(false)
    }
  }

  const columns: ColumnsType<BiochemicalProduct> = [
    {
      title: '指标名称',
      key: 'indicator_name',
      render: (_, product) => <span className="font-semibold text-slate-900">{product.indicator_name}</span>,
    },
    {
      title: '货号',
      dataIndex: 'catalog_number',
      key: 'catalog_number',
      width: 140,
      render: (value: string) => <span className="font-mono text-xs text-slate-600">{value}</span>,
    },
    {
      title: '规格',
      key: 'specifications',
      width: 120,
      render: (_, product) => product.specifications?.join(' / ') || '96T',
    },
    {
      title: '波长',
      dataIndex: 'wavelength',
      key: 'wavelength',
      width: 110,
    },
    {
      title: '96T价格',
      key: 'price',
      width: 200,
      render: (_, product) => (
        <span className="font-semibold text-emerald-700">
          {product.price_48t !== null && product.price_48t !== undefined ? `48T ¥${Number(product.price_48t).toLocaleString('zh-CN')} / ` : ''}96T ¥{Number(product.price_96t).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_, product) => statusTag(product.status),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_, product) => (
        <>
          <Button type="text" size="small" title="编辑" icon={<EditOutlined />} onClick={() => beginEdit(product)} />
          {product.status !== 'archived' && (
            <Popconfirm
              title={`确认归档“${product.indicator_name} / ${product.catalog_number}”吗？归档后前台不再显示。`}
              okText="归档"
              cancelText="取消"
              onConfirm={() => void archiveProduct(product)}
            >
              <Button type="text" size="small" danger title="归档" icon={<InboxOutlined />} />
            </Popconfirm>
          )}
        </>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<ExperimentOutlined />}
        title="生化法试剂盒"
        description="独立产品目录：仅维护货号、指标名称、检测波长、96T规格和单盒价格。此处与 ELISA 商品管理完全分开。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={beginCreate}>
            新增生化产品
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: '全部目录', count: counts.all, cls: 'text-slate-900' },
          { label: '前台已发布', count: counts.active, cls: 'text-emerald-600' },
          { label: '草稿', count: counts.draft, cls: 'text-amber-600' },
          { label: '已归档', count: counts.archived, cls: 'text-slate-500' },
        ].map(({ label, count, cls }) => (
          <Card key={label} size="small">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-xl font-bold ${cls}`}>{count}</p>
          </Card>
        ))}
      </div>

      {loadError && <Alert className="mt-5" type="error" showIcon message={loadError} />}

      {needsMigration && (
        <Alert
          className="mt-5"
          type="warning"
          showIcon
          message="当前数据库还是旧版生化产品结构"
          description={<>旧记录可以查看，但双规格和对应价格暂时不能保存；请先在 Supabase SQL Editor 执行 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">supabase/migrations/070_biochemical_product_specifications.sql</code>。</>}
        />
      )}

      <Card className="mt-5" size="small">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            className="w-full max-w-md"
            prefix={<SearchOutlined />}
            placeholder="搜索货号、指标或波长"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="text-xs text-slate-500">共 {products.length} 条</span>
        </div>
        <Table<BiochemicalProduct>
          rowKey="id"
          columns={columns}
          dataSource={products}
          loading={loading}
          pagination={false}
          scroll={{ x: 800 }}
          locale={{ emptyText: search ? '没有找到匹配产品' : '还没有生化法试剂盒，点击右上角开始新增' }}
        />
      </Card>

      <Modal
        open={formOpen}
        title={editing ? '编辑生化产品' : '新增生化产品'}
        width={600}
        onCancel={closeForm}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={closeForm}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={saving} onClick={() => void saveProduct()}>
            {editing ? '保存修改' : '保存产品'}
          </Button>,
        ]}
      >
        {formError && <Alert className="mb-4" type="error" showIcon message={formError} />}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void saveProduct()
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">货号 *</span>
            <Input value={form.catalog_number} onChange={(event) => setField('catalog_number', event.target.value)} placeholder="例如 LV90001" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">指标名称 *</span>
            <Input value={form.indicator_name} onChange={(event) => setField('indicator_name', event.target.value)} placeholder="例如 SOD、MDA、ALT" />
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">规格 *</span>
            <div className="grid grid-cols-2 gap-2">
              <Checkbox checked disabled>96T</Checkbox>
              <Checkbox checked={form.has_48t} onChange={(event) => setField('has_48t', event.target.checked)}>48T</Checkbox>
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500">操作波长 *</span>
            <Input value={form.wavelength} onChange={(event) => setField('wavelength', event.target.value)} placeholder="例如 450 nm、570 nm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">96T价格 *</span>
              <InputNumber<string | number>
                className="w-full"
                min={0}
                step={0.01}
                placeholder="手动输入"
                value={form.price_96t}
                onChange={(value) => setField('price_96t', value === null ? '' : String(value))}
              />
            </label>
            {form.has_48t && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500">48T价格 *</span>
                <InputNumber<string | number>
                  className="w-full"
                  min={0}
                  step={0.01}
                  placeholder="手动输入"
                  value={form.price_48t}
                  onChange={(value) => setField('price_48t', value === null ? '' : String(value))}
                />
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">前台状态</span>
              <Select
                className="w-full"
                value={form.status}
                onChange={(value: ProductStatus) => setField('status', value)}
                options={[
                  { value: 'draft', label: '草稿' },
                  { value: 'active', label: '发布' },
                  { value: 'archived', label: '归档' },
                ]}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">排列序号</span>
              <InputNumber
                className="w-full"
                value={form.sort_order}
                onChange={(value) => setField('sort_order', value === null ? '' : String(value))}
              />
            </label>
          </div>
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>

        {!editing ? (
          <div className="mt-5 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
            <UploadOutlined className="mb-1 mr-1 text-slate-400" />
            保存产品后，点击列表中的编辑按钮即可上传操作说明书 PDF。
          </div>
        ) : (
          <>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold text-slate-900">操作说明书 PDF</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">单个文件不超过 20MB，上传后自动替换当前有效说明书。</p>
            </div>
            {documentLoading ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Spin size="small" /> 正在读取说明书状态</p>
            ) : (
              <>
                <label
                  onDragOver={(event) => { event.preventDefault(); setDocumentDragActive(true) }}
                  onDragLeave={() => setDocumentDragActive(false)}
                  onDrop={handleDocumentDrop}
                  className={`mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${documentDragActive ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/60'} ${documentSaving ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    disabled={documentSaving}
                    onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadDocument(file) }}
                  />
                  {documentSaving ? <Spin className="text-xl" /> : <UploadOutlined className="text-xl text-sky-600" />}
                  <span className="mt-2 text-xs font-semibold text-slate-700">点击选择 PDF，或将 PDF 拖到这里</span>
                  <span className="mt-1 text-[11px] text-slate-500">上传后会自动替换当前有效说明书</span>
                </label>
                {document ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="truncate text-xs font-semibold text-emerald-700" title={document.file_name}>{document.file_name}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Typography.Link href={document.file_url} target="_blank" rel="noreferrer" className="text-xs">在线预览</Typography.Link>
                      <Typography.Link href={buildProductDocumentDownloadUrl(document.file_url, document.file_name)} className="text-xs">下载</Typography.Link>
                      <Popconfirm
                        title="确认删除当前生化产品的操作说明书吗？删除后客户将无法查看和下载。"
                        okText="删除"
                        cancelText="取消"
                        onConfirm={() => void deleteDocument()}
                      >
                        <Button type="link" danger size="small" className="ml-auto h-auto p-0 text-xs">删除</Button>
                      </Popconfirm>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-600">尚未上传说明书，前台详情页会显示“说明书暂未上传”。</p>
                )}
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
