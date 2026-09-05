'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Rnd } from 'react-rnd';
import {
  App, Button, Form, Input, InputNumber, Modal, Popconfirm, Slider, Space, Table, Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, EditOutlined, ArrowLeftOutlined, EyeOutlined, UndoOutlined, SaveOutlined,
  DeleteOutlined, LayoutOutlined, SearchOutlined, FileOutlined, ExportOutlined,
  FontSizeOutlined, AlignLeftOutlined, PictureOutlined, BorderOutlined, LinkOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/admin/PageHeader';

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

const PALETTE: { t: CanvasElement['type']; l: string; i: typeof FontSizeOutlined; d: string }[] = [
  { t: 'heading', l: '标题', i: FontSizeOutlined, d: '大标题文字' },
  { t: 'text', l: '正文', i: AlignLeftOutlined, d: '段落文字' },
  { t: 'image', l: '图片', i: PictureOutlined, d: '产品图片' },
  { t: 'button', l: '按钮', i: BorderOutlined, d: '可点击按钮' },
  { t: 'link', l: '链接', i: LinkOutlined, d: '文字链接' },
];

const TEXT_COLORS = ['#1e293b', '#475569', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ffffff', '#000000'];
const BG_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#1e293b'];

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
  const { message, modal } = App.useApp();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [listPage, setListPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [createOpen, setCreateOpen] = useState(false);
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
    if (!createForm.slug || !createForm.title) { message.error('请填写页面标识和标题'); return; }
    const { error } = await supabase.from('pages').insert({
      slug: createForm.slug, title: createForm.title,
      description: createForm.description, canvas_elements: [],
    });
    if (error) { message.error('创建失败: ' + error.message); return; }
    setCreateForm({ slug: '', title: '', description: '' });
    setCreateOpen(false);
    fetchPages();
  };

  const openEditor = (page: Page) => {
    setEditingPage(page);
    message.info('blocks数据:' + JSON.stringify(page.blocks).slice(0, 300));
    message.info('canvas_elements:' + JSON.stringify(page.canvas_elements).slice(0, 300));
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
    const doClose = () => {
      setMode('list');
      setEditingPage(null);
      setElements([]);
      setSelectedId(null);
      setHasChanges(false);
      fetchPages();
    };
    if (hasChanges) {
      modal.confirm({
        title: '有未保存的更改，确定离开？',
        okText: '离开',
        cancelText: '取消',
        onOk: doClose,
      });
      return;
    }
    doClose();
  };

  const handleSave = async () => {
    if (!editingPage) return;
    setSaveStatus('saving');
    const { error } = await supabase.from('pages').update({ canvas_elements: elements }).eq('id', editingPage.id);
    if (error) { message.error('保存失败: ' + error.message); setSaveStatus('idle'); return; }
    setSaveStatus('saved');
    setHasChanges(false);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleReset = () => {
    setElements([]);
    setSelectedId(null);
    setHasChanges(true);
  };

  const handleDeletePage = async (id: string) => {
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
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={closeEditor} aria-label="返回列表" />
            <div>
              <h1 className="text-sm font-semibold text-slate-800">{editingPage.title}</h1>
              <p className="text-xs text-slate-400">/{editingPage.slug}</p>
            </div>
            {hasChanges && <Tag color="gold">未保存</Tag>}
          </div>
          <Space>
            <Button
              type={showPreview ? 'primary' : 'default'}
              icon={showPreview ? <UndoOutlined /> : <EyeOutlined />}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? '编辑' : '预览'}
            </Button>
            <Popconfirm title="确定恢复默认？所有更改将丢失！" okText="恢复" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={handleReset}>
              <Button icon={<UndoOutlined />}>恢复默认</Button>
            </Popconfirm>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存!' : '保存'}
            </Button>
          </Space>
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
                {PALETTE.map(({ t, l, i: Icon, d }) => (
                  <Button
                    key={t}
                    block
                    onClick={() => addElement(t)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, height: 'auto', padding: '10px 12px', textAlign: 'left' }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <Icon className="text-slate-500" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-700">{l}</span>
                      <span className="block text-xs text-slate-400">{d}</span>
                    </span>
                  </Button>
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
                    <HolderOutlined className="mx-auto mb-2 text-4xl opacity-30" />
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
                      <Button
                        type="primary"
                        danger
                        shape="circle"
                        size="small"
                        icon={<DeleteOutlined />}
                        className="absolute -top-3 -right-3 z-20"
                        onClick={(e)=>{e.stopPropagation();deleteElement(el.id);}}
                      />
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
                      <Input.TextArea
                        value={selectedEl.content}
                        onChange={e=>updateElement(selectedEl.id,{content:e.target.value})}
                        rows={selectedEl.type==='text'?3:2}
                      />
                    </div>
                  )}
                  {/* Image URL */}
                  {selectedEl.type==='image' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">图片链接</label>
                      <Input
                        value={selectedEl.src||''}
                        onChange={e=>updateElement(selectedEl.id,{src:e.target.value})}
                        placeholder="https://..."
                      />
                    </div>
                  )}
                  {/* Link */}
                  {(selectedEl.type==='button'||selectedEl.type==='link') && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">跳转链接</label>
                      <Input
                        value={selectedEl.link||''}
                        onChange={e=>updateElement(selectedEl.id,{link:e.target.value})}
                        placeholder="https://..."
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
                          <InputNumber
                            value={Math.round((selectedEl as any)[k])}
                            onChange={v=>updateElement(selectedEl.id,{[k]:v??0})}
                            className="w-full"
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
                          {TEXT_COLORS.map(c=> (
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
                          {BG_COLORS.map(c=> (
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
                        <Slider
                          min={0}
                          max={50}
                          value={selectedEl.style?.borderRadius||0}
                          onChange={v=>updateElement(selectedEl.id,{style:{...selectedEl.style,borderRadius:v}})}
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
  const columns: ColumnsType<Page> = [
    {
      title: '页面标题',
      dataIndex: 'title',
      key: 'title',
      render: (_, p) => (
        <span className="font-medium">
          <FileOutlined className="mr-2 text-slate-400" />
          {p.title}
        </span>
      ),
    },
    {
      title: '标识',
      dataIndex: 'slug',
      key: 'slug',
      render: (slug: string) => <code className="text-xs">{slug}</code>,
    },
    {
      title: '元素数',
      key: 'element_count',
      width: 110,
      render: (_, p) => <Tag>{(p.canvas_elements || []).length} 个元素</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v?: string) => (
        <span className="text-xs text-slate-500">{v ? new Date(v).toLocaleDateString('zh-CN') : '-'}</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, p) => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditor(p)} title="编辑画布" />
          <Button type="text" size="small" icon={<ExportOutlined />} href={`/${p.slug}`} target="_blank" title="预览" />
          <Popconfirm title="确定删除此页面？" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => handleDeletePage(p.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="删除" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        icon={<LayoutOutlined />}
        title="内页管理"
        description="使用画布编辑器自由排版页面内容"
        extra={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建页面
          </Button>
        )}
      />
      <Input
        value={search}
        onChange={e=>{setSearch(e.target.value);setListPage(0)}}
        placeholder="搜索页面..."
        prefix={<SearchOutlined />}
        allowClear
        className="mb-4 max-w-md"
      />
      <Table<Page>
        rowKey="id"
        columns={columns}
        dataSource={pages}
        loading={loading}
        locale={{ emptyText: '暂无页面，点击"新建页面"创建' }}
        pagination={{
          current: listPage + 1,
          pageSize: PAGE_SIZE,
          total,
          hideOnSinglePage: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p) => setListPage(p - 1),
        }}
      />

      <Modal
        open={createOpen}
        title="新建页面"
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setCreateOpen(false)}>取消</Button>,
          <Button key="create" type="primary" onClick={handleCreate}>创建页面</Button>,
        ]}
      >
        <Form layout="vertical" className="mt-2">
          <Form.Item
            label={
              <span>
                页面标识 <span className="font-normal text-slate-400">（URL路径，如 about-us）</span>
              </span>
            }
          >
            <Input
              value={createForm.slug}
              onChange={e=>setCreateForm({...createForm,slug:e.target.value})}
              placeholder="about-us"
            />
          </Form.Item>
          <Form.Item label="页面标题">
            <Input
              value={createForm.title}
              onChange={e=>setCreateForm({...createForm,title:e.target.value})}
              placeholder="关于我们"
            />
          </Form.Item>
          <Form.Item label="描述">
            <Input.TextArea
              value={createForm.description}
              onChange={e=>setCreateForm({...createForm,description:e.target.value})}
              placeholder="页面描述（可选）"
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
