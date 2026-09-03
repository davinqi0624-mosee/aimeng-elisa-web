'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArchiveRestore,
  CheckCircle2,
  CircleAlert,
  ImagePlus,
  Loader2,
  RefreshCw,
  Save,
  Upload,
  Wand2,
} from 'lucide-react'
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

function getStatusClass(status: string) {
  if (status === 'active') return 'bg-emerald-500/10 text-emerald-300'
  if (status === 'matched') return 'bg-cyan-500/10 text-cyan-300'
  if (status === 'rolled_back' || status === 'archived') return 'bg-slate-500/10 text-slate-300'
  return 'bg-amber-500/10 text-amber-300'
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

    if (action === 'rollback' && selectedBatch) {
      const confirmed = window.confirm(
        `确定撤回批次“${selectedBatch.title}”吗？\n\n未生效图片会从候选记录中撤回并清理上传文件；已生效图片会先恢复到本批次生效前的图片位，如果原来没有图片，会撤下本批次写入的图片。`
      )
      if (!confirmed) return
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <ImagePlus className="h-5 w-5 text-cyan-400" />
            产品图片管理
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            用于标准曲线图和预留图片位的批量上传。上传后先生成候选，确认生效后才会显示到产品详情页。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={assetType}
            onChange={(e) => {
              setAssetType(e.target.value as AssetType)
              setSelectedBatchId('')
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="standard_curve">标准曲线图</option>
            <option value="additional">第 4 图片位</option>
            <option value="reserved">第 5 预留图片位</option>
          </select>
          <button
            type="button"
            onClick={() => {
              loadBatches()
              loadUploads()
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            上传图片
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleUploadFiles(e.target.files)}
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
        文件名建议使用 <span className="font-semibold">货号__种属__指标__standard_curve.png</span>，也支持
        <span className="font-semibold"> 种属__指标__standard_curve.png</span>。系统优先按货号匹配，其次按“种属 + 指标”唯一匹配。
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">固定图片位</h2>
            <p className="mt-1 text-xs text-slate-400">
              第 1 位“产品展示”和第 3 位“检测方法”是全站固定图，客户进入任意 ELISA 产品详情页都会看到。
            </p>
          </div>
          <button
            type="button"
            onClick={saveFixedSettings}
            disabled={savingFixedSettings || loadingFixedSettings}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {savingFixedSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存固定图配置
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {([
            ['product_ad_image_url', '第 1 图片位：产品展示图'],
            ['method_image_url', '第 3 图片位：检测方法图'],
          ] as Array<[keyof ProductMediaSettings, string]>).map(([slot, label]) => (
            <div key={slot} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="mt-1 text-xs text-slate-500">上传后保存配置才会正式生效。</div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                  {uploadingFixedSlot === slot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  上传
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadFixedImage(e.target.files[0], slot)}
                  />
                </label>
              </div>
              <div className="mt-3 h-40 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                {fixedSettings[slot] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 后台预览外部存储图片。
                  <img src={fixedSettings[slot]} alt={label} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">未设置图片</div>
                )}
              </div>
              <input
                value={fixedSettings[slot] || ''}
                onChange={(e) => setFixedSettings((prev) => ({ ...prev, [slot]: e.target.value }))}
                className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300"
                placeholder="也可以直接粘贴图片 URL"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">批次中心</h2>
            <p className="mt-1 text-xs text-slate-400">
              每次上传会生成独立批次。建议按批次自动匹配、人工核对、确认生效；发现错误可以撤回本批次。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="min-w-[260px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">请选择具体批次</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.title}（{batch.total_count} 张）
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => runBatchAction('match')}
              disabled={!selectedBatchId || matching}
              title={!selectedBatchId ? '请选择具体批次后再自动匹配' : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              自动匹配
            </button>
            <button
              type="button"
              onClick={() => runBatchAction('confirm_exact')}
              disabled={!selectedBatchId || confirming || matchedCount === 0}
              title={!selectedBatchId ? '请选择具体批次后再确认' : matchedCount === 0 ? '需要先完成自动匹配，且至少有 1 张精确匹配图片' : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              确认精确匹配
            </button>
            <button
              type="button"
              onClick={() => runBatchAction('rollback')}
              disabled={!selectedBatchId || rollingBack || rollbackableCount === 0}
              title={!selectedBatchId ? '请选择具体批次后再撤回' : rollbackableCount === 0 ? '当前批次没有可撤回图片' : undefined}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/50 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
            >
              {rollingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
              撤回本批次
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
          {batchOperationHint}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-slate-500">当前显示</div>
            <div className="mt-1 text-lg font-semibold text-white">{uploads.length}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-slate-500">待匹配</div>
            <div className="mt-1 text-lg font-semibold text-amber-300">{pendingCount}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-slate-500">待确认</div>
            <div className="mt-1 text-lg font-semibold text-cyan-300">{matchedCount}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-slate-500">已生效</div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">{activeCount}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-slate-500">批次状态</div>
            <div className="mt-1 truncate text-sm font-semibold text-white">{selectedBatch?.status || '-'}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-slate-500">创建时间</div>
            <div className="mt-1 truncate text-sm font-semibold text-white">{formatTime(selectedBatch?.created_at)}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="grid grid-cols-12 gap-2 border-b border-slate-800 bg-slate-950 px-4 py-3 text-xs font-medium text-slate-400">
          <div className="col-span-2">图片</div>
          <div className="col-span-3">文件信息</div>
          <div className="col-span-3">匹配商品</div>
          <div className="col-span-2">匹配说明</div>
          <div className="col-span-1">状态</div>
          <div className="col-span-1 text-right">查看</div>
        </div>

        {loadingUploads || loadingBatches ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">加载中...</div>
        ) : uploads.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">暂无图片上传记录</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {uploads.map((upload) => (
              <div key={upload.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm text-slate-200">
                <div className="col-span-2">
                  <a href={upload.file_url} target="_blank" rel="noreferrer" className="block h-20 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 后台预览 Supabase 图片，保持原始 URL 即可。 */}
                    <img src={upload.file_url} alt={upload.file_name} className="h-full w-full object-contain" />
                  </a>
                </div>
                <div className="col-span-3 min-w-0">
                  <div className="truncate" title={upload.file_name}>{upload.file_name}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    货号 {upload.catalog_number || '-'} / 种属 {upload.species || '-'} / 指标 {upload.target || '-'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">{formatTime(upload.created_at)}</div>
                </div>
                <div className="col-span-3 min-w-0">
                  {upload.products ? (
                    <>
                      <div className="truncate text-cyan-300" title={upload.products.name}>{upload.products.name}</div>
                      <div className="mt-1 truncate text-[11px] text-slate-500">
                        {upload.products.catalog_number || upload.products.cat_no || upload.products.target || '-'}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-500">未匹配</span>
                  )}
                </div>
                <div className="col-span-2 text-xs text-slate-400">
                  <div className="truncate">{upload.match_reason || '等待自动匹配'}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {upload.match_method || 'none'} / {upload.match_score || 0}
                  </div>
                </div>
                <div className="col-span-1">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${getStatusClass(upload.status)}`}>
                    {upload.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                    {STATUS_LABELS[upload.status] || upload.status}
                  </span>
                </div>
                <div className="col-span-1 text-right">
                  <a href={upload.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                    打开
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
