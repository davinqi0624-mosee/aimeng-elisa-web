'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock3, ExternalLink, Play, Volume2, VolumeX } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  DEFAULT_HOME_MEDIA_ITEMS,
  HOME_MEDIA_CATEGORY_LABELS,
  hasUsableHomeMediaLink,
  isHttpHomeMediaUrl,
  isPlayableHomeMediaUrl,
  type HomeMediaCategory,
  type HomeMediaItem,
} from '@/lib/home-media'

function sortHomeMedia(items: HomeMediaItem[]) {
  return [...items].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    const aUpdated = new Date(a.updated_at || a.published_at || a.created_at || 0).getTime()
    const bUpdated = new Date(b.updated_at || b.published_at || b.created_at || 0).getTime()
    return bUpdated - aUpdated
  })
}

function getVideoBadge(item: HomeMediaItem) {
  if (isPlayableHomeMediaUrl(item.external_url)) return '本地播放'
  if (item.platform === '本地视频') return '待绑定视频'
  return item.platform || '外链'
}

export default function VideosPage() {
  const searchParams = useSearchParams()
  const highlightedId = searchParams.get('highlight') || ''
  const [items, setItems] = useState<HomeMediaItem[]>(DEFAULT_HOME_MEDIA_ITEMS)
  const [selectedId, setSelectedId] = useState<string>(highlightedId || DEFAULT_HOME_MEDIA_ITEMS[0]?.id || '')
  const [muted, setMuted] = useState(true)
  const [category, setCategory] = useState<HomeMediaCategory | 'all'>('all')

  const categories: Array<HomeMediaCategory | 'all'> = ['all', 'elisa', 'cell_culture']
  const sortedItems = useMemo(() => sortHomeMedia(items), [items])
  const filteredItems = useMemo(
    () => sortedItems.filter((item) => category === 'all' || item.category === category),
    [sortedItems, category]
  )
  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) || filteredItems[0] || sortedItems[0] || DEFAULT_HOME_MEDIA_ITEMS[0],
    [filteredItems, sortedItems, selectedId]
  )
  const canOpenSelectedSource = hasUsableHomeMediaLink(selectedItem)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/home-media', { cache: 'no-store' })
        const data = await res.json()
        if (res.ok && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items)
          return
        }
      } catch {
        // keep defaults
      }
      setItems(DEFAULT_HOME_MEDIA_ITEMS)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">Video Library</p>
          <h1 className="mt-3 text-3xl font-black tracking-normal text-slate-950 md:text-4xl">实验视频库</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
            首页上传的本地短视频和外链内容都会在这里汇总。左侧直接播放，右侧按分类浏览，适合放 ELISA 实操、细胞培养和动画短片。
          </p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                category === item ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-cyan-300'
              }`}
            >
              {item === 'all' ? '全部' : HOME_MEDIA_CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[#09111F] text-white shadow-sm">
            <div className="relative aspect-video overflow-hidden bg-slate-950">
              {isPlayableHomeMediaUrl(selectedItem.external_url) ? (
                <video
                  key={selectedItem.id}
                  src={selectedItem.external_url}
                  poster={selectedItem.cover_image_url || '/images/elisa/elisa_sandwich_pencil.jpg'}
                  autoPlay
                  muted={muted}
                  loop
                  playsInline
                  controls
                  preload="auto"
                  onCanPlay={(event) => {
                    event.currentTarget.play().catch(() => {})
                  }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="relative h-full w-full">
                  <Image
                    src={selectedItem.cover_image_url || '/images/elisa/elisa_sandwich_pencil.jpg'}
                    alt={selectedItem.title}
                    width={1344}
                    height={768}
                    className="h-full w-full object-cover opacity-85"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,17,31,0.88),rgba(9,17,31,0.44)_56%,rgba(9,17,31,0.7))]" />
                  <div className="absolute left-6 top-6 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                    {getVideoBadge(selectedItem)}
                  </div>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-5 md:p-7">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-black text-white">
                      {HOME_MEDIA_CATEGORY_LABELS[selectedItem.category]}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                      {getVideoBadge(selectedItem)}
                    </span>
                    {selectedItem.platform && (
                      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                        {selectedItem.platform}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-4 text-2xl font-black tracking-normal md:text-4xl">{selectedItem.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-200 md:text-base">{selectedItem.summary}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {isPlayableHomeMediaUrl(selectedItem.external_url) ? (
                      <button
                        type="button"
                        onClick={() => setMuted((current) => !current)}
                        className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
                      >
                        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        {muted ? '开启声音' : '静音'}
                      </button>
                    ) : canOpenSelectedSource ? (
                      <a
                        href={selectedItem.external_url}
                        target={isHttpHomeMediaUrl(selectedItem.external_url) ? '_blank' : undefined}
                        rel={isHttpHomeMediaUrl(selectedItem.external_url) ? 'noreferrer' : undefined}
                        className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-50"
                      >
                        去内容链接 <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-amber-300/40 bg-amber-200/10 px-4 py-2 text-sm font-bold text-amber-100">
                        视频地址待绑定
                      </span>
                    )}
                    {canOpenSelectedSource && (
                      <a
                        href={selectedItem.external_url}
                        target={isHttpHomeMediaUrl(selectedItem.external_url) ? '_blank' : undefined}
                        rel={isHttpHomeMediaUrl(selectedItem.external_url) ? 'noreferrer' : undefined}
                        className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
                      >
                        {isPlayableHomeMediaUrl(selectedItem.external_url) ? '打开原始视频' : '打开来源页'} <Play className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Playlist</p>
                <h3 className="mt-2 text-2xl font-black tracking-normal text-slate-950">视频目录</h3>
              </div>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                {filteredItems.length} 条
              </span>
            </div>

            <div className="mt-5 max-h-[640px] space-y-3 overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const active = item.id === selectedItem.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`grid w-full grid-cols-[88px_1fr] items-center gap-3 rounded-xl border p-3 text-left transition ${
                      active ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-cyan-200 hover:bg-cyan-50'
                    }`}
                  >
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-200">
                      {item.cover_image_url ? (
                        <Image
                          src={item.cover_image_url}
                          alt={item.title}
                          width={352}
                          height={198}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#E0F2FE,#ECFDF5)]" />
                      )}
                      <div className="absolute inset-0 grid place-items-center bg-slate-950/20">
                        <div className="rounded-full bg-white/90 p-2 shadow-sm">
                          <Play className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {HOME_MEDIA_CATEGORY_LABELS[item.category]}
                        </span>
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {getVideoBadge(item)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{item.title}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span>{item.platform || '视频内容'}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
