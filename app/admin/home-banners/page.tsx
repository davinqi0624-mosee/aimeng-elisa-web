'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Checkbox, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CloudUploadOutlined,
  CloseOutlined,
  DeleteOutlined,
  PictureOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

type Banner = {
  id?: string
  title: string
  subtitle: string
  eyebrow: string
  description: string
  cta_label: string
  cta_href: string
  secondary_label: string
  secondary_href: string
  image_url: string
  theme: 'blue' | 'emerald' | 'amber' | 'rose'
  sort_order: number
  is_active: boolean
}

const emptyBanner: Banner = {
  title: '',
  subtitle: '',
  eyebrow: 'PROMOTION',
  description: '',
  cta_label: '查看详情',
  cta_href: '/',
  secondary_label: '',
  secondary_href: '#',
  image_url: '',
  theme: 'blue',
  sort_order: 1,
  is_active: true,
}

const themes = [
  { value: 'blue', label: '蓝色 科技' },
  { value: 'emerald', label: '绿色 实验' },
  { value: 'amber', label: '橙色 活动' },
  { value: 'rose', label: '玫红 节日' },
] as const

export default function AdminHomeBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [editing, setEditing] = useState<Banner>(emptyBanner)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)

  function openCreate() {
    setEditing(emptyBanner)
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(banner: Banner) {
    setEditing(banner)
    setFormError('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(emptyBanner)
    setFormError('')
  }

  async function loadBanners() {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/home-banners')
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '读取失败')
      setBanners(data.banners || [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '读取失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次后台数据请求。
    loadBanners()
  }, [])

  async function saveBanner() {
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/admin/home-banners', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '保存失败')
      setFormOpen(false)
      setEditing(emptyBanner)
      await loadBanners()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBanner(id?: string) {
    if (!id) return
    setLoadError('')
    const res = await fetch(`/api/admin/home-banners?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok || data.error) {
      setLoadError(data.error || '删除失败')
      return
    }
    if (editing.id === id) closeForm()
    await loadBanners()
  }

  async function uploadBannerImage(file: File) {
    setUploading(true)
    setFormError('')
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('请上传图片文件，支持 PNG、JPG、WebP 等常见格式。')
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('图片不能超过 8MB，建议使用 1600 x 900 的 16:9 海报图。')
      }

      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const body = new FormData()
      body.append('file', file)
      body.append('bucket', 'product-assets')
      body.append('path', `home-banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`)
      if (editing.image_url) body.append('old_url', editing.image_url)

      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '上传失败')
      setEditing((current) => ({ ...current, image_url: data.url }))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const columns: ColumnsType<Banner> = [
    {
      title: '海报',
      key: 'poster',
      width: 160,
      render: (_, banner) =>
        banner.image_url ? (
          <img src={banner.image_url} alt={banner.title} className="aspect-video w-32 rounded-md object-cover" />
        ) : (
          <span className="text-xs text-slate-400">未上传</span>
        ),
    },
    {
      title: '标题 / 描述',
      key: 'title',
      render: (_, banner) => (
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900">{banner.title} · {banner.subtitle}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{banner.description}</p>
        </div>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 70,
      render: (v: number) => <span className="text-xs text-slate-500">#{v}</span>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (active: boolean) => (active ? <Tag color="green">上架中</Tag> : <Tag>已下架</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      render: (_, banner) => (
        <Space>
          <Button size="small" onClick={() => openEdit(banner)}>
            编辑
          </Button>
          <Popconfirm title="确定删除这个首页广告位吗？" onConfirm={() => deleteBanner(banner.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} title="删除" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<PictureOutlined />}
        title="首页广告位"
        description="管理首页首屏轮播广告，用于新品发布、活动推广、节日庆祝和公告展示。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增广告位
          </Button>
        }
      />

      {loadError && <Alert className="mb-4" type="error" showIcon message={loadError} />}

      <Card size="small" title="广告位列表">
        <Table<Banner>
          rowKey="id"
          columns={columns}
          dataSource={banners}
          loading={loading}
          locale={{ emptyText: '暂无广告位。前台会使用默认轮播内容。' }}
          pagination={false}
        />
      </Card>

      <Modal
        open={formOpen}
        title={editing.id ? '编辑广告位' : '新增广告位'}
        width={680}
        onCancel={closeForm}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={closeForm}>取消</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => saveBanner()}>
            保存广告位
          </Button>,
        ]}
      >
        {formError && <Alert className="mb-4" type="error" showIcon message={formError} />}
        <div className="space-y-3">
            <Field label="主标题" value={editing.title} onChange={(value) => setEditing({ ...editing, title: value })} />
            <Field label="副标题" value={editing.subtitle} onChange={(value) => setEditing({ ...editing, subtitle: value })} />
            <Field label="标签" value={editing.eyebrow} onChange={(value) => setEditing({ ...editing, eyebrow: value })} />
            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">广告描述</div>
              <Input.TextArea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="主按钮文字" value={editing.cta_label} onChange={(value) => setEditing({ ...editing, cta_label: value })} />
              <Field label="主按钮链接" value={editing.cta_href} onChange={(value) => setEditing({ ...editing, cta_href: value })} />
              <Field label="次按钮文字" value={editing.secondary_label} onChange={(value) => setEditing({ ...editing, secondary_label: value })} />
              <Field label="次按钮链接" value={editing.secondary_href} onChange={(value) => setEditing({ ...editing, secondary_href: value })} />
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-medium text-slate-600">广告海报图</span>
                  <span className="text-[11px] text-slate-400">建议 16:9，1600 x 900；不上传时前台使用系统生成图。</span>
                </div>
                {editing.image_url && (
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setEditing({ ...editing, image_url: '' })}
                  >
                    清除图片
                  </Button>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
                <div className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {editing.image_url ? (
                    <img src={editing.image_url} alt="广告图预览" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-center text-xs text-slate-400">
                      未上传图片
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Button
                    type="primary"
                    icon={<CloudUploadOutlined />}
                    loading={uploading}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    上传海报图片
                  </Button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && uploadBannerImage(e.target.files[0])}
                    className="hidden"
                  />
                  <Field label="图片 URL，也可直接粘贴外部图片地址" value={editing.image_url} onChange={(value) => setEditing({ ...editing, image_url: value })} />
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">主题</div>
                <Select<Banner['theme']>
                  className="w-full"
                  value={editing.theme}
                  onChange={(value) => setEditing({ ...editing, theme: value })}
                  options={themes.map((theme) => ({ value: theme.value, label: theme.label }))}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">排序</div>
                <InputNumber
                  className="w-full"
                  value={editing.sort_order}
                  onChange={(value) => setEditing({ ...editing, sort_order: typeof value === 'number' ? value : 1 })}
                />
              </div>
              <div className="flex items-end pb-2">
                <Checkbox
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                >
                  上架显示
                </Checkbox>
              </div>
            </div>
          </div>
      </Modal>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
