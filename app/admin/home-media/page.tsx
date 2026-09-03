'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, Plus, Save, Trash2, UploadCloud, Video, X } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
    if (!window.confirm('确定删除这条自媒体内容吗？删除后首页不会再展示。')) return
    setError('')
    setNotice('')
    const res = await fetch(`/api/admin/home-media?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok || data.error) {
      setError(data.error || '删除失败')
      return
    }
    if (editing.id === id) setEditing(emptyItem)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <Video className="h-5 w-5 text-cyan-400" />
          自媒体内容
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          维护首页自媒体窗口。既可以粘贴小红书/视频号等外链，也可以直接上传本地视频文件，首页会按 ELISA 与细胞培养分类展示。
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs text-slate-500">ELISA 内容</div>
          <div className="mt-1 text-2xl font-bold text-white">{groupedCounts.elisa}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs text-slate-500">细胞培养内容</div>
          <div className="mt-1 text-2xl font-bold text-white">{groupedCounts.cell_culture}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs text-slate-500">首页展示逻辑</div>
          <div className="mt-2 text-sm leading-6 text-slate-300">置顶内容显示在左侧视频窗口，其余上架内容进入右侧最新动态。</div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">{editing.id ? '编辑自媒体内容' : '新增自媒体内容'}</h2>
            <button
              type="button"
              onClick={() => setEditing(emptyItem)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              新建
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">内容分类</span>
              <select
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value as HomeMediaCategory })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
              >
                {Object.entries(HOME_MEDIA_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <Field label="标题" value={editing.title} onChange={(value) => setEditing({ ...editing, title: value })} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">内容简述</span>
              <textarea
                value={editing.summary}
                onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-[130px_1fr]">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">平台</span>
                <select
                  value={editing.platform}
                  onChange={(e) => setEditing({ ...editing, platform: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                >
                  {platforms.map((platform) => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
              </label>
              <Field label="内容链接" value={editing.external_url} onChange={(value) => setEditing({ ...editing, external_url: value })} placeholder="粘贴小红书笔记链接或视频地址" />
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                  {uploadingVideo ? '上传视频中...' : '上传本地视频'}
                  <input
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
                </label>
                <p className="text-[11px] leading-5 text-slate-500">
                  上传本地视频后会自动保存并回填链接，首页会直接播放；如需更好看，建议再配一张封面图。
                </p>
                {editing.platform === '本地视频' && editing.external_url && !isPlayableHomeMediaUrl(editing.external_url) && (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-200">
                    当前地址不是有效视频文件。请重新点击“上传本地视频”，不要填写 /videos 或普通文字。
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-medium text-slate-300">视频封面</span>
                  <span className="text-[11px] text-slate-500">建议 16:9。小红书封面不能自动抓取时，可截图后上传。</span>
                </div>
                {editing.cover_image_url && (
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, cover_image_url: '' })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                    清除
                  </button>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-[170px_1fr]">
                <div className="aspect-video overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                  {editing.cover_image_url ? (
                    <img src={editing.cover_image_url} alt="自媒体封面预览" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-center text-xs text-slate-500">
                      未上传封面
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
                    {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {uploadingCover ? '上传中...' : '上传封面'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingCover}
                      onChange={(e) => e.target.files?.[0] && uploadCoverImage(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <Field label="封面 URL，也可直接粘贴图片地址" value={editing.cover_image_url} onChange={(value) => setEditing({ ...editing, cover_image_url: value })} />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="发布时间" type="datetime-local" value={toLocalInputValue(editing.published_at)} onChange={(value) => setEditing({ ...editing, published_at: value })} />
              <Field label="排序" type="number" value={String(editing.sort_order)} onChange={(value) => setEditing({ ...editing, sort_order: Number(value) || 1 })} />
              <div className="flex flex-col justify-end gap-2 pb-1 text-sm text-slate-300">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editing.is_featured}
                    onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                  />
                  左侧置顶
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editing.is_active}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                  />
                  上架显示
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={saveItem}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存自媒体内容
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-semibold text-white">内容列表</h2>
          {loading ? (
            <div className="grid h-48 place-items-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
              暂无自媒体内容，先在左侧新增一条小红书链接。
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-[150px_1fr_auto]">
                  <div className="aspect-video overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                    {item.cover_image_url ? (
                      <img src={item.cover_image_url} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-slate-600">无封面</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                        {HOME_MEDIA_CATEGORY_LABELS[item.category]}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{item.platform}</span>
                      {item.is_featured && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">左侧置顶</span>}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${item.is_active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                        {item.is_active ? '已上架' : '未上架'}
                      </span>
                      {item.platform === '本地视频' && !isPlayableHomeMediaUrl(item.external_url) && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">视频地址无效</span>
                      )}
                    </div>
                    <h3 className="mt-2 truncate text-base font-semibold text-white">{item.title}</h3>
                    {item.summary && <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">{item.summary}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>排序 {item.sort_order}</span>
                      {item.published_at && <span>{new Date(item.published_at).toLocaleString('zh-CN')}</span>}
                      {hasUsableHomeMediaLink(item) ? (
                        <a href={item.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200">
                          打开链接 <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-amber-300">暂无有效视频地址</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 md:flex-col">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
      />
    </label>
  )
}
