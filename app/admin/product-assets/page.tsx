'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Card, Col, Input, Row, Select, Space, Statistic, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  PictureOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'
import { compressImage, formatFileSize } from '@/lib/image-compress'

type AssetType = 'standard_curve' | 'additional' | 'reserved'

type ProductAssetBatch = {
  id: string
  asset_type: AssetType
  title: string
  status: string
  total_count: number
  matched_count: number
  active_count: number
  failed_count: number
  created_at: string
}

type ProductAssetUpload = {
  id: string
  batch_id: string
  product_id: string | null
  products?: {
    id: string
    name: string
    target: string | null
    catalog_number: string | null
    cat_no: string | null
  } | null
  asset_type: AssetType
  image_type: string
  catalog_number: string | null
  species: string | null
  target: string | null
  file_url: string
  file_name: string
  match_method: string
  match_score: number
  match_reason: string | null
  status: string
  created_at: string
}

type BatchesResponse = {
  batches?: ProductAssetBatch[]
  error?: string
  needsSetup?: boolean
}

type UploadsResponse = {
  uploads?: ProductAssetUpload[]
  error?: string
  needsSetup?: boolean
}

type ActionResponse = {
  batch?: ProductAssetBatch
  message?: string
  id?: string
  error?: string
  needsSetup?: boolean
}

type ProductMediaSettings = {
  product_ad_image_url: string
  method_image_url: string
}

type ProductMediaResponse = {
  settings?: ProductMediaSettings
  message?: string
  error?: string
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  standard_curve: '标准曲线图',
  additional: '第 4 图片位',
  reserved: '第 5 预留图片位',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待匹配',
  matched: '待确认',
  active: '已生效',
  rejected: '已拒绝',
  archived: '已归档',
  rolled_back: '已撤回',
}

function formatTime(iso?: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getStatusColor(status: string) {
  if (status === 'active') return 'green'
  if (status === 'matched') return 'processing'
  if (status === 'pending') return 'gold'
  if (status === 'rejected') return 'volcano'
  return 'default'
}

function isImageFile(file: File) {
  return /\.(png|jpe?g|webp)$/i.test(file.name) || ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
}

function getWebpFileName(fileName: string) {
  return fileName.replace(/\.(png|jpe?g|webp)$/i, '') + '.webp'
}

async function compressProductAssetImage(file: File) {
  const compressed = await compressImage(file, {
    maxWidth: 1800,
    maxHeight: 1800,
    quality: 0.82,
    maxSizeMB: 0.9,
    outputType: 'image/webp',
  })

  if (compressed.size >= file.size) return file

  return new File([compressed], getWebpFileName(file.name), {
    type: compressed.type || 'image/webp',
    lastModified: file.lastModified,
  })
}

export default function AdminProductAssetsPage() {
  const { modal } = App.useApp()
  const [assetType, setAssetType] = useState<AssetType>('standard_curve')
  const [batches, setBatches] = useState<ProductAssetBatch[]>([])
  const [uploads, setUploads] = useState<ProductAssetUpload[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [loadingBatches, setLoadingBatches] = useState(true)
  const [loadingUploads, setLoadingUploads] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [fixedSettings, setFixedSettings] = useState<ProductMediaSettings>({
    product_ad_image_url: '/images/elisa/elisa_sandwich_lego.jpg',
    method_image_url: '/images/elisa/elisa_sandwich_sketch.jpg',
  })
  const [loadingFixedSettings, setLoadingFixedSettings] = useState(true)
  const [savingFixedSettings, setSavingFixedSettings] = useState(false)
  const [uploadingFixedSlot, setUploadingFixedSlot] = useState<keyof ProductMediaSettings | ''>('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const fixedSlotInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) || null
  const matchedCount = uploads.filter((upload) => upload.status === 'matched').length
  const activeCount = uploads.filter((upload) => upload.status === 'active').length
  const pendingCount = uploads.filter((upload) => upload.status === 'pending').length
  const rollbackableCount = uploads.filter((upload) => !['rolled_back', 'archived'].includes(upload.status)).length
  const batchOperationHint = !selectedBatchId
    ? '自动匹配和确认生效必须以单个上传批次为单位；上传完成后系统会自动选中最新批次。'
    : matchedCount > 0
      ? `当前批次已有 ${matchedCount} 张图片完成精确匹配，可以确认生效。`
      : pendingCount > 0
        ? `当前批次有 ${pendingCount} 张图片待匹配，请先点击“自动匹配”。如果仍未匹配，请检查文件名是否包含货号，或包含“种属 + 指标”。`
        : activeCount > 0
          ? `当前批次已有 ${activeCount} 张图片生效，产品详情页会读取这些图片。`
          : '当前批次暂无可处理图片。'

  const loadFixedSettings = useCallback(async () => {
    setLoadingFixedSettings(true)
    try {
      const res = await fetch('/api/admin/product-media-settings')
      const data = (await res.json().catch(() => ({}))) as ProductMediaResponse
      if (!res.ok || data.error) throw new Error(data.error || '固定图片配置加载失败')
      if (data.settings) setFixedSettings(data.settings)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '固定图片配置加载失败')
    } finally {
      setLoadingFixedSettings(false)
    }
  }, [])

  const loadBatches = useCallback(async (preferredBatchId?: string) => {
    setLoadingBatches(true)
    setError('')
    try {
      const params = new URLSearchParams({ asset_type: assetType })
      const res = await fetch(`/api/admin/product-assets/batches?${params.toString()}`)
      const data = (await res.json().catch(() => ({}))) as BatchesResponse
      if (!res.ok || data.error) throw new Error(data.error || '批次加载失败')
      const nextBatches = data.batches || []
      setBatches(nextBatches)
      const targetBatchId = preferredBatchId || selectedBatchId
      if (targetBatchId && nextBatches.some((batch) => batch.id === targetBatchId)) {
        setSelectedBatchId(targetBatchId)
      } else if (targetBatchId) {
        setSelectedBatchId('')
      } else if (nextBatches.length > 0) {
        setSelectedBatchId(nextBatches[0].id)
      }
    } catch (err: unknown) {
      setBatches([])
      setError(err instanceof Error ? err.message : '批次加载失败')
    } finally {
      setLoadingBatches(false)
    }
  }, [assetType, selectedBatchId])

  const loadUploads = useCallback(async (options?: { batchId?: string }) => {
    setLoadingUploads(true)
    setError('')
    try {
      const params = new URLSearchParams()
      const batchId = options?.batchId ?? selectedBatchId
      if (batchId) params.set('batch_id', batchId)
      const query = params.toString()
      const res = await fetch(`/api/admin/product-assets${query ? `?${query}` : ''}`)
      const data = (await res.json().catch(() => ({}))) as UploadsResponse
      if (!res.ok || data.error) throw new Error(data.error || '图片记录加载失败')
      setUploads((data.uploads || []).filter((upload) => upload.asset_type === assetType))
    } catch (err: unknown) {
      setUploads([])
      setError(err instanceof Error ? err.message : '图片记录加载失败')
    } finally {
      setLoadingUploads(false)
    }
  }, [assetType, selectedBatchId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 页面打开后需要加载固定图设置。
    loadFixedSettings()
  }, [loadFixedSettings])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换图片类型时需要刷新批次。
    loadBatches()
  }, [loadBatches])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换批次时需要刷新上传明细。
    loadUploads()
  }, [loadUploads])

  const createBatch = async (fileCount: number) => {
    const res = await fetch('/api/admin/product-assets/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_type: assetType,
        title: `${ASSET_TYPE_LABELS[assetType]}批量上传 ${fileCount} 张图片`,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ActionResponse
    if (!res.ok || data.error || !data.batch?.id) throw new Error(data.error || '批次创建失败')
    return data.batch
  }

  const uploadOneFile = async (file: File, batchId: string) => {
    const body = new FormData()
    body.append('file', file)
    body.append('asset_type', assetType)
    body.append('batch_id', batchId)

    const res = await fetch('/api/admin/product-assets', { method: 'POST', body })
    const data = (await res.json().catch(() => ({}))) as ActionResponse
    if (!res.ok || data.error) throw new Error(`${file.name}: ${data.error || '上传失败'}`)
  }

  const handleUploadFiles = async (files: FileList | null) => {
    const imageFiles = Array.from(files || []).filter(isImageFile)
    if (imageFiles.length === 0) return

    setUploading(true)
    setError('')
    setMessage('')
    let successCount = 0
    const failures: string[] = []

    try {
      const createdBatch = await createBatch(imageFiles.length)
      setSelectedBatchId(createdBatch.id)
      for (const [index, file] of imageFiles.entries()) {
        try {
          setMessage(`正在处理图片：${index + 1}/${imageFiles.length}，${file.name}`)
          const uploadFile = await compressProductAssetImage(file)
          const sizeNote = uploadFile.size < file.size
            ? `（已压缩 ${formatFileSize(file.size)} → ${formatFileSize(uploadFile.size)}）`
            : `（${formatFileSize(file.size)}）`
          setMessage(`正在上传：${index + 1}/${imageFiles.length}，${file.name} ${sizeNote}`)
          await uploadOneFile(uploadFile, createdBatch.id)
          successCount += 1
          setMessage(`正在上传：${successCount}/${imageFiles.length}`)
        } catch (err: unknown) {
          failures.push(err instanceof Error ? err.message : `${file.name}: 上传失败`)
        }
      }
      setMessage(`上传完成：成功 ${successCount} 张，失败 ${failures.length} 张。请先自动匹配，再核对确认。`)
      if (failures.length > 0) setError(failures.slice(0, 5).join('；'))
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSelectedBatchId(createdBatch.id)
      await loadBatches(createdBatch.id)
      await loadUploads({ batchId: createdBatch.id })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '批量上传失败')
      setMessage(`上传中断：成功 ${successCount} 张，失败 ${failures.length} 张。`)
    } finally {
      setUploading(false)
    }
  }

  const runBatchAction = async (action: 'match' | 'confirm_exact' | 'rollback') => {
    if (!selectedBatchId) {
      setError('请先选择一个批次')
      return
    }

    setError('')
    if (action === 'match') setMatching(true)
    if (action === 'confirm_exact') setConfirming(true)
    if (action === 'rollback') setRollingBack(true)

    try {
      const res = await fetch('/api/admin/product-assets/batches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: selectedBatchId, action }),
      })
      const data = (await res.json().catch(() => ({}))) as ActionResponse
      if (!res.ok || data.error) throw new Error(data.error || '批次操作失败')
      setMessage(data.message || '操作完成')
      await loadBatches()
      await loadUploads()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '批次操作失败')
    } finally {
      if (action === 'match') setMatching(false)
      if (action === 'confirm_exact') setConfirming(false)
      if (action === 'rollback') setRollingBack(false)
    }
  }

  const handleRollbackClick = () => {
    if (!selectedBatch) {
      runBatchAction('rollback')
      return
    }
    modal.confirm({
      title: `确定撤回批次“${selectedBatch.title}”吗？`,
      content:
        '未生效图片会从候选记录中撤回并清理上传文件；已生效图片会先恢复到本批次生效前的图片位，如果原来没有图片，会撤下本批次写入的图片。',
      okText: '撤回',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => runBatchAction('rollback'),
    })
  }

  const uploadFixedImage = async (file: File, slot: keyof ProductMediaSettings) => {
    if (!isImageFile(file)) {
      setError('请上传 PNG/JPG/WebP 图片')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('图片不能超过 20MB')
      return
    }

    setUploadingFixedSlot(slot)
    setError('')
    setMessage('')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const uploadFile = await compressProductAssetImage(file)
      const uploadExt = uploadFile.name.split('.').pop()?.toLowerCase() || ext
      const body = new FormData()
      body.append('file', uploadFile)
      body.append('bucket', 'product-assets')
      body.append('path', `product-defaults/${slot}-${Date.now()}.${uploadExt}`)
      if (fixedSettings[slot]) body.append('old_url', fixedSettings[slot])
      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || data.error || !data.url) throw new Error(data.error || '固定图片上传失败')
      setFixedSettings((prev) => ({ ...prev, [slot]: data.url! }))
      setMessage('固定图片已上传，请点击“保存固定图配置”后生效。')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '固定图片上传失败')
    } finally {
      setUploadingFixedSlot('')
    }
  }

  const saveFixedSettings = async () => {
    setSavingFixedSettings(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/product-media-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fixedSettings),
      })
      const data = (await res.json().catch(() => ({}))) as ProductMediaResponse
      if (!res.ok || data.error) throw new Error(data.error || '固定图片配置保存失败')
      if (data.settings) setFixedSettings(data.settings)
      setMessage(data.message || '固定图片配置已保存')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '固定图片配置保存失败')
    } finally {
      setSavingFixedSettings(false)
    }
  }

  const columns: ColumnsType<ProductAssetUpload> = [
    {
      title: '图片',
      key: 'image',
      width: 120,
      render: (_, upload) => (
        <a
          href={upload.file_url}
          target="_blank"
          rel="noreferrer"
          className="block h-20 w-20 overflow-hidden rounded-lg border border-gray-200 bg-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 后台预览 Supabase 图片，保持原始 URL 即可。 */}
          <img src={upload.file_url} alt={upload.file_name} className="h-full w-full object-contain" />
        </a>
      ),
    },
    {
      title: '文件信息',
      key: 'file',
      width: 260,
      render: (_, upload) => (
        <div className="min-w-0">
          <div className="truncate" title={upload.file_name}>
            {upload.file_name}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            货号 {upload.catalog_number || '-'} / 种属 {upload.species || '-'} / 指标 {upload.target || '-'}
          </div>
          <div className="mt-1 text-xs text-slate-500">{formatTime(upload.created_at)}</div>
        </div>
      ),
    },
    {
      title: '匹配商品',
      key: 'product',
      width: 220,
      render: (_, upload) =>
        upload.products ? (
          <div className="min-w-0">
            <div className="truncate text-cyan-700" title={upload.products.name}>
              {upload.products.name}
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">
              {upload.products.catalog_number || upload.products.cat_no || upload.products.target || '-'}
            </div>
          </div>
        ) : (
          <span className="text-slate-500">未匹配</span>
        ),
    },
    {
      title: '匹配说明',
      key: 'match',
      width: 200,
      render: (_, upload) => (
        <div className="text-xs text-slate-600">
          <div className="truncate" title={upload.match_reason || undefined}>
            {upload.match_reason || '等待自动匹配'}
          </div>
          <div className="mt-1 text-slate-500">
            {upload.match_method || 'none'} / {upload.match_score || 0}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={getStatusColor(status)}>{STATUS_LABELS[status] || status}</Tag>,
    },
    {
      title: '查看',
      key: 'view',
      width: 80,
      render: (_, upload) => (
        <Button type="link" size="small" href={upload.file_url} target="_blank" rel="noreferrer">
          打开
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<PictureOutlined />}
        title="产品图片管理"
        description="用于标准曲线图和预留图片位的批量上传。上传后先生成候选，确认生效后才会显示到产品详情页。"
        extra={
          <>
            <Select<AssetType>
              value={assetType}
              onChange={(value) => {
                setAssetType(value)
                setSelectedBatchId('')
              }}
              style={{ width: 160 }}
              options={[
                { value: 'standard_curve', label: '标准曲线图' },
                { value: 'additional', label: '第 4 图片位' },
                { value: 'reserved', label: '第 5 预留图片位' },
              ]}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadBatches()
                loadUploads()
              }}
            >
              刷新
            </Button>
            <Button type="primary" icon={<UploadOutlined />} loading={uploading} onClick={() => fileInputRef.current?.click()}>
              上传图片
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleUploadFiles(e.target.files)}
            />
          </>
        }
      />

      <Alert
        type="info"
        showIcon
        message={
          <>
            文件名建议使用 <b>货号__种属__指标__standard_curve.png</b>，也支持
            <b> 种属__指标__standard_curve.png</b>。系统优先按货号匹配，其次按“种属 + 指标”唯一匹配。
          </>
        }
      />

      <Card
        size="small"
        title="固定图片位"
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingFixedSettings}
            disabled={savingFixedSettings || loadingFixedSettings}
            onClick={saveFixedSettings}
          >
            保存固定图配置
          </Button>
        }
      >
        <p className="mb-4 text-xs text-slate-500">
          第 1 位“产品展示”和第 3 位“检测方法”是全站固定图，客户进入任意 ELISA 产品详情页都会看到。
        </p>
        <Row gutter={[12, 12]}>
          {(
            [
              ['product_ad_image_url', '第 1 图片位：产品展示图'],
              ['method_image_url', '第 3 图片位：检测方法图'],
            ] as Array<[keyof ProductMediaSettings, string]>
          ).map(([slot, label]) => (
            <Col key={slot} xs={24} lg={12}>
              <div className="h-full rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{label}</div>
                    <div className="mt-1 text-xs text-slate-500">上传后保存配置才会正式生效。</div>
                  </div>
                  <Button
                    size="small"
                    icon={<UploadOutlined />}
                    loading={uploadingFixedSlot === slot}
                    onClick={() => fixedSlotInputRefs.current[slot]?.click()}
                  >
                    上传
                  </Button>
                  <input
                    ref={(el) => {
                      fixedSlotInputRefs.current[slot] = el
                    }}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadFixedImage(e.target.files[0], slot)}
                  />
                </div>
                <div className="mt-3 h-40 overflow-hidden rounded-lg border border-gray-200 bg-slate-50">
                  {fixedSettings[slot] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 后台预览外部存储图片。
                    <img src={fixedSettings[slot]} alt={label} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">未设置图片</div>
                  )}
                </div>
                <Input
                  className="mt-3"
                  value={fixedSettings[slot] || ''}
                  onChange={(e) => setFixedSettings((prev) => ({ ...prev, [slot]: e.target.value }))}
                  placeholder="也可以直接粘贴图片 URL"
                />
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        size="small"
        title="批次中心"
        extra={
          <Space wrap>
            <Select
              value={selectedBatchId}
              onChange={setSelectedBatchId}
              style={{ minWidth: 260 }}
              options={[
                { value: '', label: '请选择具体批次' },
                ...batches.map((batch) => ({
                  value: batch.id,
                  label: `${batch.title}（${batch.total_count} 张）`,
                })),
              ]}
            />
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={matching}
              disabled={!selectedBatchId}
              title={!selectedBatchId ? '请选择具体批次后再自动匹配' : undefined}
              onClick={() => runBatchAction('match')}
            >
              自动匹配
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={confirming}
              disabled={!selectedBatchId || matchedCount === 0}
              title={
                !selectedBatchId
                  ? '请选择具体批次后再确认'
                  : matchedCount === 0
                    ? '需要先完成自动匹配，且至少有 1 张精确匹配图片'
                    : undefined
              }
              onClick={() => runBatchAction('confirm_exact')}
            >
              确认精确匹配
            </Button>
            <Button
              danger
              icon={<RollbackOutlined />}
              loading={rollingBack}
              disabled={!selectedBatchId || rollbackableCount === 0}
              title={!selectedBatchId ? '请选择具体批次后再撤回' : rollbackableCount === 0 ? '当前批次没有可撤回图片' : undefined}
              onClick={handleRollbackClick}
            >
              撤回本批次
            </Button>
          </Space>
        }
      >
        <p className="mb-3 text-xs text-slate-500">
          每次上传会生成独立批次。建议按批次自动匹配、人工核对、确认生效；发现错误可以撤回本批次。
        </p>
        <Alert className="mb-4" type="info" message={batchOperationHint} />
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={8} lg={4}>
            <Statistic title="当前显示" value={uploads.length} />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic title="待匹配" value={pendingCount} />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic title="待确认" value={matchedCount} />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic title="已生效" value={activeCount} />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic title="批次状态" value={selectedBatch?.status || '-'} />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic title="创建时间" value={formatTime(selectedBatch?.created_at)} />
          </Col>
        </Row>
      </Card>

      {error && <Alert type="error" showIcon message={error} />}
      {message && <Alert type="info" showIcon message={message} />}

      <Table<ProductAssetUpload>
        rowKey="id"
        columns={columns}
        dataSource={uploads}
        loading={loadingUploads || loadingBatches}
        locale={{ emptyText: '暂无图片上传记录' }}
        pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条记录` }}
        scroll={{ x: 900 }}
      />
    </div>
  )
}
