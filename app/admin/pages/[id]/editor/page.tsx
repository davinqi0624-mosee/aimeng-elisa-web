'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Eye,
  Save,
  CheckCircle2,
  ArrowLeft,
  Layers,
  Heading,
  Type,
  Image,
  Grid3X3,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Globe,
  AlertTriangle,
} from 'lucide-react'

interface Block {
  id: string
  type: 'hero' | 'text' | 'image' | 'features' | 'cta'
  title?: string
  content?: string
  align?: 'left' | 'center' | 'right'
  bg_color?: string
  text_color?: string
  src?: string
  alt?: string
  caption?: string
  items?: { icon?: string; title: string; description: string; href?: string }[]
  button_text?: string
  button_href?: string
}

const BLOCK_TYPES: { type: Block['type']; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'hero', label: 'Hero', icon: <Heading className="w-4 h-4" />, desc: '大标题横幅' },
  { type: 'text', label: '文本', icon: <Type className="w-4 h-4" />, desc: '文字段落' },
  { type: 'image', label: '图片', icon: <Image className="w-4 h-4" />, desc: '图片展示' },
  { type: 'features', label: '特性', icon: <Grid3X3 className="w-4 h-4" />, desc: '功能卡片' },
  { type: 'cta', label: 'CTA', icon: <Sparkles className="w-4 h-4" />, desc: '行动号召' },
]

const uid = () => Math.random().toString(36).slice(2, 9)

const pageLabel: Record<string, string> = {
  home: '首页',
  products: '产品',
  'ai-chat': 'AI客服',
  knowledge: '每日知识',
  papers: '文献引用',
  'points-mall': '积分商城',
  contact: '联系我们',
  about: '关于我们',
}

const defaultBlock = (type: Block['type']): Block => {
  switch (type) {
    case 'hero':
      return { id: uid(), type: 'hero', title: '主标题', content: '副标题描述', bg_color: '#0f172a', text_color: '#ffffff' }
    case 'text':
      return { id: uid(), type: 'text', title: '标题', content: '正文内容...', align: 'left' }
    case 'image':
      return { id: uid(), type: 'image', title: '图片标题', src: '', alt: '', caption: '' }
    case 'features':
      return { id: uid(), type: 'features', title: '核心优势', content: '描述内容', items: [
        { icon: '✨', title: '功能一', description: '描述内容' },
        { icon: '🔬', title: '功能二', description: '描述内容' },
        { icon: '🧪', title: '功能三', description: '描述内容' },
      ]}
    case 'cta':
      return { id: uid(), type: 'cta', title: '立即开始', content: '加入我们', button_text: '了解更多', button_href: '/' }
  }
}

export default function PageEditor() {
  const params = useParams()
  const router = useRouter()
  const pageId = params.id as string
  const supabase = createClient()

  const [slug, setSlug] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [legacyWarn, setLegacyWarn] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)

  const selectedBlock = blocks.find((b) => b.id === selectedId) || null

  // Load page data from Supabase
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('pages')
        .select('id, slug, title, blocks, is_published')
        .eq('id', pageId)
        .single()

      if (error || !data) {
        setLoading(false)
        return
      }

      setSlug(data.slug || '')
      setIsPublished(!!data.is_published)

      const raw = data.blocks
      if (Array.isArray(raw)) {
        setBlocks(raw as Block[])
      } else if (raw && typeof raw === 'object' && 'version' in raw) {
        setLegacyWarn(true)
        setBlocks([])
      } else {
        setBlocks([])
      }
      setLoading(false)
    }
    load()
  }, [pageId, supabase])

  const addBlock = (type: Block['type']) => {
    const b = defaultBlock(type)
    setBlocks((prev) => [...prev, b])
    setSelectedId(b.id)
  }

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const duplicateBlock = (id: string) => {
    const b = blocks.find((x) => x.id === id)
    if (!b) return
    const copy: Block = { ...b, id: uid(), items: b.items ? b.items.map((i) => ({ ...i })) : undefined }
    setBlocks((prev) => [...prev, copy])
    setSelectedId(copy.id)
  }

  const moveBlock = (index: number, dir: number) => {
    const newIdx = index + dir
    if (newIdx < 0 || newIdx >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(newIdx, 0, moved)
    setBlocks(next)
  }

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    const { error } = await supabase
      .from('pages')
      .update({ blocks, updated_at: new Date().toISOString() })
      .eq('id', pageId)
    setSaving(false)
    if (error) {
      alert('保存失败: ' + error.message)
    } else {
      setSaved(true)
      setIframeKey((k) => k + 1)
      setTimeout(() => setSaved(false), 1500)
    }
  }, [blocks, pageId, supabase])

  const handlePublish = useCallback(async () => {
    const next = !isPublished
    const { error } = await supabase
      .from('pages')
      .update({ is_published: next, updated_at: new Date().toISOString() })
      .eq('id', pageId)
    if (error) {
      alert(next ? '发布失败' : '撤回失败')
    } else {
      setIsPublished(next)
      setSaved(true)
      setIframeKey((k) => k + 1)
      setTimeout(() => setSaved(false), 1500)
    }
  }, [isPublished, pageId, supabase])

  const handleRestore = useCallback(async () => {
    if (!confirm('确定恢复默认？所有区块将被清空。')) return
    setBlocks([])
    setSelectedId(null)
    const { error } = await supabase
      .from('pages')
      .update({ blocks: [], is_published: false, updated_at: new Date().toISOString() })
      .eq('id', pageId)
    if (error) {
      alert('恢复失败: ' + error.message)
    } else {
      setIsPublished(false)
      setSaved(true)
      setIframeKey((k) => k + 1)
      setTimeout(() => setSaved(false), 1500)
    }
  }, [pageId, supabase])

  const previewUrl = pageId === 'home' ? '/' : slug || `/${pageId}`

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Top Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link href="/admin/pages" className="text-slate-400 hover:text-white text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Link>
          <div className="w-px h-5 bg-slate-700" />
          <Globe className="w-5 h-5 text-cyan-400" />
          <h1 className="text-white font-bold text-sm">{pageLabel[pageId] || pageId}</h1>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${isPublished ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
            {isPublished ? '已发布' : '草稿'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />已保存</span>}
          <button onClick={() => setIframeKey((k) => k + 1)} className="px-3 py-1.5 bg-slate-800 text-slate-200 rounded-lg text-sm hover:bg-slate-700 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> 预览
          </button>
          <button onClick={handlePublish} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${isPublished ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600/30' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
            {isPublished ? '撤回' : '发布'}
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> {saving ? '保存中' : '保存'}
          </button>
          <button onClick={handleRestore} className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-sm hover:bg-slate-700">
            恢复默认
          </button>
        </div>
      </div>

      {legacyWarn && (
        <div className="shrink-0 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          此页面使用旧版编辑器格式，已清空内容。请重新添加区块。
          <button onClick={() => setLegacyWarn(false)} className="ml-auto text-amber-300 hover:text-amber-200">知道了</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">添加区块</h3>
            <div className="grid grid-cols-1 gap-2">
              {BLOCK_TYPES.map((t) => (
                <button key={t.type} onClick={() => addBlock(t.type)} className="flex items-center gap-3 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors text-left">
                  <span className="text-slate-400">{t.icon}</span>
                  <div>
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-slate-500">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">区块列表 ({blocks.length})</h3>
            {blocks.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">暂无区块，点击上方添加</p>
              </div>
            ) : (
              <div className="space-y-2">
                {blocks.map((b, i) => {
                  const meta = BLOCK_TYPES.find((t) => t.type === b.type)
                  const active = selectedId === b.id
                  return (
                    <div key={b.id} onClick={() => setSelectedId(b.id)} className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${active ? 'bg-cyan-600/20 border border-cyan-500/30' : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'}`}>
                      <span className="text-slate-500">{meta?.icon}</span>
                      <span className="text-sm text-slate-300 truncate flex-1">{meta?.label}{b.title ? ` — ${b.title}` : ''}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); moveBlock(i, -1) }} disabled={i === 0} className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveBlock(i, 1) }} disabled={i === blocks.length - 1} className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); duplicateBlock(b.id) }} className="p-1 text-slate-500 hover:text-slate-300"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id) }} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Center Iframe */}
        <main className="flex-1 bg-slate-950 overflow-hidden flex justify-center p-4">
          <div className="w-full h-full bg-white rounded-lg overflow-hidden shadow-2xl">
            <iframe
              key={iframeKey}
              src={previewUrl}
              className="w-full h-full border-0"
              title="preview"
            />
          </div>
        </main>

        {/* Right Properties */}
        <aside className="w-72 shrink-0 bg-slate-900 border-l border-slate-800 overflow-y-auto">
          {selectedBlock ? (
            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{BLOCK_TYPES.find((t) => t.type === selectedBlock.type)?.label} 属性</h3>
                <button onClick={() => removeBlock(selectedBlock.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>

              {/* Title */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">标题</label>
                <input type="text" value={selectedBlock.title || ''} onChange={(e) => updateBlock(selectedBlock.id, { title: e.target.value })} className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" />
              </div>

              {/* Content */}
              {(selectedBlock.type === 'hero' || selectedBlock.type === 'text' || selectedBlock.type === 'features' || selectedBlock.type === 'cta') && (
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">内容</label>
                  <textarea value={selectedBlock.content || ''} onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })} rows={4} className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500 resize-y" />
                </div>
              )}

              {/* Hero colors */}
              {selectedBlock.type === 'hero' && (
                <>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">背景颜色</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={selectedBlock.bg_color || '#0f172a'} onChange={(e) => updateBlock(selectedBlock.id, { bg_color: e.target.value })} className="w-8 h-8 rounded border-0 p-0 bg-transparent cursor-pointer" />
                      <span className="text-xs text-slate-400 font-mono">{selectedBlock.bg_color || '#0f172a'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">文字颜色</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={selectedBlock.text_color || '#ffffff'} onChange={(e) => updateBlock(selectedBlock.id, { text_color: e.target.value })} className="w-8 h-8 rounded border-0 p-0 bg-transparent cursor-pointer" />
                      <span className="text-xs text-slate-400 font-mono">{selectedBlock.text_color || '#ffffff'}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Text align */}
              {selectedBlock.type === 'text' && (
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">对齐</label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((a) => (
                      <button key={a} onClick={() => updateBlock(selectedBlock.id, { align: a })} className={`flex-1 py-1.5 rounded text-xs capitalize ${selectedBlock.align === a ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{a}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Image */}
              {selectedBlock.type === 'image' && (
                <>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">图片 URL</label>
                    <input type="text" value={selectedBlock.src || ''} onChange={(e) => updateBlock(selectedBlock.id, { src: e.target.value })} placeholder="https://..." className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">替代文字</label>
                    <input type="text" value={selectedBlock.alt || ''} onChange={(e) => updateBlock(selectedBlock.id, { alt: e.target.value })} className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">说明</label>
                    <input type="text" value={selectedBlock.caption || ''} onChange={(e) => updateBlock(selectedBlock.id, { caption: e.target.value })} className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" />
                  </div>
                </>
              )}

              {/* Features items */}
              {selectedBlock.type === 'features' && selectedBlock.items && (
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block">特性列表</label>
                  {selectedBlock.items.map((item, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">项目 {idx + 1}</span>
                        <button onClick={() => { const newItems = selectedBlock.items!.filter((_, i) => i !== idx); updateBlock(selectedBlock.id, { items: newItems }) }} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <input type="text" value={item.icon || ''} onChange={(e) => { const newItems = [...selectedBlock.items!]; newItems[idx] = { ...newItems[idx], icon: e.target.value }; updateBlock(selectedBlock.id, { items: newItems }) }} placeholder="图标 emoji" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white outline-none focus:border-cyan-500" />
                      <input type="text" value={item.title} onChange={(e) => { const newItems = [...selectedBlock.items!]; newItems[idx] = { ...newItems[idx], title: e.target.value }; updateBlock(selectedBlock.id, { items: newItems }) }} placeholder="标题" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white outline-none focus:border-cyan-500" />
                      <textarea value={item.description} onChange={(e) => { const newItems = [...selectedBlock.items!]; newItems[idx] = { ...newItems[idx], description: e.target.value }; updateBlock(selectedBlock.id, { items: newItems }) }} placeholder="描述" rows={2} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white outline-none focus:border-cyan-500 resize-y" />
                      <input type="text" value={item.href || ''} onChange={(e) => { const newItems = [...selectedBlock.items!]; newItems[idx] = { ...newItems[idx], href: e.target.value }; updateBlock(selectedBlock.id, { items: newItems }) }} placeholder="链接 (可选)" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white outline-none focus:border-cyan-500" />
                    </div>
                  ))}
                  <button onClick={() => { const newItems = [...(selectedBlock.items || []), { icon: '✨', title: '新特性', description: '描述内容' }]; updateBlock(selectedBlock.id, { items: newItems }) }} className="w-full py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700">+ 添加项目</button>
                </div>
              )}

              {/* CTA button */}
              {selectedBlock.type === 'cta' && (
                <>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">按钮文字</label>
                    <input type="text" value={selectedBlock.button_text || ''} onChange={(e) => updateBlock(selectedBlock.id, { button_text: e.target.value })} className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">按钮链接</label>
                    <input type="text" value={selectedBlock.button_href || ''} onChange={(e) => updateBlock(selectedBlock.id, { button_href: e.target.value })} placeholder="https://..." className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500" />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <Layers className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">点击左侧区块进行编辑</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
