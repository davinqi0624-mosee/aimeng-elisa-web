'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, FileText, X, Save, Plus, Search, Download,
  Image as ImageIcon, FileUp, ChevronLeft, ChevronRight,
  Trash2, Edit3, CheckCircle, AlertCircle, FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { generateExcelTemplate } from '@/lib/xlsx-images';
import { normalizeElisaCatalogNumber } from '@/lib/products/catalog';

interface Product {
  id: string;
  name: string;
  target: string;
  catalog_number?: string;
  species?: string;
  description?: string;
  detection_method?: string;
  assay_time?: string;
  platform?: string;
  sample_types_text?: string;
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
type ProductImageField = 'product_image' | 'standard_curve_image' | 'validation_image' | 'additional_image';
type ProductUploadType = 'product' | 'standard_curve' | 'validation' | 'additional';
type UploadStatusKey = ProductImageField | 'datasheet_pdf';
type AdminApiError = {
  error?: string;
  requireConfirm?: boolean;
};

type CatalogResetSummary = {
  active_products: number;
  archived_products: number;
  product_images: number;
  active_documents: number;
};

const PRODUCT_IMAGE_SLOTS: Array<{
  field: ProductImageField;
  uploadType: ProductUploadType;
  label: string;
  desc: string;
}> = [
  { field: 'product_image', uploadType: 'product', label: '产品照片', desc: '产品外观/包装图' },
  { field: 'standard_curve_image', uploadType: 'standard_curve', label: '标准曲线图', desc: '典型标准曲线' },
  { field: 'validation_image', uploadType: 'validation', label: '测试验证图', desc: '验证数据/Western' },
  { field: 'additional_image', uploadType: 'additional', label: '其他图片', desc: '补充说明图' },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  return fallback;
}

function displayStatus(status?: string) {
  const normalized = (status || '').trim();
  if (normalized === 'active' || normalized === '上架') return '上架';
  if (normalized === 'draft' || normalized === '草稿') return '草稿';
  if (normalized === 'archived' || normalized === '归档') return '归档';
  return normalized || '-';
}

function statusBadgeClass(status?: string) {
  const normalized = (status || '').trim();
  if (normalized === 'active' || normalized === '上架') return 'bg-green-900/50 text-green-300';
  if (normalized === 'draft' || normalized === '草稿') return 'bg-yellow-900/50 text-yellow-300';
  return 'bg-slate-800 text-slate-400';
}

function isSignificantPriceChange(oldPrice?: number, nextPrice?: number) {
  const oldValue = Number(oldPrice);
  const nextValue = Number(nextPrice);
  if (!Number.isFinite(oldValue) || !Number.isFinite(nextValue)) return false;
  if (oldValue <= 0) return nextValue > 0;
  return Math.abs(nextValue - oldValue) / oldValue > 0.2;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showCatalogReset, setShowCatalogReset] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadError, setLoadError] = useState('');
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // 图片上传状态
  const [uploadingImages, setUploadingImages] = useState<Partial<Record<UploadStatusKey, boolean>>>({});
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);

  const loadProducts = useCallback(async (queryPage: number, querySearch: string) => {
    const params = new URLSearchParams({
      page: String(queryPage),
      pageSize: String(PAGE_SIZE),
    });
    if (querySearch.trim()) params.set('search', querySearch.trim());
    const response = await fetch(`/api/admin/products?${params.toString()}`);
    const result = await response.json().catch(() => ({} as { error?: string; products?: Product[]; total?: number }));
    if (!response.ok) {
      throw new Error(result.error || '未知错误');
    }
    return {
      products: result.products || [],
      total: result.total || 0,
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { products: nextProducts, total: nextTotal } = await loadProducts(page, search);
      setProducts(nextProducts);
      setTotal(nextTotal);
    } catch (error: unknown) {
      const message = getErrorMessage(error, '网络错误');
      setLoadError('加载商品失败: ' + message);
      alert('加载商品失败: ' + message);
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [loadProducts, page, search]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const { products: nextProducts, total: nextTotal } = await loadProducts(page, search);
        if (!active) return;
        setProducts(nextProducts);
        setTotal(nextTotal);
      } catch (error: unknown) {
        if (!active) return;
        setLoadError('加载商品失败: ' + getErrorMessage(error, '网络错误'));
        setProducts([]);
        setTotal(0);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadProducts, page, search]);

  const handleImageUpload = async (file: File, type: 'product' | 'standard_curve' | 'validation' | 'additional') => {
    if (!editing) return;
    if (isCreating || !editing.id) {
      alert('请先保存商品，再上传图片。这样文件会归档到对应商品目录，避免进入临时目录后难以追溯。');
      return;
    }
    const key = `${type}_image` as ProductImageField;

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件，支持 JPG、PNG、WebP 等图片格式');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('图片不能超过 8MB，请压缩后再上传');
      return;
    }

    setUploadingImages(prev => ({ ...prev, [key]: true }));
    const fileExt = file.name.split('.').pop() || 'jpg';
    const owner = editing.id;
    const safeFileName = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'image';
    const body = new FormData();
    body.append('file', file);
    body.append('bucket', 'product-assets');
    body.append('path', `products/${owner}/${type}_${safeFileName}.${fileExt}`);
    const oldUrl = editing[key];
    if (oldUrl) body.append('old_url', oldUrl);

    try {
      const response = await fetch('/api/admin/upload', { method: 'POST', body });
      const result = await response.json().catch(() => ({} as AdminApiError & { url?: string }));
      if (!response.ok) {
        alert('上传失败: ' + (result.error || '未知错误'));
        return;
      }

      setEditing(prev => prev ? ({ ...prev, [key]: result.url } as Product) : null);
    } catch (error: unknown) {
      alert('上传失败: ' + getErrorMessage(error, '网络错误'));
    } finally {
      setUploadingImages(prev => ({ ...prev, [key]: false }));
    }
  };

  const validatePdfFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('说明书只能上传 PDF 文件');
      return false;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('PDF 不能超过 20MB，请压缩后再上传');
      return false;
    }
    return true;
  };

  const uploadPdfForProduct = async (file: File, productId: string, oldUrl?: string) => {
    const body = new FormData();
    body.append('file', file);
    body.append('bucket', 'product-assets');
    body.append('path', `products/${productId}/datasheet_${Date.now()}.pdf`);
    if (oldUrl) body.append('old_url', oldUrl);

    const response = await fetch('/api/admin/upload', { method: 'POST', body });
    const result = await response.json().catch(() => ({} as AdminApiError & { url?: string }));
    if (!response.ok || !result.url) {
      throw new Error(result.error || 'PDF上传失败');
    }
    return result.url;
  };

  const handlePdfUpload = async (file: File) => {
    if (!editing) return;
    if (!validatePdfFile(file)) return;
    if (isCreating || !editing.id) {
      setPendingPdfFile(file);
      return;
    }

    setUploadingImages(prev => ({ ...prev, datasheet_pdf: true }));

    try {
      const url = await uploadPdfForProduct(file, editing.id, editing.datasheet_pdf);
      setEditing(prev => prev ? { ...prev, datasheet_pdf: url } : null);
    } catch (error: unknown) {
      alert('PDF上传失败: ' + getErrorMessage(error, '网络错误'));
    } finally {
      setUploadingImages(prev => ({ ...prev, datasheet_pdf: false }));
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const target = editing.target.trim();
    const catalogNumber = editing.catalog_number?.trim() || '';
    if (!name || !target || !catalogNumber) {
      setSaveStatus('error');
      alert('请填写商品名称、靶标和货号。货号是说明书、COA 和批量文件匹配的核心字段。');
      return;
    }
    const originalProduct = isCreating ? null : products.find((product) => product.id === editing.id);
    if (
      originalProduct &&
      isSignificantPriceChange(originalProduct.price, Number(editing.price)) &&
      !confirm(`价格从 ¥${originalProduct.price} 调整为 ¥${Number(editing.price)}，变动超过 20%。请确认这是有意修改后再保存。`)
    ) {
      return;
    }
    setSaveStatus('saving');
    const payload = {
      name,
      target,
      catalog_number: catalogNumber,
      species: editing.species || null,
      description: editing.description || null,
      detection_method: editing.detection_method || null,
      assay_time: editing.assay_time || null,
      platform: editing.platform || null,
      sample_types_text: editing.sample_types_text || null,
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

    let response: Response;
    try {
      response = await fetch('/api/admin/products', {
        method: isCreating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCreating ? payload : { id: editing.id, ...payload }),
      });
    } catch (error: unknown) {
      setSaveStatus('error');
      alert((isCreating ? '创建失败: ' : '保存失败: ') + getErrorMessage(error, '网络连接失败，请稍后重试'));
      return;
    }

    let responseData: { id?: string; message?: string } = {};
    if (!response.ok) {
      const error = await response.json().catch(() => ({} as AdminApiError));
      setSaveStatus('error');
      if (error.requireConfirm) {
        alert('保存失败：价格变动超过 20%，当前账号无权直接保存。请让超级管理员复核价格后再提交。');
        return;
      }
      alert((isCreating ? '创建失败: ' : '保存失败: ') + (error.error || '未知错误'));
      return;
    }

    responseData = await response.json().catch(() => ({}));

    const createdProductId = isCreating ? responseData.id : editing.id;
    if (pendingPdfFile && createdProductId) {
      setUploadingImages(prev => ({ ...prev, datasheet_pdf: true }));
      try {
        const pdfUrl = await uploadPdfForProduct(pendingPdfFile, createdProductId, editing.datasheet_pdf);
        const pdfResponse = await fetch('/api/admin/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: createdProductId, datasheet_pdf: pdfUrl }),
        });
        if (!pdfResponse.ok) {
          const error = await pdfResponse.json().catch(() => ({} as AdminApiError));
          throw new Error(error.error || '说明书地址写回失败');
        }
        setPendingPdfFile(null);
      } catch (error: unknown) {
        setSaveStatus('error');
        alert(`商品已保存，但说明书 PDF 上传或绑定失败：${getErrorMessage(error, '未知错误')}。请进入该商品编辑页重新上传说明书。`);
        setUploadingImages(prev => ({ ...prev, datasheet_pdf: false }));
        return;
      } finally {
        setUploadingImages(prev => ({ ...prev, datasheet_pdf: false }));
      }
    }

    setSaveStatus('saved');
    setTimeout(() => { setSaveStatus('idle'); setEditing(null); setIsCreating(false); setPendingPdfFile(null); fetchProducts(); }, 800);
  };

  const handleDelete = async (product: Product) => {
    const label = product.catalog_number ? `${product.name}（货号：${product.catalog_number}）` : product.name;
    if (!confirm(`确定删除商品「${label}」？\n\n删除后前台将无法访问该商品，相关图片和说明书链接也会失去商品归属。`)) return;
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      alert('删除失败: ' + (error.error || '未知错误'));
      return;
    }
    fetchProducts();
  };

  const openCreate = () => {
    setSaveStatus('idle');
    setUploadingImages({});
    setPendingPdfFile(null);
    setEditing({
      id: '', name: '', target: '', catalog_number: '', species: '',
      description: '', detection_method: '双抗夹心法 (Sandwich ELISA)', assay_time: '4h', platform: 'ELISA', sample_types_text: '血清、血浆、细胞培养上清、组织匀浆',
      detection_range: '', sensitivity: '',
      price: 0, price_48t: undefined, price_96t: undefined,
      stock_status: 'in_stock', status: 'active',
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
            <button onClick={() => setShowCatalogReset(true)} className="px-4 py-2 rounded-lg border border-amber-500/50 text-amber-200 hover:bg-amber-500/10 text-sm font-medium transition-colors flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> 归档旧目录
            </button>
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

        {loadError && (
          <div className="mb-4 rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {loadError}
          </div>
        )}

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
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(p.status)}`}>
                      {displayStatus(p.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setSaveStatus('idle'); setUploadingImages({}); setPendingPdfFile(null); setEditing({ ...p, status: normalizePublishStatus(p.status), stock_status: normalizeStockStatus(p.stock_status) }); setIsCreating(false); }} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors mr-1">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors">
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
              <button onClick={() => { setEditing(null); setIsCreating(false); setPendingPdfFile(null); }} className="p-1.5 rounded hover:bg-slate-800 text-slate-400">
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
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">检测方法</label>
                  <input value={editing.detection_method || ''} onChange={e => setEditing({ ...editing, detection_method: e.target.value })} placeholder="双抗夹心法 (Sandwich ELISA)" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">检测平台</label>
                  <input value={editing.platform || ''} onChange={e => setEditing({ ...editing, platform: e.target.value })} placeholder="ELISA" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">操作时长</label>
                  <input value={editing.assay_time || ''} onChange={e => setEditing({ ...editing, assay_time: e.target.value })} placeholder="4h" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">样本类型</label>
                  <input value={editing.sample_types_text || ''} onChange={e => setEditing({ ...editing, sample_types_text: e.target.value })} placeholder="血清、血浆、细胞培养上清、组织匀浆" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">产品介绍</label>
                  <textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={4} placeholder="用于前台商品详情页展示，可填写产品特点、适用场景、检测原理摘要等。" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-y" />
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
                      <option value="in_stock">有货</option>
                      <option value="low_stock">库存紧张</option>
                      <option value="out_of_stock">缺货</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">上架状态</label>
                    <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500">
                      <option value="active">上架</option>
                      <option value="draft">草稿</option>
                      <option value="archived">归档</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 图片上传区域 */}
              <div className="border-t border-slate-700 pt-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-400" /> 产品图片（4张）
                </h3>
                {isCreating && (
                  <div className="mb-3 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                    请先保存商品，再上传图片。保存后文件会进入该商品专属目录，避免批量维护时归错商品。
                  </div>
                )}
                <div className="grid grid-cols-4 gap-3">
                  {PRODUCT_IMAGE_SLOTS.map(({ field, uploadType, label, desc }) => (
                    <div key={field} className="border border-slate-700 rounded-lg p-3 bg-slate-800/50">
                      <p className="text-xs font-medium text-slate-300 mb-1">{label}</p>
                      <p className="text-[10px] text-slate-500 mb-2">{desc}</p>
                      {editing[field] ? (
                        <div className="relative">
                          <div className="relative w-full h-20 overflow-hidden rounded-lg">
                            <Image src={editing[field] as string} alt={label} fill className="object-cover" unoptimized />
                          </div>
                          <button onClick={() => setEditing({ ...editing, [field]: undefined })} className="absolute top-1 right-1 p-0.5 rounded bg-red-600 text-white">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-600 rounded-lg transition-colors ${isCreating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-500'}`}>
                          <Upload className="w-5 h-5 text-slate-500 mb-1" />
                          <span className="text-[10px] text-slate-500">{isCreating ? '保存后上传' : '点击上传'}</span>
                          <input type="file" accept="image/*" disabled={isCreating} className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], uploadType)} />
                        </label>
                      )}
                      {uploadingImages[field] && <p className="text-[10px] text-blue-400 mt-1 text-center">上传中...</p>}
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
                ) : pendingPdfFile ? (
                  <div className="flex items-center gap-3 p-3 bg-emerald-950/20 rounded-lg border border-emerald-700/50">
                    <FileText className="w-8 h-8 text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">已选择：{pendingPdfFile.name}</p>
                      <p className="text-xs text-emerald-300">点击保存后会自动创建商品并上传说明书</p>
                    </div>
                    <button onClick={() => setPendingPdfFile(null)} className="p-1.5 rounded hover:bg-slate-700 text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 p-4 border-2 border-dashed border-emerald-700/60 bg-emerald-950/10 rounded-lg">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileUp className="w-6 h-6 text-emerald-400" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-100">{isCreating ? '可先选择说明书 PDF，保存时自动上传' : '上传或更换说明书 PDF'}</p>
                        <p className="text-xs text-slate-500">支持 PDF 格式，最大 20MB；建议控制在 5MB 内</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      选择 PDF
                    </button>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handlePdfUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                )}
                {uploadingImages['datasheet_pdf'] && <p className="text-xs text-blue-400 mt-2">PDF 上传中...</p>}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
              <button onClick={() => { setEditing(null); setIsCreating(false); setPendingPdfFile(null); }} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm">
                取消
              </button>
              <div className="flex items-center gap-3">
                {saveStatus === 'saved' && <span className="text-sm text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 已保存</span>}
                {saveStatus === 'error' && <span className="text-sm text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> 保存失败</span>}
                <button onClick={handleSave} disabled={saveStatus === 'saving'} className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                  <Save className="w-4 h-4" /> {saveStatus === 'saving' ? (pendingPdfFile ? '保存并上传中...' : '保存中...') : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入弹窗 */}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onSuccess={fetchProducts} />}
      {showCatalogReset && <CatalogResetModal onClose={() => setShowCatalogReset(false)} onSuccess={fetchProducts} />}
    </div>
  );
}

function CatalogResetModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [summary, setSummary] = useState<CatalogResetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/products/catalog-reset');
      const data = await res.json().catch(() => ({} as { summary?: CatalogResetSummary; error?: string; errors?: string[] }));
      if (!res.ok || data.error) throw new Error(data.error || '产品目录预检失败');
      setSummary(data.summary || null);
      if (data.errors?.length) setError(data.errors.join('；'));
    } catch (err: unknown) {
      setError(getErrorMessage(err, '产品目录预检失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 弹窗打开后需要加载当前目录统计。
    loadSummary();
  }, [loadSummary]);

  const archiveCatalog = async () => {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/products/catalog-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', confirm_text: confirmText }),
      });
      const data = await res.json().catch(() => ({} as { message?: string; error?: string }));
      if (!res.ok || data.error) throw new Error(data.error || '归档失败');
      setMessage(data.message || '旧产品目录已归档');
      onSuccess();
      await loadSummary();
    } catch (err: unknown) {
      setError(getErrorMessage(err, '归档失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">归档旧产品目录</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            这个操作会把当前所有上架产品归档，并释放旧货号和旧页面地址，方便你重新批量上传干净的产品目录。它不会删除客户、订单、积分、商城，也不会删除图片/PDF文件本身。
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">预检中...</div>
          ) : summary ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-slate-500">当前上架产品</div>
                <div className="mt-1 text-2xl font-semibold text-white">{summary.active_products}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-slate-500">已归档产品</div>
                <div className="mt-1 text-2xl font-semibold text-slate-300">{summary.archived_products}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-slate-500">产品图片绑定</div>
                <div className="mt-1 text-2xl font-semibold text-cyan-300">{summary.product_images}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-slate-500">生效产品文档</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-300">{summary.active_documents}</div>
              </div>
            </div>
          ) : null}

          {error && <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>}
          {message && <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">{message}</div>}

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">确认文字</span>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="请输入：归档旧产品目录"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600"
            />
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-700 flex justify-between gap-3">
          <button onClick={loadSummary} disabled={loading} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm disabled:opacity-50">
            重新预检
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm">取消</button>
            <button
              onClick={archiveCatalog}
              disabled={submitting || confirmText !== '归档旧产品目录'}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              归档并释放旧货号
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== 批量导入弹窗 ==================== */
type ImportProduct = {
  name: string;
  target: string;
  catalog_number?: string;
  species?: string;
  description?: string;
  detection_method?: string;
  assay_time?: string;
  platform?: string;
  sample_types_text?: string;
  detection_range?: string;
  sensitivity?: string;
  size?: string;
  price: number;
  price_48t?: number | null;
  price_96t?: number | null;
  stock_status: string;
  status: string;
};

type ParsedImportRow = ImportProduct & {
  rowNumber: number;
  errors: string[];
};

const HEADER_ALIASES: Record<keyof ImportProduct, string[]> = {
  name: ['name', 'product_name', '产品名称', '商品名称', '名称', '产品名称productname'],
  target: ['target', 'indicator', '指标', '靶标', '检测指标', '指标名称', '指标名称target'],
  catalog_number: ['catalog_number', 'cat_no', 'catno', '货号', '产品货号', 'catalog', '货号catno'],
  species: ['species', '种属', '适用种属', '种属species'],
  description: ['description', '产品介绍', '商品介绍', '简介', '内容介绍', '中文简介'],
  detection_method: ['detection_method', 'test_method', '检测方法', '测试方法', '实验方法', '方法学', 'method', '测试方法testmethod'],
  assay_time: ['assay_time', '操作时长', '检测时间', '反应时间', '实验时间', 'assay time', '操作时长assaytime', '检测时间assaytime'],
  platform: ['platform', '检测平台', '平台', '技术平台'],
  sample_types_text: ['sample_types_text', 'sample_type', '样本类型', '样本', '适用样本', '样本类型sampletypestext'],
  detection_range: ['detection_range', 'range', '检测范围', '线性范围', '检测范围detectionrange'],
  sensitivity: ['sensitivity', '灵敏度', '最低检测限', '灵敏度sensitivity'],
  size: ['size', '规格'],
  price: ['price', '价格', '默认价格'],
  price_48t: ['price_48t', '48t_price', '48T价格', '48T', '48t'],
  price_96t: ['price_96t', '96t_price', '96T价格', '96T', '96t'],
  stock_status: ['stock_status', '库存状态', '库存', '库存stockstatus'],
  status: ['status', '上架状态', '状态', '状态status'],
};

function normalizeHeaderText(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[().（）\[\]【】{}_\-\s./]+/g, '')
}

function getCell(row: Record<string, unknown>, key: keyof ImportProduct) {
  const aliases = HEADER_ALIASES[key].map(normalizeHeaderText);
  const matchedKey = Object.keys(row).find((header) => {
    const normalizedHeader = normalizeHeaderText(header)
    return aliases.some((alias) => normalizedHeader === alias)
  });
  return matchedKey ? String(row[matchedKey] ?? '').trim() : '';
}

function normalizeStockStatus(value: string) {
  const text = value.trim().toLowerCase();
  if (!text || text === '有货' || text === '现货' || text === 'in_stock' || text === 'instock') return 'in_stock';
  if (text === '库存紧张' || text === '少量' || text === 'low_stock') return 'low_stock';
  if (text === '缺货' || text === '无货' || text === 'out_of_stock') return 'out_of_stock';
  return text;
}

function normalizePublishStatus(value: string) {
  const text = value.trim().toLowerCase();
  if (!text || text === '上架' || text === '已上架' || text === 'active') return 'active';
  if (text === '草稿' || text === 'draft') return 'draft';
  if (text === '归档' || text === '下架' || text === 'archived' || text === 'inactive') return 'archived';
  return text;
}

function BulkImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const downloadTemplate = () => {
    generateExcelTemplate();
  };

  const parseFile = async (file: File) => {
    setSelectedFile(file);
    setParsedRows([]);
    setResult(null);
    setParseError('');
    setParsing(true);

    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        setParseError('文件格式不支持。请上传 .xlsx、.xls 或 .csv 文件。');
        return;
      }

      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', raw: false });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });

      const parsed = rows.map((row, index) => {
        const item: ParsedImportRow = {
          rowNumber: index + 2,
          name: getCell(row, 'name'),
          target: getCell(row, 'target'),
          catalog_number: normalizeElisaCatalogNumber(getCell(row, 'catalog_number')) || undefined,
          species: getCell(row, 'species') || undefined,
          description: getCell(row, 'description') || undefined,
          detection_method: getCell(row, 'detection_method') || undefined,
          assay_time: getCell(row, 'assay_time') || undefined,
          platform: getCell(row, 'platform') || 'ELISA',
          sample_types_text: getCell(row, 'sample_types_text') || undefined,
          detection_range: getCell(row, 'detection_range') || undefined,
          sensitivity: getCell(row, 'sensitivity') || undefined,
          size: '48T / 96T',
          price: 2400,
          price_48t: 1800,
          price_96t: 2400,
          stock_status: normalizeStockStatus(getCell(row, 'stock_status')),
          status: normalizePublishStatus(getCell(row, 'status')),
          errors: [],
        };

        if (!item.name) item.errors.push('缺少产品名称');
        if (!item.target) item.errors.push('缺少指标/靶标');
        if (!item.catalog_number) item.errors.push('缺少货号，货号是批量匹配说明书和 COA 的核心字段');
        return item;
      }).filter((row) => row.name || row.target || row.catalog_number);

      if (parsed.length === 0) {
        setParseError('没有解析到产品数据。请确认第一行是字段名，第二行开始填写产品。');
        return;
      }
      const seenCatalogs = new Map<string, number>();
      for (const row of parsed) {
        const catalog = normalizeElisaCatalogNumber(row.catalog_number);
        if (!catalog) continue;
        const firstRow = seenCatalogs.get(catalog);
        if (firstRow) {
          row.errors.push(`货号与第 ${firstRow} 行重复`);
        } else {
          seenCatalogs.set(catalog, row.rowNumber);
        }
      }
      setParsedRows(parsed);
    } catch (error: unknown) {
      setParseError(getErrorMessage(error, '文件解析失败，请检查模板格式。'));
    } finally {
      setParsing(false);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) parseFile(file);
  };

  const validRows = parsedRows.filter((row) => row.errors.length === 0);
  const invalidRows = parsedRows.filter((row) => row.errors.length > 0);

  const handleImport = async () => {
    if (!selectedFile) { alert('请先选择 Excel 或 CSV 文件'); return; }
    if (validRows.length === 0) { alert('没有可导入的数据，请先修正红色错误行'); return; }
    setImporting(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/products/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: validRows }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResult({ success: 0, failed: validRows.length, errors: [data.error || '导入失败'] });
        return;
      }

      setResult({
        success: data.success || 0,
        failed: (data.failed || 0) + invalidRows.length,
        errors: [...(data.errors || []), ...invalidRows.slice(0, 5).map((row) => `第 ${row.rowNumber} 行：${row.errors.join('、')}`)],
      });
      onSuccess();
    } catch (error: unknown) {
      setResult({ success: 0, failed: validRows.length, errors: [getErrorMessage(error, '导入失败')] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-4xl shadow-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">批量导入商品</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto [-webkit-overflow-scrolling:touch]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm text-slate-300">支持 Excel / CSV。推荐先下载模板，填好后直接拖进来。</p>
              <p className="text-xs text-slate-500 mt-1">模板只放产品文字信息；图片在“产品图片”上传，说明书在“产品文档”上传。</p>
            </div>
            <button onClick={downloadTemplate} className="px-3 py-2 rounded-lg border border-blue-500/40 bg-blue-500/10 text-sm text-blue-300 hover:bg-blue-500/20 flex items-center gap-2">
              <Download className="w-4 h-4" /> 下载 Excel 模板
            </button>
          </div>

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) parseFile(file);
            }}
            className="rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/50 p-8 text-center hover:border-blue-500 transition-colors"
          >
            <FileSpreadsheet className="w-10 h-10 text-blue-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-white">把 Excel / CSV 文件拖到这里</p>
            <p className="text-xs text-slate-500 mt-1">或点击下方按钮选择文件，不需要粘贴电脑里的文件路径</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> 选择文件
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
          </div>

          {selectedFile && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-slate-300 flex items-center justify-between gap-3">
              <span className="truncate">已选择：{selectedFile.name}</span>
              {parsing && <span className="text-blue-300 inline-flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> 解析中</span>}
            </div>
          )}

          {parseError && (
            <div className="p-3 rounded-lg bg-red-900/30 text-red-300 text-sm border border-red-800/60">
              {parseError}
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-slate-800 border border-slate-700 p-3">
                  <p className="text-slate-500 text-xs">解析总数</p>
                  <p className="text-white text-xl font-semibold mt-1">{parsedRows.length}</p>
                </div>
                <div className="rounded-lg bg-green-900/20 border border-green-800/60 p-3">
                  <p className="text-green-400 text-xs">可导入</p>
                  <p className="text-green-200 text-xl font-semibold mt-1">{validRows.length}</p>
                </div>
                <div className="rounded-lg bg-red-900/20 border border-red-800/60 p-3">
                  <p className="text-red-400 text-xs">需修正</p>
                  <p className="text-red-200 text-xl font-semibold mt-1">{invalidRows.length}</p>
                </div>
              </div>

              {invalidRows.length > 0 && (
                <div className="rounded-xl border border-red-800/70 bg-red-950/20 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-red-900/70 bg-red-950/50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-red-200">需修正明细</p>
                      <p className="mt-0.5 text-xs text-red-300/80">请按行号回到 Excel 修改后重新上传。未修正的行不会导入。</p>
                    </div>
                    <span className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-200">{invalidRows.length} 行</span>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-red-950 text-red-200">
                        <tr>
                          <th className="px-3 py-2 text-left">行号</th>
                          <th className="px-3 py-2 text-left">货号</th>
                          <th className="px-3 py-2 text-left">产品名称</th>
                          <th className="px-3 py-2 text-left">指标</th>
                          <th className="px-3 py-2 text-left">修正原因</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-900/60">
                        {invalidRows.map((row) => (
                          <tr key={`invalid-${row.rowNumber}`} className="bg-slate-950/40">
                            <td className="px-3 py-2 font-mono text-red-200">{row.rowNumber}</td>
                            <td className="px-3 py-2 font-mono text-blue-200">{row.catalog_number || '-'}</td>
                            <td className="px-3 py-2 text-slate-200">{row.name || '-'}</td>
                            <td className="px-3 py-2 text-slate-300">{row.target || '-'}</td>
                            <td className="px-3 py-2 text-red-200">{row.errors.join('、')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">行号</th>
                      <th className="px-3 py-2 text-left">货号</th>
                      <th className="px-3 py-2 text-left">产品名称</th>
                      <th className="px-3 py-2 text-left">指标</th>
                      <th className="px-3 py-2 text-left">种属</th>
                      <th className="px-3 py-2 text-left">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {parsedRows.slice(0, 8).map((row) => (
                      <tr key={row.rowNumber} className={row.errors.length > 0 ? 'bg-red-950/20' : 'bg-slate-900'}>
                        <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-blue-300 font-mono">{row.catalog_number || '-'}</td>
                        <td className="px-3 py-2 text-white">{row.name || '-'}</td>
                        <td className="px-3 py-2 text-slate-300">{row.target || '-'}</td>
                        <td className="px-3 py-2 text-slate-300">{row.species || '-'}</td>
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <span className="text-red-300">{row.errors.join('、')}</span>
                          ) : (
                            <span className="text-green-300">可导入</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 8 && (
                  <p className="px-3 py-2 text-xs text-slate-500 bg-slate-900">
                    仅预览前 8 行；如果存在需修正行，请以上方“需修正明细”为准。
                  </p>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-lg text-sm ${result.failed === 0 ? 'bg-green-900/30 text-green-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
              成功 {result.success} 条，失败 {result.failed} 条
              {result.errors.length > 0 && (
                <div className="mt-2 text-red-300 space-y-1">
                  {result.errors.slice(0, 5).map((error, index) => <p key={index}>{error}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-700 flex justify-between gap-3">
          <span className="text-xs text-slate-500 self-center">导入前会先检查必填项，不会再出现“成功 0 条、失败 0 条”的空结果。</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm">取消</button>
            <button onClick={handleImport} disabled={importing || parsing || validRows.length === 0} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2">
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              {importing ? '导入中...' : `开始导入${validRows.length ? ` ${validRows.length} 条` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
