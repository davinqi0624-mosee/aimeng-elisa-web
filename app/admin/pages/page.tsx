'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Rnd } from 'react-rnd';
import {
  Plus, Edit3, Trash2, ChevronLeft, ChevronRight, ExternalLink,
  Layout, Search, FileText, Save, Eye, RotateCcw, ArrowLeft,
  Type, Image, Square, Link2, Heading1, Trash, GripVertical
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CanvasElement {
  id: string;
  type: 'text' | 'heading' | 'image' | 'button' | 'link';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  src?: string;
  link?: string;
  style?: Record<string, any>;
}

interface Page {
  id: string;
  slug: string;
  title: string;
  description?: string;
  blocks?: any;
  canvas_elements?: CanvasElement[];
  created_at?: string;
}

const DEFAULT_STYLES: Record<string, Partial<CanvasElement>> = {
  heading: { width: 300, height: 50, content: '标题文字', style: { fontSize: 28, fontWeight: '700', color: '#1e293b' } },
  text: { width: 250, height: 80, content: '正文内容...', style: { fontSize: 16, color: '#475569' } },
  image: { width: 200, height: 200, content: '', src: '', style: { borderRadius: 8 } },
  button: { width: 140, height: 44, content: '点击按钮', link: '#', style: { backgroundColor: '#3b82f6', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: '600' } },
  link: { width: 120, height: 36, content: '链接文字', link: '#', style: { fontSize: 14, color: '#3b82f6' } },
};

const PAGE_SIZE = 10;
const CANVAS_W = 900;
const CANVAS_H = 700;

interface OldBlock {
  id?: string;
  type: string;
  title?: string;
  content?: string;
  text?: string;
  image?: string;
  bg_color?: string;
  text_color?: string;
  align?: string;
  features?: any[];
  button_text?: string;
  button_link?: string;
  images?: any[];
  items?: any[];
  [key: string]: any;
}

function convertBlocksToCanvas(rawBlocks: any): CanvasElement[] {
  if (!rawBlocks) return [];
  const elements: CanvasElement[] = [];
  let currentY = 40;
  const genId = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  let blockArray: OldBlock[] = [];

  if (Array.isArray(rawBlocks)) {
    blockArray = rawBlocks;
  } else if (typeof rawBlocks === 'object') {
    Object.keys(rawBlocks).forEach((key) => {
      const val = rawBlocks[key];
      if (val === null || val === undefined) return;
      if (Array.isArray(val)) {
        val.forEach((item: any, i: number) => {
          blockArray.push({ id: `${key}_${i}`, type: key, ...item });
        });
      } else if (typeof val === 'object') {
        blockArray.push({ id: key, type: key, ...val });
      }
    });
  }

  if (blockArray.length === 0) return [];

  blockArray.forEach((b) => {
    const baseY = currentY;

    switch (b.type) {
      case 'hero': {
        elements.push({
          id: b.id || genId(), type: 'heading',
          x: 50, y: baseY, width: 800, height: 80,
          content: b.title || b.content || '标题',
          style: { fontSize: 36, fontWeight: '700', color: b.text_color || '#1e293b', textAlign: b.align || 'center' },
        });
        if (b.content && b.title) {
          elements.push({
            id: genId(), type: 'text',
            x: 100, y: baseY + 90, width: 700, height: 50,
            content: b.content,
            style: { fontSize: 18, color: b.text_color || '#475569', textAlign: b.align || 'center' },
          });
        }
        if (b.button_text || b.btn_text) {
          elements.push({
            id: genId(), type: 'button',
            x: 350, y: baseY + 150, width: 200, height: 50,
            content: b.button_text || b.btn_text || '点击', link: b.button_link || b.btn_link || '#',
            style: { backgroundColor: '#2563eb', color: '#ffffff', borderRadius: 8, fontSize: 16, fontWeight: '600' },
          });
        }
        currentY = baseY + 220;
        break;
      }

      case 'header': {
        elements.push({
          id: b.id || genId(), type: 'heading',
          x: 50, y: baseY, width: 800, height: 80,
          content: b.title || '标题',
          style: { fontSize: 32, fontWeight: '700', color: '#1e293b', textAlign: b.align || 'center' },
        });
        currentY = baseY + 100;
        break;
      }

      case 'text': {
        elements.push({
          id: b.id || genId(), type: 'text',
          x: 50, y: baseY, width: 800, height: 100,
          content: b.content || b.text || '',
          style: { fontSize: 16, color: '#475569', lineHeight: 1.6 },
        });
        currentY = baseY + 120;
        break;
      }

      case 'image_text': {
        if (b.image) {
          elements.push({ id: genId(), type: 'image', x: 50, y: baseY, width: 350, height: 250, content: '', src: b.image, style: { borderRadius: 8 } });
        }
        elements.push({
          id: b.id || genId(), type: 'text',
          x: b.image ? 430 : 50, y: baseY,
          width: b.image ? 420 : 800, height: 200,
          content: b.title || b.content || '图文内容',
          style: { fontSize: 16, color: '#475569', lineHeight: 1.6 },
        });
        currentY = baseY + 270;
        break;
      }

      case 'features': {
        const featItem = b;
        const colIndex = elements.filter(e => e.type === 'heading' && e.y >= baseY && e.y < baseY + 200).length;
        const colX = 50 + (colIndex % 3) * 280;
        const rowY = baseY + Math.floor(colIndex / 3) * 140;
        if (colIndex === 0) currentY = baseY;
        elements.push({
          id: genId(), type: 'heading',
          x: colX, y: rowY, width: 260, height: 30,
          content: featItem.title || featItem.icon || '特性',
          style: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
        });
        elements.push({
          id: genId(), type: 'text',
          x: colX, y: rowY + 35, width: 260, height: 80,
          content: featItem.desc || featItem.description || featItem.content || '',
          style: { fontSize: 14, color: '#475569' },
        });
        const totalFeats = blockArray.filter(x => x.type === 'features').length;
        currentY = baseY + Math.ceil(totalFeats / 3) * 140 + 20;
        break;
      }

      case 'cta': {
        elements.push({
          id: b.id || genId(), type: 'heading',
          x: 50, y: baseY, width: 800, height: 50,
          content: b.title || '行动号召',
          style: { fontSize: 24, fontWeight: '600', color: '#1e293b', textAlign: b.align || 'center' },
        });
        if (b.content) {
          elements.push({ id: genId(), type: 'text', x: 100, y: baseY + 60, width: 700, height: 40, content: b.content, style: { fontSize: 16, color: '#475569', textAlign: b.align || 'center' } });
        }
        if (b.button_text || b.btn_text) {
          elements.push({
            id: genId(), type: 'button',
            x: 350, y: baseY + 110, width: 200, height: 50,
            content: b.button_text || b.btn_text || '点击', link: b.button_link || b.btn_link || '#',
            style: { backgroundColor: b.bg_color || '#3b82f6', color: '#ffffff', borderRadius: 8, fontSize: 16, fontWeight: '600' },
          });
        }
        currentY = baseY + 180;
        break;
      }

      case 'gallery': {
        const imgs = b.images || (b.src ? [b.src] : []);
        imgs.forEach((img: any, i: number) => {
          elements.push({
            id: genId(), type: 'image',
            x: 50 + (i % 4) * 210, y: baseY + Math.floor(i / 4) * 160,
            width: 190, height: 140,
            content: '', src: typeof img === 'string' ? img : img.src || '',
            style: { borderRadius: 8 },
          });
        });
        currentY = baseY + Math.ceil(imgs.length / 4) * 160 + 20;
        break;
      }

      case 'testimonials': {
        if (b.title) {
          elements.push({ id: genId(), type: 'heading', x: 50, y: baseY, width: 800, height: 40, content: b.title, style: { fontSize: 22, fontWeight: '600', color: '#1e293b' } });
          currentY = baseY + 50;
        }
        const quoteText = b.text || b.content || '';
        const quoteAuthor = b.author || '';
        if (quoteText) {
          elements.push({
            id: genId(), type: 'text',
            x: 50, y: currentY, width: 800, height: 70,
            content: `"${quoteText}" ${quoteAuthor ? '— ' + quoteAuthor : ''}`,
            style: { fontSize: 14, color: '#475569', fontStyle: 'italic' },
          });
          currentY += 90;
        }
        break;
      }

      case 'faq': {
        const question = b.question || '';
        const answer = b.answer || '';
        if (question) {
          elements.push({
            id: genId(), type: 'heading',
            x: 50, y: currentY, width: 800, height: 28,
            content: question,
            style: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
          });
          currentY += 35;
        }
        if (answer) {
          elements.push({
            id: genId(), type: 'text',
            x: 50, y: currentY, width: 800, height: 50,
            content: answer,
            style: { fontSize: 14, color: '#475569' },
          });
          currentY += 70;
        }
        break;
      }

      case 'contact': {
        elements.push({
          id: b.id || genId(), type: 'heading',
          x: 50, y: baseY, width: 800, height: 40,
          content: b.title || '联系我们',
          style: { fontSize: 24, fontWeight: '600', color: '#1e293b' },
        });
        currentY = baseY + 60;
        break;
      }

      case 'footer': {
        elements.push({
          id: b.id || genId(), type: 'text',
          x: 50, y: baseY, width: 800, height: 40,
          content: b.copyright || b.content || b.text || '',
          style: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
        });
        currentY = baseY + 60;
        break;
      }

      default: {
        const content = b.content || b.text || b.title || '';
        if (content) {
          elements.push({
            id: b.id || genId(), type: 'text',
            x: 50, y: baseY, width: 800, height: 60,
            content,
            style: { fontSize: 14, color: '#475569' },
          });
        }
        currentY = baseY + 80;
      }
    }
  });

  return elements;
}
export default function AdminPagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [listPage, setListPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [createForm, setCreateForm] = useState({ slug: '', title: '', description: '' });
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('pages').select('*', { count: 'exact' });
    if (search) query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
    const { data, count } = await query.range(listPage * PAGE_SIZE, (listPage + 1) * PAGE_SIZE - 1).order('id');
    if (data) { setPages(data); setTotal(count || 0); }
    setLoading(false);
  }, [search, listPage]);

  useEffect(() => { if (mode === 'list') fetchPages(); }, [fetchPages, mode]);

  const genId = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

  const addElement = (type: CanvasElement['type']) => {
    const d = DEFAULT_STYLES[type];
    const newEl: CanvasElement = {
      id: genId(), type,
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: d.width || 200, height: d.height || 50,
      content: d.content || '', src: d.src, link: d.link, style: d.style || {},
    };
    setElements(prev => [...prev, newEl]);
    setSelectedId(newEl.id);
    setHasChanges(true);
  };

  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    setHasChanges(true);
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
    setHasChanges(true);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) setSelectedId(null);
  };

  const handleCreate = async () => {
    if (!createForm.slug || !createForm.title) { alert('请填写页面标识和标题'); return; }
    const { error } = await supabase.from('pages').insert({
      slug: createForm.slug, title: createForm.title,
      description: createForm.description, canvas_elements: [],
    });
    if (error) { alert('创建失败: ' + error.message); return; }
    setCreateForm({ slug: '', title: '', description: '' });
    setMode('list');
    fetchPages();
  };

  const openEditor = (page: Page) => {
    setEditingPage(page);
        alert('blocks数据:' + JSON.stringify(page.blocks).slice(0,300));
        alert('canvas_elements:' + JSON.stringify(page.canvas_elements).slice(0,300));
    let canvasData: CanvasElement[] = [];
    if (page.canvas_elements && Array.isArray(page.canvas_elements) && page.canvas_elements.length > 0) {
      canvasData = page.canvas_elements;
    } else if (page.blocks) {
      canvasData = convertBlocksToCanvas(page.blocks);
    }
    setElements(canvasData);
    setMode('edit');
    setHasChanges(false);
    setSelectedId(null);
  };

  const closeEditor = () => {
    if (hasChanges && !confirm('有未保存的更改，确定离开？')) return;
    setMode('list');
    setEditingPage(null);
    setElements([]);
    setSelectedId(null);
    setHasChanges(false);
    fetchPages();
  };

  const handleSave = async () => {
    if (!editingPage) return;
    setSaveStatus('saving');
    const { error } = await supabase.from('pages').update({ canvas_elements: elements }).eq('id', editingPage.id);
    if (error) { alert('保存失败: ' + error.message); setSaveStatus('idle'); return; }
    setSaveStatus('saved');
    setHasChanges(false);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleReset = () => {
    if (!confirm('确定恢复默认？所有更改将丢失！')) return;
    setElements([]);
    setSelectedId(null);
    setHasChanges(true);
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm('确定删除此页面？')) return;
    await supabase.from('pages').delete().eq('id', id);
    fetchPages();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !e.ctrlKey) {
      deleteElement(selectedId);
    }
  };

  const selectedEl = elements.find(el => el.id === selectedId);

  const renderEl = (el: CanvasElement) => {
    const s = el.style || {};
    switch (el.type) {
      case 'heading': return <h2 style={{ fontSize: s.fontSize||28, fontWeight: s.fontWeight||700, color: s.color||'#1e293b', padding: 8, lineHeight: 1.3, wordBreak: 'break-word' }}>{el.content}</h2>;
      case 'text': return <p style={{ fontSize: s.fontSize||16, color: s.color||'#475569', padding: 8, lineHeight: 1.6, wordBreak: 'break-word' }}>{el.content}</p>;
      case 'image': return el.src ? <img src={el.src} alt="" className="w-full h-full object-cover" style={{ borderRadius: s.borderRadius||0 }} /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm">点击设置图片</div>;
      case 'button': return <a href={el.link||'#'} className="w-full h-full flex items-center justify-center no-underline" style={{ backgroundColor: s.backgroundColor||'#3b82f6', color: s.color||'#fff', borderRadius: s.borderRadius||8, fontSize: s.fontSize||14, fontWeight: s.fontWeight||600 }} onClick={e=>{if(el.link==='#')e.preventDefault()}}>{el.content}</a>;
      case 'link': return <a href={el.link||'#'} className="w-full h-full flex items-center underline" style={{ color: s.color||'#3b82f6', fontSize: s.fontSize||14, padding: 8 }}>{el.content}</a>;
      default: return <div>{el.content}</div>;
    }
  };
    if (mode === 'edit' && editingPage) {
    return (
      <div className="h-screen flex flex-col bg-slate-50" onKeyDown={handleKeyDown} tabIndex={0}>
        {/* Top Toolbar */}
        <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={closeEditor} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-slate-800">{editingPage.title}</h1>
              <p className="text-xs text-slate-400">/{editingPage.slug}</p>
            </div>
            {hasChanges && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs">未保存</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(!showPreview)} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${showPreview ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {showPreview ? <><RotateCcw className="w-3.5 h-3.5" /> 编辑</> : <><Eye className="w-3.5 h-3.5" /> 预览</>}
            </button>
            <button onClick={handleReset} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-medium flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> 恢复默认
            </button>
            <button onClick={handleSave} disabled={saveStatus==='saving'} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saveStatus==='saving'?'保存中...':saveStatus==='saved'?'已保存!':'保存'}
            </button>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Components */}
          {!showPreview && (
            <div className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-700">添加组件</h2>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {[{t:'heading',l:'标题',i:Heading1,d:'大标题文字'},{t:'text',l:'正文',i:Type,d:'段落文字'},{t:'image',l:'图片',i:Image,d:'产品图片'},{t:'button',l:'按钮',i:Square,d:'可点击按钮'},{t:'link',l:'链接',i:Link2,d:'文字链接'}].map(({t,l,i:Icon,d})=> (
                  <button key={t} onClick={()=>addElement(t as any)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all group text-left">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{l}</p>
                      <p className="text-xs text-slate-400">{d}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-400 space-y-1">
                <p>🖱️ 拖拽移动位置</p>
                <p>↗️ 拖拽边角缩放</p>
                <p>⌫ 选中按Delete删除</p>
              </div>
            </div>
          )}

          {/* Center: Canvas */}
          <div className="flex-1 overflow-auto p-6 bg-slate-100">
            <div
              ref={canvasRef}
              className="relative bg-white rounded-xl shadow-sm border border-slate-200 mx-auto"
              style={{ width: CANVAS_W, height: CANVAS_H, backgroundImage: 'radial-gradient(circle,#e2e8f0 1px,transparent 1px)', backgroundSize: '20px 20px' }}
              onClick={handleCanvasClick}
            >
              <div className="absolute top-2 left-3 text-xs text-slate-400 select-none pointer-events-none">
                {CANVAS_W} x {CANVAS_H} px
              </div>
              {elements.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-slate-400">
                    <GripVertical className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{showPreview ? '页面为空' : '点击左侧组件添加到画布'}</p>
                  </div>
                </div>
              )}
              {elements.map(el => (
                <Rnd
                  key={el.id}
                  position={{x:el.x,y:el.y}}
                  size={{width:el.width,height:el.height}}
                  onDragStop={(_e,d)=>{updateElement(el.id,{x:d.x,y:d.y})}}
                  onResizeStop={(_e,_dir,ref,_d,pos)=>updateElement(el.id,{width:parseInt(ref.style.width),height:parseInt(ref.style.height),x:pos.x,y:pos.y})}
                  onClick={(e: any)=>{e.stopPropagation();setSelectedId(el.id);}}
                  bounds="parent"
                  disableDragging={showPreview}
                  enableResizing={!showPreview}
                  className={`${selectedId===el.id&&!showPreview?'ring-2 ring-blue-500':''}`}
                  style={{zIndex:selectedId===el.id?10:1}}
                >
                  <div className="w-full h-full overflow-hidden relative">
                    {renderEl(el)}
                    {!showPreview && selectedId===el.id && (
                      <button
                        onClick={(e)=>{e.stopPropagation();deleteElement(el.id);}}
                        className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 z-20"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </Rnd>
              ))}
            </div>
          </div>

          {/* Right: Properties */}
          {!showPreview && (
            <div className="w-64 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-auto">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-700">{selectedEl ? '元素属性' : '属性'}</h2>
              </div>
              {!selectedEl ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm text-center px-6">
                  点击画布上的元素<br/>选中后在此编辑
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Content */}
                  {selectedEl.type !== 'image' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        {selectedEl.type==='button'?'按钮文字':'文字内容'}
                      </label>
                      <textarea
                        value={selectedEl.content}
                        onChange={e=>updateElement(selectedEl.id,{content:e.target.value})}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-blue-500 resize-none"
                        rows={selectedEl.type==='text'?3:2}
                      />
                    </div>
                  )}
                  {/* Image URL */}
                  {selectedEl.type==='image' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">图片链接</label>
                      <input
                        type="text"
                        value={selectedEl.src||''}
                        onChange={e=>updateElement(selectedEl.id,{src:e.target.value})}
                        placeholder="https://..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                  {/* Link */}
                  {(selectedEl.type==='button'||selectedEl.type==='link') && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">跳转链接</label>
                      <input
                        type="text"
                        value={selectedEl.link||''}
                        onChange={e=>updateElement(selectedEl.id,{link:e.target.value})}
                        placeholder="https://..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                  {/* Position & Size */}
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">位置与大小</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['x','y','width','height'].map(k=> (
                        <div key={k}>
                          <label className="block text-xs text-slate-400 mb-0.5">
                            {k==='x'?'X':k==='y'?'Y':k==='width'?'宽':'高'}
                          </label>
                          <input
                            type="number"
                            value={Math.round((selectedEl as any)[k])}
                            onChange={e=>updateElement(selectedEl.id,{[k]:Number(e.target.value)})}
                            className="w-full px-2 py-1.5 rounded bg-slate-50 border border-slate-200 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Style */}
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">样式</p>
                    {selectedEl.type!=='image' && (
                      <div className="mb-3">
                        <label className="block text-xs text-slate-400 mb-1">文字颜色</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {['#1e293b','#475569','#3b82f6','#ef4444','#10b981','#f59e0b','#ffffff','#000000'].map(c=> (
                            <button
                              key={c}
                              onClick={()=>updateElement(selectedEl.id,{style:{...selectedEl.style,color:c}})}
                              className={`w-6 h-6 rounded-full border-2 ${(selectedEl.style?.color||'#1e293b')===c?'border-blue-500':'border-slate-200'}`}
                              style={{backgroundColor:c}}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedEl.type==='button' && (
                      <div className="mb-3">
                        <label className="block text-xs text-slate-400 mb-1">背景色</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#1e293b'].map(c=> (
                            <button
                              key={c}
                              onClick={()=>updateElement(selectedEl.id,{style:{...selectedEl.style,backgroundColor:c}})}
                              className={`w-6 h-6 rounded-full border-2 ${(selectedEl.style?.backgroundColor||'#3b82f6')===c?'border-blue-500':'border-slate-200'}`}
                              style={{backgroundColor:c}}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {(selectedEl.type==='button'||selectedEl.type==='image') && (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">圆角</label>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          value={selectedEl.style?.borderRadius||0}
                          onChange={e=>updateElement(selectedEl.id,{style:{...selectedEl.style,borderRadius:Number(e.target.value)}})}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
    if (mode === 'create') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
        <div className="max-w-lg mx-auto">
          <button onClick={()=>setMode('list')} className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white text-sm">
            <ChevronLeft className="w-4 h-4" /> 返回列表
          </button>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <h1 className="text-xl font-bold text-white mb-6">新建页面</h1>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  页面标识 <span className="text-slate-500">（URL路径，如 about-us）</span>
                </label>
                <input
                  value={createForm.slug}
                  onChange={e=>setCreateForm({...createForm,slug:e.target.value})}
                  placeholder="about-us"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">页面标题</label>
                <input
                  value={createForm.title}
                  onChange={e=>setCreateForm({...createForm,title:e.target.value})}
                  placeholder="关于我们"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">描述</label>
                <textarea
                  value={createForm.description}
                  onChange={e=>setCreateForm({...createForm,description:e.target.value})}
                  placeholder="页面描述（可选）"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="pt-2">
                <button
                  onClick={handleCreate}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                >
                  创建并进入编辑器
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Layout className="w-6 h-6 text-blue-400" /> 内页管理
            </h1>
            <p className="text-slate-400 text-sm mt-1">使用画布编辑器自由排版页面内容</p>
          </div>
          <button
            onClick={()=>setMode('create')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> 新建页面
          </button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e=>{setSearch(e.target.value);setListPage(0)}}
            placeholder="搜索页面..."
            className="w-full max-w-md pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">页面标题</th>
                <th className="px-4 py-3 text-left">标识</th>
                <th className="px-4 py-3 text-left">元素数</th>
                <th className="px-4 py-3 text-left">创建时间</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">加载中...</td>
                </tr>
              ) : pages.length===0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">暂无页面，点击"新建页面"创建</td>
                </tr>
              ) : (
                pages.map(p=> (
                  <tr key={p.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="text-white font-medium">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.slug}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs">
                        {(p.canvas_elements||[]).length} 个元素
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {p.created_at?new Date(p.created_at).toLocaleDateString('zh-CN'):'-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={()=>openEditor(p)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400 mr-1"
                        title="编辑画布"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <a
                        href={`/${p.slug}`}
                        target="_blank"
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-green-400 mr-1 inline-block"
                        title="预览"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={()=>handleDeletePage(p.id)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages>1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-slate-500">共 {total} 条，第 {listPage+1}/{totalPages} 页</span>
            <div className="flex gap-2">
              <button
                onClick={()=>setListPage(p=>Math.max(0,p-1))}
                disabled={listPage===0}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={()=>setListPage(p=>Math.min(totalPages-1,p+1))}
                disabled={listPage>=totalPages-1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 text-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}