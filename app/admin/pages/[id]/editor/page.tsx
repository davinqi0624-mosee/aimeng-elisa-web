'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Segmented,
  Space,
  Spin,
  Tag,
} from 'antd'
import {
  EyeOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  DeleteOutlined,
  CopyOutlined,
  GlobalOutlined,
  FontSizeOutlined,
  AlignLeftOutlined,
  PictureOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  PlusOutlined,
} from '@ant-design/icons'

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
  { type: 'hero', label: 'Hero', icon: <FontSizeOutlined />, desc: '大标题横幅' },
  { type: 'text', label: '文本', icon: <AlignLeftOutlined />, desc: '文字段落' },
  { type: 'image', label: '图片', icon: <PictureOutlined />, desc: '图片展示' },
  { type: 'features', label: '特性', icon: <AppstoreOutlined />, desc: '功能卡片' },
  { type: 'cta', label: 'CTA', icon: <ThunderboltOutlined />, desc: '行动号召' },
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
  const { message } = App.useApp()
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
      message.error('保存失败: ' + error.message)
    } else {
      setSaved(true)
      setIframeKey((k) => k + 1)
      setTimeout(() => setSaved(false), 1500)
    }
  }, [blocks, pageId, supabase, message])

  const handlePublish = useCallback(async () => {
    const next = !isPublished
    const { error } = await supabase
      .from('pages')
      .update({ is_published: next, updated_at: new Date().toISOString() })
      .eq('id', pageId)
    if (error) {
      message.error(next ? '发布失败' : '撤回失败')
    } else {
      setIsPublished(next)
      setSaved(true)
      setIframeKey((k) => k + 1)
      setTimeout(() => setSaved(false), 1500)
    }
  }, [isPublished, pageId, supabase, message])

  const handleRestore = useCallback(async () => {
    setBlocks([])
    setSelectedId(null)
    const { error } = await supabase
      .from('pages')
      .update({ blocks: [], is_published: false, updated_at: new Date().toISOString() })
      .eq('id', pageId)
    if (error) {
      message.error('恢复失败: ' + error.message)
    } else {
      setIsPublished(false)
      setSaved(true)
      setIframeKey((k) => k + 1)
      setTimeout(() => setSaved(false), 1500)
    }
  }, [pageId, supabase, message])

  const previewUrl = pageId === 'home' ? '/' : slug || `/${pageId}`

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/admin/pages" className="text-sm flex items-center gap-1 text-slate-500 hover:text-slate-900">
            <ArrowLeftOutlined /> 返回
          </Link>
          <div className="w-px h-5 bg-slate-200" />
          <GlobalOutlined className="text-slate-500" />
          <h1 className="font-semibold text-sm text-slate-900">{pageLabel[pageId] || pageId}</h1>
          {isPublished ? <Tag color="green">已发布</Tag> : <Tag color="gold">草稿</Tag>}
        </div>
        <Space>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircleOutlined />已保存
            </span>
          )}
          <Button icon={<EyeOutlined />} onClick={() => setIframeKey((k) => k + 1)}>
            预览
          </Button>
          <Button type={isPublished ? 'default' : 'primary'} onClick={handlePublish}>
            {isPublished ? '撤回' : '发布'}
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {saving ? '保存中' : '保存'}
          </Button>
          <Popconfirm
            title="确定恢复默认？所有区块将被清空。"
            okText="恢复"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={handleRestore}
          >
            <Button danger>恢复默认</Button>
          </Popconfirm>
        </Space>
      </div>

      {legacyWarn && (
        <Alert
          className="shrink-0"
          type="warning"
          showIcon
          banner
          message="此页面使用旧版编辑器格式，已清空内容。请重新添加区块。"
          closable
          onClose={() => setLegacyWarn(false)}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-3">添加区块</h3>
            <div className="grid grid-cols-1 gap-2">
              {BLOCK_TYPES.map((t) => (
                <Button
                  key={t.type}
                  block
                  onClick={() => addBlock(t.type)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, height: 'auto', padding: '10px 12px', textAlign: 'left' }}
                >
                  <span className="text-slate-400">{t.icon}</span>
                  <span>
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block text-xs text-slate-400">{t.desc}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-3">区块列表 ({blocks.length})</h3>
            {blocks.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-xs">暂无区块，点击上方添加</span>} />
            ) : (
              <div className="space-y-2">
                {blocks.map((b, i) => {
                  const meta = BLOCK_TYPES.find((t) => t.type === b.type)
                  const active = selectedId === b.id
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedId(b.id)}
                      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${active ? 'bg-sky-50 border-sky-300' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                    >
                      <span className="text-slate-400">{meta?.icon}</span>
                      <span className="text-sm truncate flex-1">{meta?.label}{b.title ? ` — ${b.title}` : ''}</span>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="text" size="small" icon={<CaretUpOutlined />} disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveBlock(i, -1) }} />
                        <Button type="text" size="small" icon={<CaretDownOutlined />} disabled={i === blocks.length - 1} onClick={(e) => { e.stopPropagation(); moveBlock(i, 1) }} />
                        <Button type="text" size="small" icon={<CopyOutlined />} onClick={(e) => { e.stopPropagation(); duplicateBlock(b.id) }} />
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); removeBlock(b.id) }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Center Iframe */}
        <main className="flex-1 bg-slate-100 overflow-hidden flex justify-center p-4">
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
        <aside className="w-72 shrink-0 bg-white border-l border-slate-200 overflow-y-auto">
          {selectedBlock ? (
            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{BLOCK_TYPES.find((t) => t.type === selectedBlock.type)?.label} 属性</h3>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeBlock(selectedBlock.id)} />
              </div>

              {/* Title */}
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">标题</label>
                <Input value={selectedBlock.title || ''} onChange={(e) => updateBlock(selectedBlock.id, { title: e.target.value })} />
              </div>

              {/* Content */}
              {(selectedBlock.type === 'hero' || selectedBlock.type === 'text' || selectedBlock.type === 'features' || selectedBlock.type === 'cta') && (
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">内容</label>
                  <Input.TextArea value={selectedBlock.content || ''} onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })} rows={4} />
                </div>
              )}

              {/* Hero colors */}
              {selectedBlock.type === 'hero' && (
                <>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">背景颜色</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={selectedBlock.bg_color || '#0f172a'} onChange={(e) => updateBlock(selectedBlock.id, { bg_color: e.target.value })} className="w-8 h-8 rounded border border-slate-300 p-0 bg-transparent cursor-pointer" />
                      <span className="text-xs text-slate-400 font-mono">{selectedBlock.bg_color || '#0f172a'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">文字颜色</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={selectedBlock.text_color || '#ffffff'} onChange={(e) => updateBlock(selectedBlock.id, { text_color: e.target.value })} className="w-8 h-8 rounded border border-slate-300 p-0 bg-transparent cursor-pointer" />
                      <span className="text-xs text-slate-400 font-mono">{selectedBlock.text_color || '#ffffff'}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Text align */}
              {selectedBlock.type === 'text' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">对齐</label>
                  <Segmented
                    block
                    options={['left', 'center', 'right']}
                    value={selectedBlock.align}
                    onChange={(v) => updateBlock(selectedBlock.id, { align: v as Block['align'] })}
                  />
                </div>
              )}

              {/* Image */}
              {selectedBlock.type === 'image' && (
                <>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">图片 URL</label>
                    <Input value={selectedBlock.src || ''} onChange={(e) => updateBlock(selectedBlock.id, { src: e.target.value })} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">替代文字</label>
                    <Input value={selectedBlock.alt || ''} onChange={(e) => updateBlock(selectedBlock.id, { alt: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">说明</label>
                    <Input value={selectedBlock.caption || ''} onChange={(e) => updateBlock(selectedBlock.id, { caption: e.target.value })} />
                  </div>
                </>
              )}

              {/* Features items */}
              {selectedBlock.type === 'features' && selectedBlock.items && (
                <div className="space-y-3">
                  <label className="text-xs text-slate-500 block">特性列表</label>
                  {selectedBlock.items.map((item, idx) => (
                    <Card key={idx} size="small">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">项目 {idx + 1}</span>
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => { const newItems = selectedBlock.items!.filter((_, i) => i !== idx); updateBlock(selectedBlock.id, { items: newItems }) }} />
                      </div>
                      <div className="space-y-2">
                        <Input value={item.icon || ''} onChange={(e) => { const newItems = [...selectedBlock.items!]; newItems[idx] = { ...newItems[idx], icon: e.target.value }; updateBlock(selectedBlock.id, { items: newItems }) }} placeholder="图标 emoji" />
                        <Input value={item.title} onChange={(e) => { const newItems = [...selectedBlock.items!]; newItems[idx] = { ...newItems[idx], title: e.target.value }; updateBlock(selectedBlock.id, { items: newItems }) }} placeholder="标题" />
                        <Input.TextArea value={item.description} onChange={(e) => { const newItems = [...selectedBlock.items!]; newItems[idx] = { ...newItems[idx], description: e.target.value }; updateBlock(selectedBlock.id, { items: newItems }) }} placeholder="描述" rows={2} />
                        <Input value={item.href || ''} onChange={(e) => { const newItems = [...selectedBlock.items!]; newItems[idx] = { ...newItems[idx], href: e.target.value }; updateBlock(selectedBlock.id, { items: newItems }) }} placeholder="链接 (可选)" />
                      </div>
                    </Card>
                  ))}
                  <Button block icon={<PlusOutlined />} onClick={() => { const newItems = [...(selectedBlock.items || []), { icon: '✨', title: '新特性', description: '描述内容' }]; updateBlock(selectedBlock.id, { items: newItems }) }}>
                    添加项目
                  </Button>
                </div>
              )}

              {/* CTA button */}
              {selectedBlock.type === 'cta' && (
                <>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">按钮文字</label>
                    <Input value={selectedBlock.button_text || ''} onChange={(e) => updateBlock(selectedBlock.id, { button_text: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">按钮链接</label>
                    <Input value={selectedBlock.button_href || ''} onChange={(e) => updateBlock(selectedBlock.id, { button_href: e.target.value })} placeholder="https://..." />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-8">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击左侧区块进行编辑" />
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
