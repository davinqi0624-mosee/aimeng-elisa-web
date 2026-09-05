'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert, App, Button, Card, Input, InputNumber, Modal, Popconfirm,
  Select, Space, Spin, Statistic, Table, Tag
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined, CloseOutlined, DeleteOutlined, DownloadOutlined,
  EditOutlined, ExclamationCircleOutlined, FileExcelOutlined, FilePdfOutlined,
  FileTextOutlined, PictureOutlined, PlusOutlined, SaveOutlined, SearchOutlined,
  UploadOutlined
} from '@ant-design/icons';
import PageHeader from '@/components/admin/PageHeader';
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

function statusTagColor(status?: string) {
  const normalized = (status || '').trim();
  if (normalized === 'active' || normalized === '上架') return 'green';
  if (normalized === 'draft' || normalized === '草稿') return 'gold';
  return 'default';
}

function isSignificantPriceChange(oldPrice?: number, nextPrice?: number) {
  const oldValue = Number(oldPrice);
  const nextValue = Number(nextPrice);
  if (!Number.isFinite(oldValue) || !Number.isFinite(nextValue)) return false;
  if (oldValue <= 0) return nextValue > 0;
  return Math.abs(nextValue - oldValue) / oldValue > 0.2;
}

export default function AdminProductsPage() {
  const { message, modal } = App.useApp();
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
      const msg = getErrorMessage(error, '网络错误');
      setLoadError('加载商品失败: ' + msg);
      message.error('加载商品失败: ' + msg);
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [loadProducts, page, search, message]);

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
      message.error('请先保存商品，再上传图片。这样文件会归档到对应商品目录，避免进入临时目录后难以追溯。');
      return;
    }
    const key = `${type}_image` as ProductImageField;

    if (!file.type.startsWith('image/')) {
      message.error('请选择图片文件，支持 JPG、PNG、WebP 等图片格式');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      message.error('图片不能超过 8MB，请压缩后再上传');
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
        message.error('上传失败: ' + (result.error || '未知错误'));
        return;
      }

      setEditing(prev => prev ? ({ ...prev, [key]: result.url } as Product) : null);
    } catch (error: unknown) {
      message.error('上传失败: ' + getErrorMessage(error, '网络错误'));
    } finally {
      setUploadingImages(prev => ({ ...prev, [key]: false }));
    }
  };

  const validatePdfFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      message.error('说明书只能上传 PDF 文件');
      return false;
    }
    if (file.size > 20 * 1024 * 1024) {
      message.error('PDF 不能超过 20MB，请压缩后再上传');
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
      message.error('PDF上传失败: ' + getErrorMessage(error, '网络错误'));
    } finally {
      setUploadingImages(prev => ({ ...prev, datasheet_pdf: false }));
    }
  };

  const closeEditor = () => {
    setEditing(null);
    setIsCreating(false);
    setPendingPdfFile(null);
  };

  const handleSave = () => {
    if (!editing) return;
    const name = editing.name.trim();
    const target = editing.target.trim();
    const catalogNumber = editing.catalog_number?.trim() || '';
    if (!name || !target || !catalogNumber) {
      setSaveStatus('error');
      message.error('请填写商品名称、靶标和货号。货号是说明书、COA 和批量文件匹配的核心字段。');
      return;
    }
    const originalProduct = isCreating ? null : products.find((product) => product.id === editing.id);
    const doSave = async () => {
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
        message.error((isCreating ? '创建失败: ' : '保存失败: ') + getErrorMessage(error, '网络连接失败，请稍后重试'));
        return;
      }

      let responseData: { id?: string; message?: string } = {};
      if (!response.ok) {
        const error = await response.json().catch(() => ({} as AdminApiError));
        setSaveStatus('error');
        if (error.requireConfirm) {
          message.error('保存失败：价格变动超过 20%，当前账号无权直接保存。请让超级管理员复核价格后再提交。');
          return;
        }
        message.error((isCreating ? '创建失败: ' : '保存失败: ') + (error.error || '未知错误'));
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
          message.error(`商品已保存，但说明书 PDF 上传或绑定失败：${getErrorMessage(error, '未知错误')}。请进入该商品编辑页重新上传说明书。`);
          setUploadingImages(prev => ({ ...prev, datasheet_pdf: false }));
          return;
        } finally {
          setUploadingImages(prev => ({ ...prev, datasheet_pdf: false }));
        }
      }

      setSaveStatus('saved');
      setTimeout(() => { setSaveStatus('idle'); setEditing(null); setIsCreating(false); setPendingPdfFile(null); fetchProducts(); }, 800);
    };

    if (
      originalProduct &&
      isSignificantPriceChange(originalProduct.price, Number(editing.price))
    ) {
      modal.confirm({
        content: `价格从 ¥${originalProduct.price} 调整为 ¥${Number(editing.price)}，变动超过 20%。请确认这是有意修改后再保存。`,
        onOk: doSave,
      });
      return;
    }
    void doSave();
  };

  const handleDelete = async (product: Product) => {
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      message.error('删除失败: ' + (error.error || '未知错误'));
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

  const columns: ColumnsType<Product> = [
    {
      title: '名称 / 靶标',
      key: 'name',
      render: (_, p) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{p.name}</div>
          <div className="text-xs text-slate-500">{p.target}</div>
          {p.catalog_number && <div className="mt-0.5 font-mono text-xs text-blue-600">货号：{p.catalog_number}</div>}
          {p.species && <div className="mt-0.5 text-xs text-emerald-600">种属：{p.species}</div>}
        </div>
      ),
    },
    {
      title: '检测范围',
      key: 'detection_range',
      render: (_, p) => <span className="text-slate-600">{p.detection_range || '-'}</span>,
    },
    {
      title: '灵敏度',
      key: 'sensitivity',
      render: (_, p) => <span className="text-slate-600">{p.sensitivity || '-'}</span>,
    },
    {
      title: '价格',
      key: 'price',
      width: 110,
      render: (_, p) => p.price_48t || p.price_96t ? (
        <div className="space-y-0.5">
          {p.price_48t && <div className="text-xs"><span className="text-blue-600">48T</span> ¥{p.price_48t}</div>}
          {p.price_96t && <div className="text-xs"><span className="text-emerald-600">96T</span> ¥{p.price_96t}</div>}
        </div>
      ) : (
        <span>¥{p.price}</span>
      ),
    },
    {
      title: '图片',
      key: 'images',
      width: 90,
      render: (_, p) => (
        <div className="flex gap-1">
          {p.product_image && <span className="h-2 w-2 rounded-full bg-green-500" title="产品图" />}
          {p.standard_curve_image && <span className="h-2 w-2 rounded-full bg-blue-500" title="标准曲线" />}
          {p.validation_image && <span className="h-2 w-2 rounded-full bg-purple-500" title="验证图" />}
          {p.additional_image && <span className="h-2 w-2 rounded-full bg-yellow-500" title="其他图" />}
          {!p.product_image && !p.standard_curve_image && !p.validation_image && !p.additional_image && (
            <span className="text-xs text-slate-400">无</span>
          )}
        </div>
      ),
    },
    {
      title: '说明书',
      key: 'datasheet',
      width: 90,
      render: (_, p) => p.datasheet_pdf ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-600">
          <FileTextOutlined /> 已上传
        </span>
      ) : (
        <span className="text-xs text-slate-400">-</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => <Tag color={statusTagColor(status)}>{displayStatus(status)}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, p) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => { setSaveStatus('idle'); setUploadingImages({}); setPendingPdfFile(null); setEditing({ ...p, status: normalizePublishStatus(p.status), stock_status: normalizeStockStatus(p.stock_status) }); setIsCreating(false); }}
          />
          <Popconfirm
            title={`确定删除商品「${p.catalog_number ? `${p.name}（货号：${p.catalog_number}）` : p.name}」？`}
            description="删除后前台将无法访问该商品，相关图片和说明书链接也会失去商品归属。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(p)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        icon={<PictureOutlined />}
        title="商品管理"
        description="管理 ELISA 试剂盒：编辑信息、上传图片、导入批量数据"
        extra={
          <Space>
            <Button icon={<DeleteOutlined />} onClick={() => setShowCatalogReset(true)}>归档旧目录</Button>
            <Button icon={<DownloadOutlined />} onClick={() => setShowBulkImport(true)}>批量导入</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增商品</Button>
          </Space>
        }
      />

      {/* 搜索 */}
      <Input
        allowClear
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        placeholder="搜索商品名称或靶标..."
        prefix={<SearchOutlined />}
        className="mb-4 max-w-md"
      />

      {loadError && (
        <Alert type="error" showIcon message={loadError} className="mb-4" />
      )}

      {/* 表格 */}
      <Table<Product>
        rowKey="id"
        columns={columns}
        dataSource={products}
        loading={loading}
        locale={{ emptyText: '暂无商品' }}
        scroll={{ x: 1000 }}
        pagination={{
          current: page + 1,
          pageSize: PAGE_SIZE,
          total,
          hideOnSinglePage: true,
          onChange: (nextPage) => setPage(nextPage - 1),
          showTotal: () => `共 ${total} 条，第 ${page + 1}/${totalPages} 页`,
        }}
      />

      {/* 编辑弹窗 */}
      {editing && (
        <Modal
          open
          title={isCreating ? '新增商品' : '编辑商品'}
          width={896}
          onCancel={closeEditor}
          footer={
            <div className="flex items-center justify-between">
              <Button onClick={closeEditor}>取消</Button>
              <div className="flex items-center gap-3">
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircleOutlined /> 已保存</span>
                )}
                {saveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-sm text-red-500"><ExclamationCircleOutlined /> 保存失败</span>
                )}
                <Button type="primary" icon={<SaveOutlined />} loading={saveStatus === 'saving'} onClick={handleSave}>
                  {saveStatus === 'saving' ? (pendingPdfFile ? '保存并上传中...' : '保存中...') : '保存'}
                </Button>
              </div>
            </div>
          }
        >
          <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
            {/* 基础信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">商品名称</label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">靶标</label>
                <Input value={editing.target} onChange={e => setEditing({ ...editing, target: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">货号</label>
                <Input value={editing.catalog_number || ''} onChange={e => setEditing({ ...editing, catalog_number: e.target.value })} placeholder="如 AU-IL6-M01" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">种属</label>
                <Input value={editing.species || ''} onChange={e => setEditing({ ...editing, species: e.target.value })} placeholder="如 小鼠、大鼠、人" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">检测范围</label>
                <Input value={editing.detection_range || ''} onChange={e => setEditing({ ...editing, detection_range: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">灵敏度</label>
                <Input value={editing.sensitivity || ''} onChange={e => setEditing({ ...editing, sensitivity: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">检测方法</label>
                <Input value={editing.detection_method || ''} onChange={e => setEditing({ ...editing, detection_method: e.target.value })} placeholder="双抗夹心法 (Sandwich ELISA)" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">检测平台</label>
                <Input value={editing.platform || ''} onChange={e => setEditing({ ...editing, platform: e.target.value })} placeholder="ELISA" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">操作时长</label>
                <Input value={editing.assay_time || ''} onChange={e => setEditing({ ...editing, assay_time: e.target.value })} placeholder="4h" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">样本类型</label>
                <Input value={editing.sample_types_text || ''} onChange={e => setEditing({ ...editing, sample_types_text: e.target.value })} placeholder="血清、血浆、细胞培养上清、组织匀浆" />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">产品介绍</label>
                <Input.TextArea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={4} placeholder="用于前台商品详情页展示，可填写产品特点、适用场景、检测原理摘要等。" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">价格（兼容旧版单价格）</label>
                <InputNumber className="w-full" value={editing.price} onChange={v => setEditing({ ...editing, price: Number(v) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">价格 48T</label>
                  <InputNumber className="w-full" value={editing.price_48t} onChange={v => setEditing({ ...editing, price_48t: Number(v) || undefined })} placeholder="1800" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">价格 96T</label>
                  <InputNumber className="w-full" value={editing.price_96t} onChange={v => setEditing({ ...editing, price_96t: Number(v) || undefined })} placeholder="2400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">库存状态</label>
                  <Select
                    className="w-full"
                    value={editing.stock_status}
                    onChange={v => setEditing({ ...editing, stock_status: v })}
                    options={[
                      { value: 'in_stock', label: '有货' },
                      { value: 'low_stock', label: '库存紧张' },
                      { value: 'out_of_stock', label: '缺货' },
                    ]}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">上架状态</label>
                  <Select
                    className="w-full"
                    value={editing.status}
                    onChange={v => setEditing({ ...editing, status: v })}
                    options={[
                      { value: 'active', label: '上架' },
                      { value: 'draft', label: '草稿' },
                      { value: 'archived', label: '归档' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* 图片上传区域 */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <PictureOutlined className="text-slate-500" /> 产品图片（4张）
              </h3>
              {isCreating && (
                <Alert
                  type="warning"
                  showIcon
                  className="mb-3"
                  message="请先保存商品，再上传图片。保存后文件会进入该商品专属目录，避免批量维护时归错商品。"
                />
              )}
              <div className="grid grid-cols-4 gap-3">
                {PRODUCT_IMAGE_SLOTS.map(({ field, uploadType, label, desc }) => (
                  <div key={field} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-1 text-xs font-medium text-slate-700">{label}</p>
                    <p className="mb-2 text-[10px] text-slate-400">{desc}</p>
                    {editing[field] ? (
                      <div className="relative">
                        <div className="relative h-20 w-full overflow-hidden rounded-lg">
                          <Image src={editing[field] as string} alt={label} fill className="object-cover" unoptimized />
                        </div>
                        <Button
                          type="primary"
                          danger
                          size="small"
                          icon={<CloseOutlined />}
                          onClick={() => setEditing({ ...editing, [field]: undefined })}
                          className="absolute right-1 top-1"
                        />
                      </div>
                    ) : (
                      <label className={`flex h-20 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 transition-colors ${isCreating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-slate-400'}`}>
                        <UploadOutlined className="mb-1 text-slate-400" />
                        <span className="text-[10px] text-slate-400">{isCreating ? '保存后上传' : '点击上传'}</span>
                        <input type="file" accept="image/*" disabled={isCreating} className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], uploadType)} />
                      </label>
                    )}
                    {uploadingImages[field] && <p className="mt-1 text-center text-[10px] text-blue-500">上传中...</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* 说明书PDF上传 */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileTextOutlined className="text-emerald-600" /> 说明书 PDF
              </h3>
              {editing.datasheet_pdf ? (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <FileTextOutlined className="text-2xl text-red-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">说明书已上传</p>
                    <a href={editing.datasheet_pdf} target="_blank" className="text-xs text-blue-600 hover:underline">查看 PDF</a>
                  </div>
                  <Button type="text" icon={<CloseOutlined />} onClick={() => setEditing({ ...editing, datasheet_pdf: undefined })} />
                </div>
              ) : pendingPdfFile ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <FileTextOutlined className="text-2xl text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">已选择：{pendingPdfFile.name}</p>
                    <p className="text-xs text-emerald-700">点击保存后会自动创建商品并上传说明书</p>
                  </div>
                  <Button type="text" icon={<CloseOutlined />} onClick={() => setPendingPdfFile(null)} />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <FilePdfOutlined className="text-2xl text-emerald-600" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900">{isCreating ? '可先选择说明书 PDF，保存时自动上传' : '上传或更换说明书 PDF'}</p>
                      <p className="text-xs text-slate-500">支持 PDF 格式，最大 20MB；建议控制在 5MB 内</p>
                    </div>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => pdfInputRef.current?.click()}
                  >
                    选择 PDF
                  </Button>
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
              {uploadingImages['datasheet_pdf'] && <p className="mt-2 text-xs text-blue-500">PDF 上传中...</p>}
            </div>
          </div>
        </Modal>
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
    <Modal
      open
      title="归档旧产品目录"
      onCancel={onClose}
      footer={
        <div className="flex items-center justify-between">
          <Button onClick={loadSummary} disabled={loading}>重新预检</Button>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              danger
              loading={submitting}
              disabled={submitting || confirmText !== '归档旧产品目录'}
              onClick={archiveCatalog}
            >
              归档并释放旧货号
            </Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-4">
        <Alert
          type="warning"
          showIcon
          message="这个操作会把当前所有上架产品归档，并释放旧货号和旧页面地址，方便你重新批量上传干净的产品目录。它不会删除客户、订单、积分、商城，也不会删除图片/PDF文件本身。"
        />

        {loading ? (
          <div className="py-8 text-center"><Spin /></div>
        ) : summary ? (
          <div className="grid grid-cols-2 gap-3">
            <Card size="small"><Statistic title="当前上架产品" value={summary.active_products} /></Card>
            <Card size="small"><Statistic title="已归档产品" value={summary.archived_products} /></Card>
            <Card size="small"><Statistic title="产品图片绑定" value={summary.product_images} /></Card>
            <Card size="small"><Statistic title="生效产品文档" value={summary.active_documents} /></Card>
          </div>
        ) : null}

        {error && <Alert type="error" showIcon message={error} />}
        {message && <Alert type="success" showIcon message={message} />}

        <div>
          <label className="mb-1.5 block text-sm text-slate-700">确认文字</label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="请输入：归档旧产品目录"
          />
        </div>
      </div>
    </Modal>
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
  const { message } = App.useApp();
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
    if (!selectedFile) { message.error('请先选择 Excel 或 CSV 文件'); return; }
    if (validRows.length === 0) { message.error('没有可导入的数据，请先修正红色错误行'); return; }
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
    <Modal
      open
      title="批量导入商品"
      width={896}
      onCancel={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">导入前会先检查必填项，不会再出现“成功 0 条、失败 0 条”的空结果。</span>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              loading={importing}
              disabled={importing || parsing || validRows.length === 0}
              onClick={handleImport}
            >
              {importing ? '导入中...' : `开始导入${validRows.length ? ` ${validRows.length} 条` : ''}`}
            </Button>
          </Space>
        </div>
      }
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1 [-webkit-overflow-scrolling:touch]">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-slate-700">支持 Excel / CSV。推荐先下载模板，填好后直接拖进来。</p>
            <p className="mt-1 text-xs text-slate-500">模板只放产品文字信息；图片在“产品图片”上传，说明书在“产品文档”上传。</p>
          </div>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载 Excel 模板</Button>
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) parseFile(file);
          }}
          className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:border-slate-400"
        >
          <FileExcelOutlined className="mx-auto mb-3 text-3xl text-blue-500" />
          <p className="text-sm font-medium text-slate-900">把 Excel / CSV 文件拖到这里</p>
          <p className="mt-1 text-xs text-slate-500">或点击下方按钮选择文件，不需要粘贴电脑里的文件路径</p>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
          >
            选择文件
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
        </div>

        {selectedFile && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="truncate">已选择：{selectedFile.name}</span>
            {parsing && <span className="inline-flex items-center gap-1 text-blue-600"><Spin size="small" /> 解析中</span>}
          </div>
        )}

        {parseError && (
          <Alert type="error" showIcon message={parseError} />
        )}

        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Card size="small"><Statistic title="解析总数" value={parsedRows.length} /></Card>
              <Card size="small"><Statistic title="可导入" value={validRows.length} valueStyle={{ color: 'green' }} /></Card>
              <Card size="small"><Statistic title="需修正" value={invalidRows.length} valueStyle={{ color: 'red' }} /></Card>
            </div>

            {invalidRows.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-red-200">
                <div className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-red-700">需修正明细</p>
                    <p className="mt-0.5 text-xs text-red-500/80">请按行号回到 Excel 修改后重新上传。未修正的行不会导入。</p>
                  </div>
                  <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">{invalidRows.length} 行</span>
                </div>
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-red-50 text-red-600">
                      <tr>
                        <th className="px-3 py-2 text-left">行号</th>
                        <th className="px-3 py-2 text-left">货号</th>
                        <th className="px-3 py-2 text-left">产品名称</th>
                        <th className="px-3 py-2 text-left">指标</th>
                        <th className="px-3 py-2 text-left">修正原因</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {invalidRows.map((row) => (
                        <tr key={`invalid-${row.rowNumber}`}>
                          <td className="px-3 py-2 font-mono text-red-600">{row.rowNumber}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">{row.catalog_number || '-'}</td>
                          <td className="px-3 py-2 text-slate-700">{row.name || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.target || '-'}</td>
                          <td className="px-3 py-2 text-red-600">{row.errors.join('、')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">行号</th>
                    <th className="px-3 py-2 text-left">货号</th>
                    <th className="px-3 py-2 text-left">产品名称</th>
                    <th className="px-3 py-2 text-left">指标</th>
                    <th className="px-3 py-2 text-left">种属</th>
                    <th className="px-3 py-2 text-left">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.slice(0, 8).map((row) => (
                    <tr key={row.rowNumber} className={row.errors.length > 0 ? 'bg-red-50/50' : 'bg-white'}>
                      <td className="px-3 py-2 text-slate-400">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-mono text-blue-600">{row.catalog_number || '-'}</td>
                      <td className="px-3 py-2 text-slate-900">{row.name || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.target || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.species || '-'}</td>
                      <td className="px-3 py-2">
                        {row.errors.length > 0 ? (
                          <span className="text-red-600">{row.errors.join('、')}</span>
                        ) : (
                          <span className="text-green-600">可导入</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 8 && (
                <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  仅预览前 8 行；如果存在需修正行，请以上方“需修正明细”为准。
                </p>
              )}
            </div>
          </div>
        )}

        {result && (
          <Alert
            type={result.failed === 0 ? 'success' : 'warning'}
            showIcon
            message={`成功 ${result.success} 条，失败 ${result.failed} 条`}
            description={result.errors.length > 0 ? (
              <div className="space-y-1 text-red-600">
                {result.errors.slice(0, 5).map((error, index) => <p key={index}>{error}</p>)}
              </div>
            ) : undefined}
          />
        )}
      </div>
    </Modal>
  );
}
