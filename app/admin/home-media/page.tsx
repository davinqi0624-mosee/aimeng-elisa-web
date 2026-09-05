'use client'

import { useEffect, useRef, useState } from 'react'
import { Modal, Alert, Button, Card, Checkbox, Input, InputNumber, Popconfirm, Select, Space, Statistic, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CloudUploadOutlined,
  CloseOutlined,
  DeleteOutlined,
  ExportOutlined,
  PlusOutlined,
  SaveOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'
import { HOME_MEDIA_CATEGORY_LABELS, hasUsableHomeMediaLink, isPlayableHomeMediaUrl, type HomeMediaCategory, type HomeMediaItem } from '@/lib/home-media'

type EditableHomeMediaItem = Omit<HomeMediaItem, 'id'> & { id?: string }

const emptyItem: EditableHomeMediaItem = {
  category: 'elisa',
  title: '',
  summary: '',
  platform: '小红书',
  external_url: '',
  cover_image_url: '',
  published_at: '',
  sort_order: 1,
  is_featured: false,
  is_active: true,
}

const platforms = ['小红书', '视频号', '抖音', 'B站', '公众号', '本地视频', '其他']

export default function AdminHomeMediaPage() {
  const [items, setItems] = useState<HomeMediaItem[]>([])
  const [editing, setEditing] = useState<EditableHomeMediaItem>(emptyItem)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const coverInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  function openCreate() {
    setEditing(emptyItem)
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function openEdit(item: HomeMediaItem) {
    setEditing(item)
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(emptyItem)
    setError('')
    setNotice('')
  }

  async function loadItems() {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/home-media')
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '读取失败')
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取失败')
    } finally {
      setLoading(false)
    }
  }

  async function persistItem(nextItem: EditableHomeMediaItem, options?: { resetAfterSave?: boolean }) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/home-media', {
        method: nextItem.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextItem),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '保存失败')
      if (options?.resetAfterSave !== false) {
        setEditing(emptyItem)
        setFormOpen(false)
      } else if (data.item) {
        setEditing((current) => ({
          ...current,
          ...nextItem,
          id: data.item.id || current.id,
        }))
      }
      await loadItems()
      return data.item as HomeMediaItem | undefined
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
      throw err
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始进入后台时需要立即读取自媒体内容。
    loadItems()
  }, [])

  async function saveItem() {
    await persistItem(editing)
  }

  async function deleteItem(id?: string) {
    if (!id) return
    setError('')
    setNotice('')
    const res = await fetch(`/api/admin/home-media?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok || data.error) {
      setError(data.error || '删除失败')
      return
    }
    if (editing.id === id) closeForm()
    await loadItems()
  }

  async function uploadCoverImage(file: File) {
    setUploadingCover(true)
    setError('')
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('请上传图片文件，支持 PNG、JPG、WebP 等常见格式。')
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('图片不能超过 8MB，建议使用 16:9 的视频封面图。')
      }

      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const body = new FormData()
      body.append('file', file)
      body.append('bucket', 'product-assets')
      body.append('path', `home-media/${editing.category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`)
      if (editing.cover_image_url) body.append('old_url', editing.cover_image_url)

      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '上传失败')
      setEditing((current) => ({ ...current, cover_image_url: data.url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploadingCover(false)
    }
  }

  async function uploadVideoFile(file: File) {
    setUploadingVideo(true)
    setError('')
    setNotice('')
    try {
      const isVideoFile = file.type.startsWith('video/') || /\.(mp4|webm|ogg|m4v|mov)$/i.test(file.name)
      if (!isVideoFile) {
        throw new Error('请上传视频文件，支持 MP4、WebM、OGG、MOV 等格式。')
      }
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('视频不能超过 100MB。')
      }

      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
      const body = new FormData()
      body.append('file', file)
      body.append('bucket', 'product-assets')
      body.append('path', `home-media/videos/${editing.category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`)
      if (editing.external_url && editing.external_url.includes('/storage/v1/object/public/')) {
        body.append('old_url', editing.external_url)
      }

      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok || data.error || !data.url) throw new Error(data.error || '视频上传失败')
      const nextItem = {
        ...editing,
        external_url: data.url,
        platform: '本地视频',
      }
      setEditing(nextItem)
      if (nextItem.id || nextItem.title.trim()) {
        await persistItem(nextItem, { resetAfterSave: false })
        setNotice('视频已上传并保存成功，首页会直接播放。')
      } else {
        setNotice('视频已上传成功，请先补全标题，再点击保存。')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '视频上传失败')
    } finally {
      setUploadingVideo(false)
    }
  }

  const groupedCounts = items.reduce<Record<HomeMediaCategory, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1
    return acc
  }, { elisa: 0, cell_culture: 0 })

  const columns: ColumnsType<HomeMediaItem> = [
    {
      title: '封面',
      key: 'cover',
      width: 160,
      render: (_, item) =>
        item.cover_image_url ? (
          <img src={item.cover_image_url} alt={item.title} className="aspect-video w-32 rounded-md object-cover" />
        ) : (
          <div className="grid aspect-video w-32 place-items-center rounded-md bg-slate-50 text-xs text-slate-400">无封面</div>
        ),
    },
    {
      title: '内容',
      key: 'content',
      render: (_, item) => (
        <div className="min-w-0">
          <Space wrap size={[4, 4]}>
            <Tag color="cyan">{HOME_MEDIA_CATEGORY_LABELS[item.category]}</Tag>
            <Tag>{item.platform}</Tag>
            {item.is_featured && <Tag color="gold">左侧置顶</Tag>}
            {item.is_active ? <Tag color="green">已上架</Tag> : <Tag>未上架</Tag>}
            {item.platform === '本地视频' && !isPlayableHomeMediaUrl(item.external_url) && <Tag color="gold">视频地址无效</Tag>}
          </Space>
          <div className="mt-2 text-sm font-medium text-slate-900">{item.title}</div>
          {item.summary && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>排序 {item.sort_order}</span>
            {item.published_at && <span>{new Date(item.published_at).toLocaleString('zh-CN')}</span>}
            {hasUsableHomeMediaLink(item) ? (
              <a href={item.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-500">
                打开链接 <ExportOutlined />
              </a>
            ) : (
              <span className="text-amber-600">暂无有效视频地址</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, item) => (
        <Space>
          <Button size="small" onClick={() => openEdit(item)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除这条自媒体内容吗？"
            description="删除后首页不会再展示。"
            onConfirm={() => deleteItem(item.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<VideoCameraOutlined />}
        title="自媒体内容"
        description="维护首页自媒体窗口。既可以粘贴小红书/视频号等外链，也可以直接上传本地视频文件，首页会按 ELISA 与细胞培养分类展示。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增内容
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card size="small">
          <Statistic title="ELISA 内容" value={groupedCounts.elisa} />
        </Card>
        <Card size="small">
          <Statistic title="细胞培养内容" value={groupedCounts.cell_culture} />
        </Card>
        <Card size="small">
          <div className="text-xs text-slate-500">首页展示逻辑</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">置顶内容显示在左侧视频窗口，其余上架内容进入右侧最新动态。</p>
        </Card>
      </div>

      <div className="mt-4 space-y-4">
        {error && <Alert type="error" showIcon message={error} />}
        {notice && <Alert type="success" showIcon message={notice} />}

        <Card size="small" title="内容列表">
          <Table<HomeMediaItem>
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={loading}
            locale={{ emptyText: '暂无自媒体内容，点击右上角新增一条。' }}
            pagination={false}
          />
        </Card>

        <Modal
          open={formOpen}
          title={editing.id ? '编辑自媒体内容' : '新增自媒体内容'}
          width={680}
          onCancel={closeForm}
          destroyOnHidden
          footer={[
            <Button key="cancel" onClick={closeForm}>取消</Button>,
            <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => saveItem()}>
              保存自媒体内容
            </Button>,
          ]}
        >
          {error && <Alert className="mb-4" type="error" showIcon message={error} />}
          {notice && <Alert className="mb-4" type="success" showIcon message={notice} />}
          <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">内容分类</div>
                <Select<HomeMediaCategory>
                  className="w-full"
                  value={editing.category}
                  onChange={(value) => setEditing({ ...editing, category: value })}
                  options={Object.entries(HOME_MEDIA_CATEGORY_LABELS).map(([value, label]) => ({
                    value: value as HomeMediaCategory,
                    label,
                  }))}
                />
              </div>

              <Field label="标题" value={editing.title} onChange={(value) => setEditing({ ...editing, title: value })} />
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">内容简述</div>
                <Input.TextArea
                  value={editing.summary}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[130px_1fr]">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">平台</div>
                  <Select
                    className="w-full"
                    value={editing.platform}
                    onChange={(value) => setEditing({ ...editing, platform: value })}
                    options={platforms.map((platform) => ({ value: platform, label: platform }))}
                  />
                </div>
                <Field
                  label="内容链接"
                  value={editing.external_url}
                  onChange={(value) => setEditing({ ...editing, external_url: value })}
                  placeholder="粘贴小红书笔记链接或视频地址"
                />
                <div className="space-y-2">
                  <Button
                    icon={<VideoCameraOutlined />}
                    loading={uploadingVideo}
                    onClick={() => videoInputRef.current?.click()}
                  >
                    上传本地视频
                  </Button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.ogg,.mov"
                    disabled={uploadingVideo}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.currentTarget.value = ''
                      if (file) uploadVideoFile(file)
                    }}
                    className="hidden"
                  />
                  <p className="text-[11px] leading-5 text-slate-400">
                    上传本地视频后会自动保存并回填链接，首页会直接播放；如需更好看，建议再配一张封面图。
                  </p>
                  {editing.platform === '本地视频' && editing.external_url && !isPlayableHomeMediaUrl(editing.external_url) && (
                    <Alert
                      type="warning"
                      showIcon
                      message="当前地址不是有效视频文件。请重新点击“上传本地视频”，不要填写 /videos 或普通文字。"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs font-medium text-slate-600">视频封面</span>
                    <span className="text-[11px] text-slate-400">建议 16:9。小红书封面不能自动抓取时，可截图后上传。</span>
                  </div>
                  {editing.cover_image_url && (
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => setEditing({ ...editing, cover_image_url: '' })}
                    >
                      清除
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-[170px_1fr]">
                  <div className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {editing.cover_image_url ? (
                      <img src={editing.cover_image_url} alt="自媒体封面预览" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-center text-xs text-slate-400">
                        未上传封面
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Button
                      type="primary"
                      icon={<CloudUploadOutlined />}
                      loading={uploadingCover}
                      onClick={() => coverInputRef.current?.click()}
                    >
                      上传封面
                    </Button>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      disabled={uploadingCover}
                      onChange={(e) => e.target.files?.[0] && uploadCoverImage(e.target.files[0])}
                      className="hidden"
                    />
                    <Field
                      label="封面 URL，也可直接粘贴图片地址"
                      value={editing.cover_image_url}
                      onChange={(value) => setEditing({ ...editing, cover_image_url: value })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">发布时间</div>
                  <input
                    type="datetime-local"
                    value={toLocalInputValue(editing.published_at)}
                    onChange={(e) => setEditing({ ...editing, published_at: e.target.value })}
                    className="h-8 w-full rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-900 outline-none focus:border-sky-500"
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
                <div className="flex flex-col justify-end gap-2 pb-1">
                  <Checkbox
                    checked={editing.is_featured}
                    onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })}
                  >
                    左侧置顶
                  </Checkbox>
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
    </div>
  )
}

function toLocalInputValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function Field({
  label,
  value,
  onChange,
  placeholder = '',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
