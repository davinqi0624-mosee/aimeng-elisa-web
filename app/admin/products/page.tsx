'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Upload, FileText, X, Save, Plus, Search, Download,
  Image as ImageIcon, FileUp, ChevronLeft, ChevronRight,
  Trash2, Edit3, CheckCircle, AlertCircle
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Product {
  id: string;
  name: string;
  target: string;
  catalog_number?: string;
  species?: string;
  detection_range: string;
  sensitivity: string;
  price: number;
  price_48t?: number;
  price_96t?: number;
  stock_status: string;
  status: string;
  product_image?: string;
  standard_curve_image?: string;
  validation_image?: string;
  additional_image?: string;
  datasheet_pdf?: string;
}

const PAGE_SIZE = 10;

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 图片上传状态
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('products').select('*', { count: 'exact' });
    if (search) {
      query = query.or(`name.ilike.%${search}%,target.ilike.%${search}%`);
    }
    const { data, count, error } = await query
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .order('id');
    if (!error) {
      setProducts(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleImageUpload = async (file: File, type: 'product' | 'standard_curve' | 'validation' | 'additional') => {
    if (!editing) return;
    const key = `${type}_image`;
    setUploadingImages(prev => ({ ...prev, [key]: true }));

    const fileExt = file.name.split('.').pop();
    const fileName = `products/${editing.id}/${type}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-assets')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      alert('上传失败: ' + uploadError.message);
      setUploadingImages(prev => ({ ...prev, [key]: false }));
      return;
    }

    const { data } = supabase.storage.from('product-assets').getPublicUrl(fileName);
    setEditing(prev => prev ? { ...prev, [key]: data.publicUrl } : null);
    setUploadingImages(prev => ({ ...prev, [key]: false }));
  };

  const handlePdfUpload = async (file: File) => {
    if (!editing) return;
    setUploadingImages(prev => ({ ...prev, datasheet_pdf: true }));

    const fileName = `products/${editing.id}/datasheet_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('product-assets')
      .upload(fileName, file, { upsert: true, contentType: 'application/pdf' });

    if (uploadError) {
      alert('PDF上传失败: ' + uploadError.message);
      setUploadingImages(prev => ({ ...prev, datasheet_pdf: false }));
      return;
    }

    const { data } = supabase.storage.from('product-assets').getPublicUrl(fileName);
    setEditing(prev => prev ? { ...prev, datasheet_pdf: data.publicUrl } : null);
    setUploadingImages(prev => ({ ...prev, datasheet_pdf: false }));
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaveStatus('saving');
    const payload: any = {
      name: editing.name,
      target: editing.target,
      catalog_number: editing.catalog_number || null,
      species: editing.species || null,
      detection_range: editing.detection_range,
      sensitivity: editing.sensitivity,
      price: Number(editing.price),
      price_48t: editing.price_48t || null,
      price_96t: editing.price_96t || null,
      stock_status: editing.stock_status,
      status: editing.status,
      product_image: editing.product_image,
      standard_curve_image: editing.standard_curve_image,
      validation_image: editing.validation_image,
      additional_image: editing.additional_image,
      datasheet_pdf: editing.datasheet_pdf,
    };

    if (isCreating) {
      const { error } = await supabase.from('products').insert(payload);
      if (error) { setSaveStatus('error'); alert('创建失败: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) { setSaveStatus('error'); alert('保存失败: ' + error.message); return; }
    }

    setSaveStatus('saved');
    setTimeout(() => { setSaveStatus('idle'); setEditing(null); setIsCreating(false); fetchProducts(); }, 800);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此商品？')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  };

  const openCreate = () => {
    setEditing({
      id: '', name: '', target: '', catalog_number: '', species: '',
      detection_range: '', sensitivity: '',
      price: 0, price_48t: undefined, price_96t: undefined,
      stock_status: '有货', status: '上架',
    } as Product);
    setIsCreating(true);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-blue-400" />
              商品管理
            </h1>
            <p className="text-slate-400 text-sm mt-1">管理 ELISA 试剂盒：编辑信息、上传图片、导入批量数据</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowBulkImport(true)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" /> 批量导入
            </button>
            <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> 新增商品
            </button>
          </div>
        </div>

        {/* 搜索 */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="搜索商品名称或靶标..."
            className="w-full max-w-md pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 表格 */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">名称 / 靶标</th>
                <th className="px-4 py-3 text-left">检测范围</th>
                <th className="px-4 py-3 text-left">灵敏度</th>
                <th className="px-4 py-3 text-left">价格</th>
                <th className="px-4 py-3 text-left">图片</th>
                <th className="px-4 py-3 text-left">说明书</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">加载中...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">暂无商品</td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{p.name}</div>
                    <div className="text-slate-500 text-xs">{p.target}</div>
                    {p.catalog_number && <div className="text-blue-400 text-xs font-mono mt-0.5">货号：{p.catalog_number}</div>}
                    {p.species && <div className="text-emerald-400 text-xs mt-0.5">种属：{p.species}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.detection_range || '-'}</td>
                  <td className="px-4 py-3 text-slate-300">{p.sensitivity || '-'}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {p.price_48t || p.price_96t ? (
                      <div className="space-y-0.5">
                        {p.price_48t && <div className="text-xs"><span className="text-blue-400">48T</span> ¥{p.price_48t}</div>}
                        {p.price_96t && <div className="text-xs"><span className="text-emerald-400">96T</span> ¥{p.price_96t}</div>}
                      </div>
                    ) : (
                      <span>¥{p.price}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {p.product_image && <span className="w-2 h-2 rounded-full bg-green-400" title="产品图" />}
                      {p.standard_curve_image && <span className="w-2 h-2 rounded-full bg-blue-400" title="标准曲线" />}
                      {p.validation_image && <span className="w-2 h-2 rounded-full bg-purple-400" title="验证图" />}
                      {p.additional_image && <span className="w-2 h-2 rounded-full bg-yellow-400" title="其他图" />}
                      {!p.product_image && !p.standard_curve_image && !p.validation_image && !p.additional_image && (
                        <span className="text-slate-600 text-xs">无</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.datasheet_pdf ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400">
                        <FileText className="w-3 h-3" /> 已上传
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      p.status === '上架' ? 'bg-green-900/50 text-green-300' :
                      p.status === '草稿' ? 'bg-yellow-900/50 text-yellow-300' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditing(p); setIsCreating(false); }} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors mr-1">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-slate-500">共 {total} 条，第 {page + 1}/{totalPages} 页</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 text-sm">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 text-sm">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-4xl mx-4 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{isCreating ? '新增商品' : '编辑商品'}</h2>
              <button onClick={() => { setEditing(null); setIsCreating(false); }} className="p-1.5 rounded hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* 基础信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">商品名称</label>
                  <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">靶标</label>
                  <input value={editing.target} onChange={e => setEditing({ ...editing, target: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">货号</label>
                  <input value={editing.catalog_number || ''} onChange={e => setEditing({ ...editing, catalog_number: e.target.value })} placeholder="如 AU-IL6-M01" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">种属</label>
                  <input value={editing.species || ''} onChange={e => setEditing({ ...editing, species: e.target.value })} placeholder="如 小鼠、大鼠、人" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">检测范围</label>
                  <input value={editing.detection_range || ''} onChange={e => setEditing({ ...editing, detection_range: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">灵敏度</label>
                  <input value={editing.sensitivity || ''} onChange={e => setEditing({ ...editing, sensitivity: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">价格（兼容旧版单价格）</label>
                  <input type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">价格 48T</label>
                    <input type="number" value={editing.price_48t || ''} onChange={e => setEditing({ ...editing, price_48t: Number(e.target.value) || undefined })} placeholder="1800" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">价格 96T</label>
                    <input type="number" value={editing.price_96t || ''} onChange={e => setEditing({ ...editing, price_96t: Number(e.target.value) || undefined })} placeholder="2400" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">库存状态</label>
                    <select value={editing.stock_status} onChange={e => setEditing({ ...editing, stock_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500">
                      <option>有货</option><option>库存紧张</option><option>缺货</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">上架状态</label>
                    <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500">
                      <option>上架</option><option>草稿</option><option>归档</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 图片上传区域 */}
              <div className="border-t border-slate-700 pt-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-400" /> 产品图片（4张）
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { key: 'product_image', label: '产品照片', desc: '产品外观/包装图' },
                    { key: 'standard_curve_image', label: '标准曲线图', desc: '典型标准曲线' },
                    { key: 'validation_image', label: '测试验证图', desc: '验证数据/Western' },
                    { key: 'additional_image', label: '其他图片', desc: '补充说明图' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="border border-slate-700 rounded-lg p-3 bg-slate-800/50">
                      <p className="text-xs font-medium text-slate-300 mb-1">{label}</p>
                      <p className="text-[10px] text-slate-500 mb-2">{desc}</p>
                      {(editing as any)[key] ? (
                        <div className="relative">
                          <img src={(editing as any)[key]} alt={label} className="w-full h-20 object-cover rounded-lg" />
                          <button onClick={() => setEditing({ ...editing, [key]: undefined } as any)} className="absolute top-1 right-1 p-0.5 rounded bg-red-600 text-white">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                          <Upload className="w-5 h-5 text-slate-500 mb-1" />
                          <span className="text-[10px] text-slate-500">点击上传</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], key.replace('_image', '') as any)} />
                        </label>
                      )}
                      {uploadingImages[key] && <p className="text-[10px] text-blue-400 mt-1 text-center">上传中...</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* 说明书PDF上传 */}
              <div className="border-t border-slate-700 pt-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" /> 说明书 PDF
                </h3>
                {editing.datasheet_pdf ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <FileText className="w-8 h-8 text-red-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">说明书已上传</p>
                      <a href={editing.datasheet_pdf} target="_blank" className="text-xs text-blue-400 hover:underline">查看 PDF</a>
                    </div>
                    <button onClick={() => setEditing({ ...editing, datasheet_pdf: undefined })} className="p-1.5 rounded hover:bg-slate-700 text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-emerald-500 transition-colors">
                    <FileUp className="w-6 h-6 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-300">点击上传说明书 PDF</p>
                      <p className="text-xs text-slate-500">支持 PDF 格式，建议大小不超过 5MB</p>
                    </div>
                    <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])} />
                  </label>
                )}
                {uploadingImages['datasheet_pdf'] && <p className="text-xs text-blue-400 mt-2">PDF 上传中...</p>}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
              <button onClick={() => { setEditing(null); setIsCreating(false); }} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm">
                取消
              </button>
              <div className="flex items-center gap-3">
                {saveStatus === 'saved' && <span className="text-sm text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 已保存</span>}
                {saveStatus === 'error' && <span className="text-sm text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> 保存失败</span>}
                <button onClick={handleSave} disabled={saveStatus === 'saving'} className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                  <Save className="w-4 h-4" /> {saveStatus === 'saving' ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入弹窗 */}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onSuccess={fetchProducts} />}
    </div>
  );
}

/* ==================== 批量导入弹窗 ==================== */
function BulkImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const downloadTemplate = () => {
    const template = `name,target,catalog_number,species,detection_range,sensitivity,price,price_48t,price_96t,stock_status,status
Mouse IL-6 Elisa Kit,IL-6,AU-IL6-M01,小鼠,7.8-500 pg/mL,3.9 pg/mL,1800,1800,2400,有货,上架
Rat TNF-α Elisa Kit,TNF-α,AU-TNF-R01,大鼠,15.6-1000 pg/mL,7.8 pg/mL,1800,1800,2400,有货,上架
Human IFN-γ Elisa Kit,IFN-γ,AU-IFN-H01,人,3.12-200 pg/mL,1.56 pg/mL,2200,1800,2400,有货,上架`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'product_import_template.csv';
    link.click();
  };

  const handleImport = async () => {
    if (!csvText.trim()) { alert('请粘贴 CSV 数据'); return; }
    setImporting(true);
    setResult(null);

    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).filter(l => l.trim());

    const products = rows.map(row => {
      const cols = row.split(',');
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = cols[i]?.trim(); });
      obj.price = Number(obj.price) || 0;
      obj.price_48t = obj.price_48t ? Number(obj.price_48t) : null;
      obj.price_96t = obj.price_96t ? Number(obj.price_96t) : null;
      return obj;
    });

    const { data, error } = await supabase.from('products').insert(products).select();
    if (error) {
      setResult({ success: 0, failed: products.length, errors: [error.message] });
    } else {
      setResult({ success: data?.length || 0, failed: products.length - (data?.length || 0), errors: [] });
      onSuccess();
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-lg mx-4 shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">批量导入商品</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">支持 CSV 格式，首行必须为字段名</p>
            <button onClick={downloadTemplate} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> 下载模板
            </button>
          </div>
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={`name,target,catalog_number,species,detection_range,sensitivity,price,price_48t,price_96t,stock_status,status
Mouse IL-6 Elisa Kit,IL-6,AU-IL6-M01,小鼠,7.8-500 pg/mL,3.9 pg/mL,1800,1800,2400,有货,上架`}
            className="w-full h-48 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
          />
          {result && (
            <div className={`p-3 rounded-lg text-sm ${result.failed === 0 ? 'bg-green-900/30 text-green-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
              成功 {result.success} 条，失败 {result.failed} 条
              {result.errors.length > 0 && <div className="mt-1 text-red-400">{result.errors[0]}</div>}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm">取消</button>
          <button onClick={handleImport} disabled={importing} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50">
            {importing ? '导入中...' : '开始导入'}
          </button>
        </div>
      </div>
    </div>
  );
}