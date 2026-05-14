'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Eye,
  Save,
  CheckCircle2,
  Type,
  Image,
  MousePointer,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Grid3X3,
  Monitor,
  Smartphone,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Layers,
} from 'lucide-react'

/* ─── Types ─── */
interface ElementStyle {
  top: number
  left: number
  width?: number
  height?: number
  fontSize?: number
  color?: string
  backgroundColor?: string
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textAlign?: 'left' | 'center' | 'right'
  borderRadius?: number
  padding?: number
}

interface VisualElement {
  id: string
  type: 'text' | 'image' | 'button'
  content?: string
  src?: string
  href?: string
  style: ElementStyle
}

interface PageItem {
  id: string
  slug: string
  title: string
  updated_at?: string
}

/* ─── Helpers ─── */
const uid = () => Math.random().toString(36).slice(2, 9)

const snap = (v: number, grid = 10) => Math.round(v / grid) * grid

const DEFAULT_ELEMENTS = (): VisualElement[] => [
  {
    id: uid(),
    type: 'text',
    content: '主标题文字',
    style: {
      top: 40,
      left: 40,
      fontSize: 36,
      color: '#0f172a',
      fontWeight: 'bold',
      textAlign: 'left',
    },
  },
  {
    id: uid(),
    type: 'text',
    content: '副标题描述文字，点击编辑内容...',
    style: {
      top: 100,
      left: 40,
      fontSize: 16,
      color: '#475569',
      textAlign: 'left',
    },
  },
  {
    id: uid(),
    type: 'button',
    content: '了解更多',
    href: '#',
    style: {
      top: 150,
      left: 40,
      width: 140,
      height: 44,
      fontSize: 15,
      color: '#ffffff',
      backgroundColor: '#2563eb',
      borderRadius: 8,
      textAlign: 'center',
      padding: 10,
    },
  },
]

function parseVisualContent(raw: any): VisualElement[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed?.version === 'visual-1' && Array.isArray(parsed.elements))
      return parsed.elements
  } catch {}
  return DEFAULT_ELEMENTS()
}

function buildVisualContent(elements: VisualElement[]) {
  return { version: 'visual-1', elements }
}

const pageLabel = (slug: string) => {
  const map: Record<string, string> = {
    '/': '首页',
    '/products': '产品',
    '/ai-chat': 'AI客服',
    '/knowledge': '每日知识',
    '/papers': '文献引用',
    '/points-mall': '积分商城',
    '/contact': '联系我们',
  }
  return map[slug] || slug
}

/* ─── Component ─── */
export default function PageEditor() {
  const params = useParams()
  const router = useRouter()
  const pageId = params.id as string

  const [page, setPage] = useState<PageItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [elements, setElements] = useState<VisualElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [canvasWidth, setCanvasWidth] = useState(900)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    origTop: number
    origLeft: number
  } | null>(null)
  const resizeRef = useRef<{
    id: string
    handle: string
    startX: number
    startY: number
    origWidth: number
    origHeight: number
    origTop: number
    origLeft: number
  } | null>(null)

  const elementsRef = useRef(elements)
  elementsRef.current = elements

  /* Load page by ID */
  useEffect(() => {
    fetch('/api/admin/pages')
      .then((r) => r.json())
      .then((d: { pages?: PageItem[] }) => {
        const list = d.pages || []
        const found = list.find((p) => p.id === pageId)
        if (found) {
          setPage(found)
          fetch(`/api/admin/pages?slug=${found.slug}`)
            .then((r) => r.json())
            .then((sd: { pages?: any[] }) => {
              const p = (sd.pages || [])[0]
              setElements(parseVisualContent(p?.blocks))
              setLoading(false)
            })
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [pageId])

  /* Selection */
  const deselect = () => {
    setSelectedId(null)
    setEditingId(null)
  }

  /* CRUD elements */
  const addElement = (type: VisualElement['type']) => {
    const count = elementsRef.current.length
    let el: VisualElement
    if (type === 'image') {
      el = {
        id: uid(),
        type,
        src: '',
        style: {
          top: snap(60 + count * 20),
          left: snap(60 + count * 20),
          width: 200,
          height: 150,
        },
      }
    } else if (type === 'button') {
      el = {
        id: uid(),
        type,
        content: '按钮文字',
        href: '#',
        style: {
          top: snap(60 + count * 20),
          left: snap(60 + count * 20),
          width: 120,
          height: 40,
          fontSize: 14,
          color: '#fff',
          backgroundColor: '#2563eb',
          borderRadius: 6,
          textAlign: 'center',
        },
      }
    } else {
      el = {
        id: uid(),
        type,
        content: '双击编辑文字',
        style: {
          top: snap(60 + count * 20),
          left: snap(60 + count * 20),
          fontSize: 16,
          color: '#334155',
          textAlign: 'left',
        },
      }
    }
    setElements((prev) => [...prev, el])
    setSelectedId(el.id)
  }

  const removeElement = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const duplicateElement = (id: string) => {
    const el = elementsRef.current.find((e) => e.id === id)
    if (!el) return
    const copy: VisualElement = {
      ...el,
      id: uid(),
      style: {
        ...el.style,
        top: snap(el.style.top + 20),
        left: snap(el.style.left + 20),
      },
    }
    setElements((prev) => [...prev, copy])
    setSelectedId(copy.id)
  }

  const moveElement = (index: number, dir: number) => {
    const newIndex = index + dir
    if (newIndex < 0 || newIndex >= elementsRef.current.length) return
    const next = [...elementsRef.current]
    const [moved] = next.splice(index, 1)
    next.splice(newIndex, 0, moved)
    setElements(next)
  }

  const updateElement = (
    id: string,
    patch: Partial<VisualElement> | { style: Partial<ElementStyle> }
  ) => {
    setElements((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        if ('style' in patch) return { ...e, style: { ...e.style, ...patch.style } }
        return { ...e, ...patch }
      })
    )
  }

  /* Drag */
  const onElementMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.resize-handle')) return
    e.stopPropagation()
    const el = elementsRef.current.find((x) => x.id === id)
    if (!el) return
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origTop: el.style.top,
      origLeft: el.style.left,
    }
    setSelectedId(id)
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const { id, startX, startY, origTop, origLeft } = dragRef.current
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        updateElement(id, {
          style: {
            top: snap(Math.max(0, origTop + dy)),
            left: snap(Math.max(0, origLeft + dx)),
          },
        })
      }
      if (resizeRef.current) {
        const {
          id,
          handle,
          startX,
          startY,
          origWidth = 100,
          origHeight = 100,
          origTop,
          origLeft,
        } = resizeRef.current
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        const updates: Partial<ElementStyle> = {}
        if (handle.includes('e')) updates.width = snap(Math.max(20, origWidth + dx))
        if (handle.includes('s')) updates.height = snap(Math.max(20, origHeight + dy))
        if (handle.includes('w')) {
          const newW = snap(Math.max(20, origWidth - dx))
          updates.width = newW
          updates.left = origLeft + (origWidth - newW)
        }
        if (handle.includes('n')) {
          const newH = snap(Math.max(20, origHeight - dy))
          updates.height = newH
          updates.top = origTop + (origHeight - newH)
        }
        updateElement(id, { style: updates })
      }
    }
    const onUp = () => {
      dragRef.current = null
      resizeRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Resize */
  const onResizeMouseDown = (
    e: React.MouseEvent,
    id: string,
    handle: string
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const el = elementsRef.current.find((x) => x.id === id)
    if (!el) return
    resizeRef.current = {
      id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origWidth: el.style.width || 100,
      origHeight: el.style.height || 100,
      origTop: el.style.top,
      origLeft: el.style.left,
    }
  }

  /* Inline text edit */
  const startEditing = (id: string) => {
    const el = elementsRef.current.find((e) => e.id === id)
    if (!el || el.type !== 'text') return
    setEditingId(id)
    setSelectedId(id)
  }

  const onTextBlur = (e: React.FocusEvent<HTMLDivElement>, id: string) => {
    updateElement(id, { content: e.currentTarget.innerText })
    setEditingId(null)
  }

  /* Image upload */
  const triggerUpload = (id: string) => {
    setSelectedId(id)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', 'product-assets')
    formData.append('path', `pages/${Date.now()}_${file.name}`)
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.url) updateElement(selectedId, { src: data.url })
    } catch {}
    e.target.value = ''
  }

  /* Save */
  const handleSave = async () => {
    if (!page) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: page.id,
          blocks: buildVisualContent(elementsRef.current),
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  /* Derived */
  const selectedEl = elements.find((e) => e.id === selectedId)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-4">
        <Layers className="w-10 h-10 opacity-50" />
        <p>页面不存在</p>
        <Link
          href="/admin/pages"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-sm hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 返回内页列表
        </Link>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/pages"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            返回内页列表
          </Link>
          <div className="w-px h-5 bg-slate-700" />
          <Monitor className="w-5 h-5 text-cyan-400" />
          <h1 className="text-white font-bold text-sm">
            {pageLabel(page.slug)}
          </h1>
          <span className="text-xs text-slate-500">
            {page.updated_at
              ? new Date(page.updated_at).toLocaleString('zh-CN')
              : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-lg transition-colors ${
              showGrid
                ? 'bg-slate-800 text-cyan-400'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="显示网格"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCanvasWidth(900)}
            className={`p-2 rounded-lg transition-colors ${
              canvasWidth === 900
                ? 'bg-slate-800 text-cyan-400'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="桌面视图"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCanvasWidth(375)}
            className={`p-2 rounded-lg transition-colors ${
              canvasWidth === 375
                ? 'bg-slate-800 text-cyan-400'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="手机视图"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-700 mx-1" />
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-200 rounded-lg text-sm hover:bg-slate-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            {previewMode ? '编辑' : '预览'}
          </button>
          {saved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 已保存
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-14 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 gap-2">
          <button
            onClick={() => addElement('text')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="添加文字"
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => addElement('image')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="添加图片"
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            onClick={() => addElement('button')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="添加按钮"
          >
            <MousePointer className="w-4 h-4" />
          </button>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 bg-slate-950 overflow-auto flex justify-center p-6">
          <div
            className="relative bg-white shadow-2xl transition-all"
            style={{ width: canvasWidth, minHeight: 600 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) deselect()
            }}
          >
            {/* Grid */}
            {showGrid && !previewMode && (
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.06]"
                style={{
                  backgroundImage:
                    'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                  backgroundSize: '10px 10px',
                }}
              />
            )}

            {/* Elements */}
            {elements.map((el) => {
              const isSelected = selectedId === el.id
              const isEditing = editingId === el.id

              const baseStyle: React.CSSProperties = {
                position: 'absolute',
                top: el.style.top,
                left: el.style.left,
                width: el.style.width,
                height: el.style.height,
                fontSize: el.style.fontSize,
                color: el.style.color,
                backgroundColor: el.style.backgroundColor,
                fontWeight: el.style.fontWeight,
                fontStyle: el.style.fontStyle,
                textAlign: el.style.textAlign,
                borderRadius: el.style.borderRadius,
                padding: el.style.padding,
                cursor: isEditing ? 'text' : 'move',
                userSelect: isEditing ? 'text' : 'none',
                outline: 'none',
                overflow: 'hidden',
              }

              return (
                <div
                  key={el.id}
                  style={baseStyle}
                  className={`${
                    isSelected && !previewMode
                      ? 'ring-2 ring-blue-500 ring-offset-1'
                      : ''
                  } ${el.type === 'button' ? 'flex items-center justify-center' : ''}`}
                  onMouseDown={(e) =>
                    !previewMode && onElementMouseDown(e, el.id)
                  }
                  onDoubleClick={() =>
                    !previewMode && startEditing(el.id)
                  }
                >
                  {el.type === 'text' && (
                    <div
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      onBlur={(e) => onTextBlur(e, el.id)}
                      className="w-full h-full outline-none whitespace-pre-wrap"
                    >
                      {el.content}
                    </div>
                  )}
                  {el.type === 'image' &&
                    (el.src ? (
                      <img
                        src={el.src}
                        alt=""
                        className="w-full h-full object-cover pointer-events-none"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400">
                        <Image className="w-8 h-8" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerUpload(el.id)
                          }}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          上传图片
                        </button>
                      </div>
                    ))}
                  {el.type === 'button' && (
                    <span className="pointer-events-none">
                      {el.content}
                    </span>
                  )}

                  {/* Resize handles */}
                  {isSelected && !previewMode && (
                    <>
                      <div
                        className="resize-handle absolute -top-1 -left-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full cursor-nw-resize z-10"
                        onMouseDown={(e) =>
                          onResizeMouseDown(e, el.id, 'nw')
                        }
                      />
                      <div
                        className="resize-handle absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full cursor-n-resize z-10"
                        onMouseDown={(e) =>
                          onResizeMouseDown(e, el.id, 'n')
                        }
                      />
                      <div
                        className="resize-handle absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full cursor-ne-resize z-10"
                        onMouseDown={(e) =>
                          onResizeMouseDown(e, el.id, 'ne')
                        }
                      />
                      <div
                        className="resize-handle absolute top-1/2 -left-1 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full cursor-w-resize z-10"
                        onMouseDown={(e) =>
                          onResizeMouseDown(e, el.id, 'w')
                        }
                      />
                      <div
                        className="resize-handle absolute top-1/2 -right-1 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full cursor-e-resize z-10"
                        onMouseDown={(e) =>
                          onResizeMouseDown(e, el.id, 'e')
                        }
                      />
                      <div
                        className="resize-handle absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full cursor-sw-resize z-10"
                        onMouseDown={(e) =>
                          onResizeMouseDown(e, el.id, 'sw')
                        }
                      />
                      <div
                        className="resize-handle absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full cursor-s-resize z-10"
                        onMouseDown={(e) =>
                          onResizeMouseDown(e, el.id, 's')
                        }
                      />
                      <div
                        className="resize-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white rounded-full cursor-se-resize z-10"
                        onMouseDown={(e) =>
                          onResizeMouseDown(e, el.id, 'se')
                        }
                      />
                    </>
                  )}
                </div>
              )
            })}

            {elements.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                <div className="text-center">
                  <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>点击左侧工具栏添加元素</p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Property Panel */}
        {!previewMode && (
          <aside className="w-60 shrink-0 bg-slate-900 border-l border-slate-800 overflow-y-auto">
            {selectedEl ? (
              <div className="p-4 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">属性</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => duplicateElement(selectedEl.id)}
                      className="p-1.5 text-slate-400 hover:text-white rounded"
                      title="复制"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeElement(selectedEl.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                {(selectedEl.type === 'text' ||
                  selectedEl.type === 'button') && (
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                      内容
                    </label>
                    <textarea
                      value={selectedEl.content || ''}
                      onChange={(e) =>
                        updateElement(selectedEl.id, {
                          content: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500 resize-y"
                    />
                  </div>
                )}

                {selectedEl.type === 'image' && (
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                      图片
                    </label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={selectedEl.src || ''}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            src: e.target.value,
                          })
                        }
                        placeholder="图片 URL"
                        className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={() => triggerUpload(selectedEl.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" /> 上传图片
                      </button>
                    </div>
                  </div>
                )}

                {selectedEl.type === 'button' && (
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                      链接
                    </label>
                    <input
                      type="text"
                      value={selectedEl.href || ''}
                      onChange={(e) =>
                        updateElement(selectedEl.id, {
                          href: e.target.value,
                        })
                      }
                      placeholder="https://..."
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                {/* Position & Size */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                    位置与尺寸
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500">X</span>
                      <input
                        type="number"
                        value={selectedEl.style.left}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            style: {
                              left: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Y</span>
                      <input
                        type="number"
                        value={selectedEl.style.top}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            style: {
                              top: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">宽</span>
                      <input
                        type="number"
                        value={selectedEl.style.width || ''}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            style: {
                              width: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            },
                          })
                        }
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">高</span>
                      <input
                        type="number"
                        value={selectedEl.style.height || ''}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            style: {
                              height: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            },
                          })
                        }
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Typography */}
                {(selectedEl.type === 'text' ||
                  selectedEl.type === 'button') && (
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                      文字样式
                    </label>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] text-slate-500">
                          字号 {selectedEl.style.fontSize}px
                        </span>
                        <input
                          type="range"
                          min={10}
                          max={72}
                          value={selectedEl.style.fontSize || 16}
                          onChange={(e) =>
                            updateElement(selectedEl.id, {
                              style: {
                                fontSize: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full accent-cyan-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">
                          颜色
                        </span>
                        <input
                          type="color"
                          value={selectedEl.style.color || '#000000'}
                          onChange={(e) =>
                            updateElement(selectedEl.id, {
                              style: { color: e.target.value },
                            })
                          }
                          className="w-8 h-8 rounded border-0 p-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-xs text-slate-400 font-mono">
                          {selectedEl.style.color}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updateElement(selectedEl.id, {
                              style: {
                                fontWeight:
                                  selectedEl.style.fontWeight === 'bold'
                                    ? 'normal'
                                    : 'bold',
                              },
                            })
                          }
                          className={`p-2 rounded ${
                            selectedEl.style.fontWeight === 'bold'
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            updateElement(selectedEl.id, {
                              style: {
                                fontStyle:
                                  selectedEl.style.fontStyle === 'italic'
                                    ? 'normal'
                                    : 'italic',
                              },
                            })
                          }
                          className={`p-2 rounded ${
                            selectedEl.style.fontStyle === 'italic'
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updateElement(selectedEl.id, {
                              style: { textAlign: 'left' },
                            })
                          }
                          className={`p-2 rounded ${
                            selectedEl.style.textAlign === 'left' ||
                            !selectedEl.style.textAlign
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            updateElement(selectedEl.id, {
                              style: { textAlign: 'center' },
                            })
                          }
                          className={`p-2 rounded ${
                            selectedEl.style.textAlign === 'center'
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            updateElement(selectedEl.id, {
                              style: { textAlign: 'right' },
                            })
                          }
                          className={`p-2 rounded ${
                            selectedEl.style.textAlign === 'right'
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <AlignRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Background */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                    背景
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={
                        selectedEl.style.backgroundColor || '#ffffff'
                      }
                      onChange={(e) =>
                        updateElement(selectedEl.id, {
                          style: {
                            backgroundColor: e.target.value,
                          },
                        })
                      }
                      className="w-8 h-8 rounded border-0 p-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 font-mono">
                      {selectedEl.style.backgroundColor || '透明'}
                    </span>
                  </div>
                </div>

                {/* Border Radius */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                    圆角 {selectedEl.style.borderRadius || 0}px
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={selectedEl.style.borderRadius || 0}
                    onChange={(e) =>
                      updateElement(selectedEl.id, {
                        style: {
                          borderRadius: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-cyan-500"
                  />
                </div>

                {/* Padding */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                    内边距 {selectedEl.style.padding || 0}px
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={selectedEl.style.padding || 0}
                    onChange={(e) =>
                      updateElement(selectedEl.id, {
                        style: {
                          padding: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-cyan-500"
                  />
                </div>

                {/* Layer order */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                    层级
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        moveElement(
                          elements.findIndex(
                            (e) => e.id === selectedEl.id
                          ),
                          -1
                        )
                      }
                      className="p-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                      title="前移"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        moveElement(
                          elements.findIndex(
                            (e) => e.id === selectedEl.id
                          ),
                          1
                        )
                      }
                      className="p-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                      title="后移"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <MousePointer className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">点击画布中的元素进行编辑</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
