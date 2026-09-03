'use client'

import { useEffect, useState } from 'react'
import { ImagePlus, Loader2, Plus, Save, Trash2, UploadCloud, X } from 'lucide-react'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function loadBanners() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/home-banners')
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '读取失败')
      setBanners(data.banners || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取失败')
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
    setError('')
    try {
      const res = await fetch('/api/admin/home-banners', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '保存失败')
      setEditing(emptyBanner)
      await loadBanners()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBanner(id?: string) {
    if (!id) return
    if (!window.confirm('确定删除这个首页广告位吗？')) return
    setError('')
    const res = await fetch(`/api/admin/home-banners?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok || data.error) {
      setError(data.error || '删除失败')
      return
    }
    if (editing.id === id) setEditing(emptyBanner)
    await loadBanners()
  }

  async function uploadBannerImage(file: File) {
    setUploading(true)
    setError('')
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
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <ImagePlus className="h-5 w-5 text-cyan-400" />
          首页广告位
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          管理首页首屏轮播广告，用于新品发布、活动推广、节日庆祝和公告展示。
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">{editing.id ? '编辑广告位' : '新增广告位'}</h2>
            <button
              type="button"
              onClick={() => setEditing(emptyBanner)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              新建
            </button>
          </div>

          <div className="space-y-3">
            <Field label="主标题" value={editing.title} onChange={(value) => setEditing({ ...editing, title: value })} />
            <Field label="副标题" value={editing.subtitle} onChange={(value) => setEditing({ ...editing, subtitle: value })} />
            <Field label="标签" value={editing.eyebrow} onChange={(value) => setEditing({ ...editing, eyebrow: value })} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">广告描述</span>
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={4}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="主按钮文字" value={editing.cta_label} onChange={(value) => setEditing({ ...editing, cta_label: value })} />
              <Field label="主按钮链接" value={editing.cta_href} onChange={(value) => setEditing({ ...editing, cta_href: value })} />
              <Field label="次按钮文字" value={editing.secondary_label} onChange={(value) => setEditing({ ...editing, secondary_label: value })} />
              <Field label="次按钮链接" value={editing.secondary_href} onChange={(value) => setEditing({ ...editing, secondary_href: value })} />
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-medium text-slate-300">广告海报图</span>
                  <span className="text-[11px] text-slate-500">建议 16:9，1600 x 900；不上传时前台使用系统生成图。</span>
                </div>
                {editing.image_url && (
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, image_url: '' })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                    清除图片
                  </button>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
                <div className="aspect-video overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                  {editing.image_url ? (
                    <img src={editing.image_url} alt="广告图预览" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-center text-xs text-slate-500">
                      未上传图片
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {uploading ? '上传中...' : '上传海报图片'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadBannerImage(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <Field label="图片 URL，也可直接粘贴外部图片地址" value={editing.image_url} onChange={(value) => setEditing({ ...editing, image_url: value })} />
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">主题</span>
                <select
                  value={editing.theme}
                  onChange={(e) => setEditing({ ...editing, theme: e.target.value as Banner['theme'] })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                >
                  {themes.map((theme) => (
                    <option key={theme.value} value={theme.value}>{theme.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">排序</span>
                <input
                  type="number"
                  value={editing.sort_order}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 1 })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                />
                上架显示
              </label>
            </div>
            <button
              type="button"
              onClick={saveBanner}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存广告位
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-semibold text-white">广告位列表</h2>
          {loading ? (
            <div className="grid h-48 place-items-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : banners.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-10 text-center text-sm text-slate-400">
              暂无广告位。前台会使用默认轮播内容。
            </div>
          ) : (
            <div className="space-y-3">
              {banners.map((banner) => (
                <div key={banner.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">#{banner.sort_order}</span>
                        <span className={`rounded px-2 py-0.5 text-xs ${banner.is_active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                          {banner.is_active ? '上架中' : '已下架'}
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-white">{banner.title} · {banner.subtitle}</h3>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{banner.description}</p>
                      {banner.image_url && (
                        <div className="mt-3 aspect-video w-56 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                          <img src={banner.image_url} alt={banner.title} className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(banner)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteBanner(banner.id)}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
      />
    </label>
  )
}
