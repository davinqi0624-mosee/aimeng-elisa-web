'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Input, Popconfirm, Select, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  InboxOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  FileExclamationOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  ReloadOutlined,
  RollbackOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

type DocumentType = 'datasheet' | 'coa'
type StatusFilter = 'all' | 'pending' | 'unmatched' | 'retry' | 'active' | 'archived'

type ProductDocument = {
  id: string
  product_id: string | null
  product?: {
    id: string
    name: string
    target: string | null
    catalog_number: string | null
    cat_no: string | null
  } | null
  document_type: DocumentType
  catalog_number?: string | null
  batch_number?: string | null
  normalized_file_key?: string | null
  file_url: string
  file_name: string | null
  match_reason: string | null
  match_score: number | null
  review_note?: string | null
  failure_reason?: string | null
  upload_status?: string | null
  parse_status?: string | null
  storage_status?: string | null
  publish_status?: string | null
  match_status?: string | null
  source_type: string
  status: string
  created_at: string
}

type ProductDocumentBatch = {
  id: string
  title: string
  document_type: DocumentType
  status: string
  note?: string | null
  created_at: string
  total: number
  requested_total?: number
  upload_success?: number
  upload_failed?: number
  filename_ok?: number
  filename_failed?: number
  matched_exact?: number
  matched_manual?: number
  match_failed?: number
  publish_ready?: number
  published?: number
  frontend_verified?: number
  storage_deleted?: number
  alert_level?: 'normal' | 'needs_attention' | 'high_failure'
  pending_unmatched: number
  pending_review: number
  exact_pending: number
  active: number
  archived: number
  duplicate_archived?: number
  duplicate_effective?: number
  deleted_needs_retry?: number
}

type DocumentsResponse = {
  documents?: ProductDocument[]
  error?: string
}

type BatchesResponse = {
  batches?: ProductDocumentBatch[]
  error?: string
}

type UploadResponse = {
  id?: string
  file_url?: string
  file_name?: string
  warnings?: string[]
  error?: string
}

type BatchActionResponse = {
  message?: string
  error?: string
}

type MatchResponse = {
  error?: string
  matched?: number
  duplicateArchived?: number
  failed?: number
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const UPLOAD_RETRY_DELAYS = [1200, 3000, 6000]

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getUploadStatusMessage(status: number) {
  if (status === 502 || status === 503) return '服务器正在重启或临时不可用，已自动重试后仍失败'
  if (status === 504) return '上传等待超时，文件可能较大或网络较慢，请稍后单独重传'
  if (status === 413) return '文件超过服务器上传限制，请压缩 PDF 后重传'
  if (status === 401 || status === 403) return '登录状态已失效或权限不足，请重新登录后台'
  return `服务器返回 ${status}`
}

function isEmptyContentUploadError(message?: string) {
  const text = message?.toLowerCase() || ''
  return text.includes('no content provided') || text.includes('missing content') || text.includes('empty body')
}

class NonRetryableUploadError extends Error {}

function isLocalReadFailure(message?: string) {
  const text = message?.toLowerCase() || ''
  return text.includes('i/o read operation failed') || text.includes('notreadableerror')
}

function getBrowserReadFailureMessage(file: File, reason?: string) {
  return `${file.name}: 浏览器无法读取该 PDF 文件。请重新选择文件，或换一个浏览器重试。${reason ? `原始错误：${reason}` : ''}`
}

function uploadRawFileWithXhr(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (message: string) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
      reject(new Error('当前浏览器不支持 XHR 上传'))
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value))
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return
      const percent = Math.min(99, Math.round((event.loaded / event.total) * 100))
      onProgress?.(`${file.name}: 正在发送到网站服务器 ${percent}%（${formatFileSize(event.loaded)}/${formatFileSize(event.total)}）`)
    }
    xhr.onload = () => {
      const data = (() => {
        try {
          return JSON.parse(xhr.responseText || '{}') as UploadResponse
        } catch {
          return {} as UploadResponse
        }
      })()
      if (xhr.status >= 200 && xhr.status < 300 && !data.error) {
        resolve(data)
        return
      }
      reject(new Error(data.error || getUploadStatusMessage(xhr.status)))
    }
    xhr.onerror = () => reject(new Error('浏览器到网站服务器的上传连接失败'))
    xhr.onabort = () => reject(new Error('上传已中断'))
    xhr.ontimeout = () => reject(new Error('上传超时'))
    xhr.timeout = 15 * 60 * 1000

    try {
      xhr.send(file)
    } catch (err: unknown) {
      reject(err instanceof Error ? err : new Error('浏览器发送文件失败'))
    }
  })
}

async function uploadViaServerFallback(
  file: File,
  batchId: string,
  documentType: DocumentType,
  onProgress?: (message: string) => void
) {
  const params = new URLSearchParams({
    document_type: documentType,
    batch_id: batchId,
    file_name: file.name,
    file_size: String(file.size),
  })

  const headers = {
    'content-type': file.type || 'application/pdf',
    'x-file-name': encodeURIComponent(file.name),
    'x-file-size': String(file.size),
  }
  const url = `/api/admin/product-documents/raw-upload?${params.toString()}`

  try {
    await uploadRawFileWithXhr(url, file, headers, onProgress)
    return
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '浏览器发送文件失败'
    if (isLocalReadFailure(message)) {
      throw new NonRetryableUploadError(getBrowserReadFailureMessage(file, message))
    }
    throw new Error(`${file.name}: 服务器上传失败：${message}`)
  }
}

function getModuleToneIcon(tone: 'ok' | 'wait' | 'warn' | 'error' | 'muted') {
  if (tone === 'ok') return <CheckCircleOutlined className="text-sm text-emerald-500" />
  if (tone === 'error') return <ExclamationCircleOutlined className="text-sm text-red-500" />
  if (tone === 'warn') return <ExclamationCircleOutlined className="text-sm text-amber-500" />
  if (tone === 'wait') return <ExclamationCircleOutlined className="text-sm text-cyan-600" />
  return <ExclamationCircleOutlined className="text-sm text-slate-400" />
}

function WorkflowModuleCard({
  title,
  value,
  detail,
  tone,
  action,
}: {
  title: string
  value: string
  detail: string
  tone: 'ok' | 'wait' | 'warn' | 'error' | 'muted'
  action?: ReactNode
}) {
  return (
    <Card size="small" className="h-full">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        {getModuleToneIcon(tone)}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 min-h-[32px] text-xs text-slate-500">{detail}</div>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  )
}

export default function AdminProductDocumentsPage() {
  const [documents, setDocuments] = useState<ProductDocument[]>([])
  const [batches, setBatches] = useState<ProductDocumentBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBatches, setLoadingBatches] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [confirmingExact, setConfirmingExact] = useState(false)
  const [actionDocId, setActionDocId] = useState('')
  const [error, setError] = useState('')
  const [uploadSummary, setUploadSummary] = useState('')
  const [uploadProgressDetail, setUploadProgressDetail] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('datasheet')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [issueReport, setIssueReport] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadDocuments = useCallback(async (options?: { batchId?: string; status?: StatusFilter }) => {
    setLoading(true)
    setError('')
    try {
      const nextStatus = options?.status || status
      const nextBatchId = options?.batchId ?? selectedBatchId
      const params = new URLSearchParams({ type: documentType, status: nextStatus })
      if (nextBatchId) params.set('batch_id', nextBatchId)
      const res = await fetch(`/api/admin/product-documents?${params.toString()}`)
      const data = (await res.json().catch(() => ({}))) as DocumentsResponse
      if (!res.ok || data.error) throw new Error(data.error || '加载失败')
      setDocuments(data.documents || [])
    } catch (err: unknown) {
      setDocuments([])
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [documentType, status, selectedBatchId])

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true)
    try {
      const params = new URLSearchParams({ type: documentType })
      const res = await fetch(`/api/admin/product-documents/batches?${params.toString()}`)
      const data = (await res.json().catch(() => ({}))) as BatchesResponse
      if (!res.ok || data.error) throw new Error(data.error || '批次加载失败')
      const nextBatches = data.batches || []
      setBatches(nextBatches)
      if (selectedBatchId && !nextBatches.some((batch) => batch.id === selectedBatchId)) {
        setSelectedBatchId('')
      } else if (!selectedBatchId && nextBatches.length > 0) {
        const nextBatch = nextBatches.find((batch) => batch.status !== 'archived') || nextBatches[0]
        setSelectedBatchId(nextBatch.id)
      }
    } catch (err: unknown) {
      setBatches([])
      setError(err instanceof Error ? err.message : '批次加载失败')
    } finally {
      setLoadingBatches(false)
    }
  }, [documentType, selectedBatchId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换筛选条件时需要重新拉取文档列表。
    loadDocuments()
  }, [loadDocuments])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换文档类型时刷新批次列表。
    loadBatches()
  }, [loadBatches])

  const createBatch = async (fileCount: number) => {
    const res = await fetch('/api/admin/product-documents/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: documentType,
        title: `${documentType === 'coa' ? 'COA' : '说明书'}批量上传 ${fileCount} 个文件`,
      }),
    })
    const data = await res.json().catch(() => ({} as { batch?: ProductDocumentBatch; error?: string }))
    if (!res.ok || data.error || !data.batch?.id) throw new Error(data.error || '批次创建失败')
    return data.batch
  }

  const markBatchReviewing = async (batchId: string) => {
    const res = await fetch('/api/admin/product-documents/batches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: batchId, action: 'mark_reviewing' }),
    })
    const data = (await res.json().catch(() => ({}))) as BatchActionResponse
    if (!res.ok || data.error) throw new Error(data.error || '批次状态更新失败')
  }

  const recordBatchFailures = async (batchId: string, failures: string[]) => {
    if (failures.length === 0) return
    const res = await fetch('/api/admin/product-documents/batches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_id: batchId,
        action: 'record_failures',
        note: `上传失败文件：\n${failures.join('\n')}`,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as BatchActionResponse
    if (!res.ok || data.error) throw new Error(data.error || '上传失败清单保存失败')
  }

  const handleServerUpload = async (
    file: File,
    batchId: string,
    onRetry?: (message: string) => void
  ) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new NonRetryableUploadError(`${file.name}: 文件 ${formatFileSize(file.size)}，超过 20MB 限制`)
    }
    if (file.size === 0) {
      throw new NonRetryableUploadError(`${file.name}: 文件内容为空，请重新导出或重新选择该 PDF`)
    }

    for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS.length; attempt += 1) {
      try {
        await uploadViaServerFallback(file, batchId, documentType, onRetry)
        return
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '上传失败'
        if (err instanceof NonRetryableUploadError) {
          throw err
        }
        if (isEmptyContentUploadError(message)) {
          throw new NonRetryableUploadError(`${file.name}: 上传内容为空或传输中断，请单独重新选择该文件后重传`)
        }
        const isLastAttempt = attempt >= UPLOAD_RETRY_DELAYS.length
        if (!isLastAttempt) {
          onRetry?.(`${file.name}: ${message}，${attempt + 1}/${UPLOAD_RETRY_DELAYS.length} 次重试`)
          await sleep(UPLOAD_RETRY_DELAYS[attempt])
          continue
        }
        throw new Error(`${file.name}: ${message}`)
      }
    }
  }

  const handleUploadFiles = async (files: FileList | null) => {
    const pdfFiles = Array.from(files || []).filter((file) => file.name.toLowerCase().endsWith('.pdf'))
    if (pdfFiles.length === 0) return

    setUploading(true)
    setError('')
    setUploadSummary('')
    setUploadProgressDetail('')
    let successCount = 0
    const failures: string[] = []
    try {
      const createdBatch = await createBatch(pdfFiles.length)
      setSelectedBatchId(createdBatch.id)

      for (const [index, file] of pdfFiles.entries()) {
        try {
          setUploadSummary(`正在上传：已成功 ${successCount} 个 / 共 ${pdfFiles.length} 个，当前第 ${index + 1} 个`)
          setUploadProgressDetail(`${file.name}: 等待发送到网站服务器`)
          await handleServerUpload(file, createdBatch.id, setUploadProgressDetail)
          successCount += 1
          setUploadSummary(`正在上传：已成功 ${successCount} 个 / 共 ${pdfFiles.length} 个`)
          setUploadProgressDetail(`${file.name}: 已进入后台存储`)
        } catch (err: unknown) {
          failures.push(err instanceof Error ? err.message : `${file.name}: 上传失败`)
          setUploadSummary(`正在上传：已成功 ${successCount} 个 / 共 ${pdfFiles.length} 个，失败 ${failures.length} 个`)
        }
      }
      await markBatchReviewing(createdBatch.id)
      setStatus('all')

      let matchedCount: number | null = null
      let duplicateArchivedCount = 0
      let matchFailedCount = 0
      try {
        const matchRes = await fetch('/api/admin/products/documents/bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentType, limit: 20000, batchId: createdBatch.id }),
        })
        const matchData = await matchRes.json().catch(() => ({} as MatchResponse))
        if (!matchRes.ok || matchData.error) throw new Error(matchData.error || '自动匹配失败')
        matchedCount = matchData.matched ?? 0
        duplicateArchivedCount = matchData.duplicateArchived ?? 0
        matchFailedCount = matchData.failed ?? 0
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '自动匹配失败，请手动点击自动匹配')
      }

      try {
        await recordBatchFailures(createdBatch.id, failures)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '上传失败清单保存失败')
      }

      await loadBatches()
      await loadDocuments({ batchId: createdBatch.id, status: 'all' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadSummary(
        matchedCount == null
          ? `上传完成：成功 ${successCount} 个，失败 ${failures.length} 个。自动匹配未完成，请手动点击自动匹配。`
          : `上传完成：成功 ${successCount} 个，失败 ${failures.length} 个；已自动匹配 ${matchedCount} 个` +
            `${duplicateArchivedCount ? `，前台已有可用说明书的重复文件 ${duplicateArchivedCount} 个` : ''}` +
            `${matchFailedCount ? `，匹配失败 ${matchFailedCount} 个` : ''}。请核对后确认上架。`
      )
      if (failures.length > 0) setError(failures.join('\n'))
      setUploadProgressDetail('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '批量上传失败')
      setUploadSummary(`上传中断：成功 ${successCount} 个，失败 ${failures.length} 个。`)
      setUploadProgressDetail('')
    } finally {
      setUploading(false)
    }
  }

  const handleBind = async () => {
    setMatching(true)
    setError('')
    try {
      const res = await fetch('/api/admin/products/documents/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          limit: 20000,
          batchId: selectedBatchId || undefined,
          includeArchived: status === 'archived' || status === 'all',
        }),
      })
      const data = await res.json().catch(() => ({} as MatchResponse))
      if (!res.ok) throw new Error(data.error || '绑定失败')
      setUploadSummary(
        `自动匹配完成：匹配 ${data.matched ?? 0} 个` +
          `${data.duplicateArchived ? `，前台已有可用说明书的重复文件 ${data.duplicateArchived} 个` : ''}` +
          `${data.failed ? `，失败 ${data.failed} 个` : ''}。请核对文件和商品后确认上架。`
      )
      await loadBatches()
      await loadDocuments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '绑定失败')
    } finally {
      setMatching(false)
    }
  }

  const handleDocumentAction = async (id: string, action: 'confirm' | 'reset' | 'archive' | 'reopen') => {
    setActionDocId(id)
    setError('')
    try {
      const res = await fetch('/api/admin/product-documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json().catch(() => ({} as { error?: string; message?: string }))
      if (!res.ok || data.error) throw new Error(data.error || '操作失败')
      setUploadSummary(data.message || '操作成功')
      await loadBatches()
      await loadDocuments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActionDocId('')
    }
  }

  const handleConfirmExact = async () => {
    if (!selectedBatchId) {
      setError('请先选择一个批次')
      return
    }
    setConfirmingExact(true)
    setError('')
    try {
      const res = await fetch('/api/admin/product-documents/batches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: selectedBatchId, action: 'confirm_exact' }),
      })
      const data = await res.json().catch(() => ({} as { error?: string; message?: string }))
      if (!res.ok || data.error) throw new Error(data.error || '批量确认失败')
      setUploadSummary(data.message || '确认上架完成')
      await loadBatches()
      await loadDocuments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '批量确认失败')
    } finally {
      setConfirmingExact(false)
    }
  }

  const handleRefreshBatch = async () => {
    setError('')
    await loadBatches()
    await loadDocuments()
    if (selectedBatch?.exact_pending) {
      setUploadSummary(
        `状态已刷新：还有 ${selectedBatch.exact_pending} 个文件已匹配但未上架。刷新只读取最新状态，需要点击“一键上架”后前台才会显示。`
      )
    } else {
      setUploadSummary('状态已刷新。')
    }
  }

  const handleShowUnmatched = async () => {
    if (!selectedBatchId) return
    setStatus('unmatched')
    await loadDocuments({ batchId: selectedBatchId, status: 'unmatched' })
  }

  const handleShowRetry = async () => {
    if (!selectedBatchId) return
    setStatus('retry')
    await loadDocuments({ batchId: selectedBatchId, status: 'retry' })
  }

  const handleCopyIssueList = async () => {
    if (!selectedBatchId) {
      setError('请先选择一个批次')
      return
    }

    setError('')

    let batchDocuments = documents
    try {
      const params = new URLSearchParams({ type: documentType, status: 'all', batch_id: selectedBatchId })
      const res = await fetch(`/api/admin/product-documents?${params.toString()}`)
      const data = (await res.json().catch(() => ({}))) as DocumentsResponse
      if (!res.ok || data.error) throw new Error(data.error || '异常清单加载失败')
      batchDocuments = data.documents || []
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '异常清单加载失败')
    }

    const uploadFailureLines = (selectedBatch?.note || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('上传失败文件：'))

    const actionRows = batchDocuments
      .filter((doc) => {
        const note = `${doc.failure_reason || ''} ${doc.review_note || ''} ${doc.match_reason || ''}`
        const isFrontendDuplicate = note.includes('前台已有可用')
        return (
          (isFileRemoved(doc) && !isFrontendDuplicate) ||
          !doc.product_id ||
          doc.match_status === 'failed' ||
          doc.parse_status === 'failed' ||
          note.includes('失败') ||
          note.includes('未找到')
        )
      })
      .map((doc, index) => {
        const reason = doc.failure_reason || doc.review_note || doc.match_reason || '未匹配到产品或文件名需要检查'
        return `${index + 1}. ${doc.file_name || doc.file_url.split('/').pop() || doc.id}\n货号：${doc.catalog_number || '-'}\n原因：${reason}`
      })

    const duplicateRows = batchDocuments
      .filter((doc) => {
        const note = `${doc.failure_reason || ''} ${doc.review_note || ''} ${doc.match_reason || ''}`
        return doc.match_status === 'duplicate' || note.includes('前台已有可用')
      })
      .map((doc, index) => {
        const reason = doc.failure_reason || doc.review_note || doc.match_reason || '前台已有可用说明书，本次重复上传副本已隐藏'
        return `${index + 1}. ${doc.file_name || doc.file_url.split('/').pop() || doc.id}\n货号：${doc.catalog_number || '-'}\n说明：${reason}`
      })

    const report = [
      selectedBatch ? `批次：${selectedBatch.title}` : '批次：未选择',
      `生成时间：${new Date().toLocaleString('zh-CN')}`,
      `批次总数：${selectedBatch?.requested_total || selectedBatch?.total || batchDocuments.length}`,
      `后台记录：${batchDocuments.length}`,
      '',
      '【需要人工处理】',
      actionRows.length > 0 ? actionRows.join('\n\n') : '无',
      '',
      '【上传失败文件】',
      uploadFailureLines.length > 0 ? uploadFailureLines.join('\n') : '无',
      '',
      '【已自动处理的重复文件】',
      duplicateRows.length > 0 ? duplicateRows.join('\n\n') : '无',
    ].join('\n')

    setIssueReport(report)

    const fallbackCopy = (text: string) => {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.readOnly = true
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(textarea)
      return copied
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report)
        setUploadSummary('异常清单已生成并复制；如果剪贴板没有内容，可在下方清单框中手动复制。')
        return
      }
      if (fallbackCopy(report)) {
        setUploadSummary('异常清单已生成并复制；如果剪贴板没有内容，可在下方清单框中手动复制。')
        return
      }
      setUploadSummary('异常清单已生成；浏览器没有开放剪贴板权限，请在下方清单框中手动复制。')
    } catch {
      const copied = fallbackCopy(report)
      setUploadSummary(
        copied
          ? '异常清单已生成并复制；如果剪贴板没有内容，可在下方清单框中手动复制。'
          : '异常清单已生成；浏览器没有开放剪贴板权限，请在下方清单框中手动复制。'
      )
    }
  }

  const handleArchiveBatch = async () => {
    if (!selectedBatchId || !selectedBatch) {
      setError('请先选择一个批次')
      return
    }

    setActionDocId(`batch:${selectedBatchId}`)
    setError('')
    try {
      const res = await fetch('/api/admin/product-documents/batches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: selectedBatchId, action: 'archive_batch' }),
      })
      const data = (await res.json().catch(() => ({}))) as BatchActionResponse
      if (!res.ok || data.error) throw new Error(data.error || '批次撤回失败')
      setUploadSummary(data.message || '本批次已撤回')
      await loadBatches()
      await loadDocuments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '批次撤回失败')
    } finally {
      setActionDocId('')
    }
  }

  const handleReopenBatch = async () => {
    if (!selectedBatchId || !selectedBatch) {
      setError('请先选择一个批次')
      return
    }
    setActionDocId(`reopen-batch:${selectedBatchId}`)
    setError('')
    try {
      const res = await fetch('/api/admin/product-documents/batches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: selectedBatchId, action: 'reopen_batch' }),
      })
      const data = (await res.json().catch(() => ({}))) as BatchActionResponse
      if (!res.ok || data.error) throw new Error(data.error || '批次恢复失败')
      setUploadSummary(data.message || '批次已恢复为待确认')
      setStatus('all')
      await loadBatches()
      await loadDocuments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '批次恢复失败')
    } finally {
      setActionDocId('')
    }
  }

  const getStatusLabel = (doc: ProductDocument) => {
    if (isFileRemoved(doc) && !doc.review_note?.includes('前台已有可用')) return '需重传'
    if (doc.status === 'active') return '已上架'
    if (doc.status === 'archived') return '已隐藏'
    return doc.product_id ? '待上架' : '需重传'
  }

  const getStatusColor = (doc: ProductDocument) => {
    if (isFileRemoved(doc) && !doc.review_note?.includes('前台已有可用')) return 'volcano'
    if (doc.status === 'active') return 'green'
    if (doc.status === 'archived') return 'default'
    return doc.product_id ? 'processing' : 'gold'
  }

  const isFileRemoved = (doc: ProductDocument) => {
    const note = doc.review_note || ''
    return Boolean(
      doc.storage_status === 'deleted' ||
        doc.storage_status === 'missing' ||
        note.includes('文件已从存储删除') ||
        note.includes('重复文件已从存储删除') ||
        note.includes('存储删除') ||
        note.includes('删除存储文件') ||
        note.includes('不能上架或恢复') ||
        note.includes('PDF 文件不存在')
    )
  }

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) || null
  const requestedCount = selectedBatch?.requested_total || selectedBatch?.total || 0
  const uploadedCount = selectedBatch?.upload_success ?? selectedBatch?.total ?? 0
  const uploadFailedCount = selectedBatch?.upload_failed || 0
  const filenameOkCount = selectedBatch?.filename_ok || 0
  const filenameFailedCount = selectedBatch?.filename_failed || 0
  const matchedExactCount = selectedBatch?.matched_exact || 0
  const matchedManualCount = selectedBatch?.matched_manual || 0
  const matchFailedCount = selectedBatch?.match_failed || selectedBatch?.pending_unmatched || 0
  const publishedCount = selectedBatch?.published ?? selectedBatch?.active ?? 0
  const withdrawnCount = selectedBatch?.archived || 0
  const duplicateEffectiveCount = selectedBatch?.duplicate_effective || 0
  const deletedNeedsRetryCount = selectedBatch?.storage_deleted ?? selectedBatch?.deleted_needs_retry ?? 0
  const pendingPublishCount = selectedBatch?.publish_ready ?? selectedBatch?.exact_pending ?? 0
  const frontendVerifiedCount = selectedBatch?.frontend_verified ?? publishedCount
  const canConfirmBatch = Boolean(
    selectedBatchId &&
      selectedBatch &&
      selectedBatch.status !== 'archived' &&
      pendingPublishCount > 0 &&
      !confirmingExact
  )

  const columns: ColumnsType<ProductDocument> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 125,
      render: (value: string) => <span className="text-xs text-slate-500">{formatTime(value)}</span>,
    },
    {
      title: '文件名',
      key: 'file_name',
      render: (_, doc) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-slate-900" title={doc.file_name || doc.file_url}>
            {doc.file_name || doc.file_url.split('/').pop() || '-'}
          </div>
          <div className="mt-1 truncate text-xs text-slate-500">
            货号 {doc.catalog_number || '-'}
            {doc.document_type === 'coa' ? ` / 批次 ${doc.batch_number || '-'}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: '商品',
      key: 'product',
      render: (_, doc) =>
        doc.product ? (
          <div className="min-w-0">
            <div className="truncate text-sm text-cyan-700" title={doc.product.name}>
              {doc.product.name}
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">
              {doc.product.catalog_number || doc.product.cat_no || doc.product.target || '-'}
            </div>
          </div>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    {
      title: '匹配结果',
      key: 'match',
      render: (_, doc) => (
        <div className="min-w-0 text-xs text-slate-500">
          <div className="truncate" title={doc.failure_reason || doc.review_note || doc.match_reason || '等待匹配'}>
            {doc.failure_reason || doc.match_reason || doc.review_note || '等待匹配'}
          </div>
          {doc.review_note && (
            <div className="mt-1 truncate text-amber-600" title={doc.review_note}>
              {doc.review_note}
            </div>
          )}
          {doc.match_score != null && <div className="mt-1">分值 {doc.match_score}</div>}
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 95,
      render: (_, doc) => (
        <Tag
          color={getStatusColor(doc)}
          icon={doc.status === 'active' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
        >
          {getStatusLabel(doc)}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_, doc) => (
        <div className="flex flex-wrap justify-end gap-1">
          {isFileRemoved(doc) ? (
            <Button size="small" disabled icon={<FileExclamationOutlined />}>
              文件已删除
            </Button>
          ) : (
            <Button size="small" icon={<FilePdfOutlined />} href={doc.file_url} target="_blank" rel="noreferrer">
              查看文件
            </Button>
          )}
          {doc.status === 'pending' && doc.product_id && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={actionDocId === doc.id}
              onClick={() => handleDocumentAction(doc.id, 'confirm')}
            >
              上架
            </Button>
          )}
          {doc.status === 'pending' && doc.product_id && (
            <Button
              size="small"
              icon={<RollbackOutlined />}
              disabled={actionDocId === doc.id}
              onClick={() => handleDocumentAction(doc.id, 'reset')}
            >
              取消匹配
            </Button>
          )}
          {doc.status === 'archived' && !isFileRemoved(doc) && (
            <Button
              size="small"
              icon={<RollbackOutlined />}
              loading={actionDocId === doc.id}
              onClick={() => handleDocumentAction(doc.id, 'reopen')}
            >
              恢复
            </Button>
          )}
          {doc.status !== 'archived' && (
            <Button
              size="small"
              icon={<InboxOutlined />}
              disabled={actionDocId === doc.id}
              onClick={() => handleDocumentAction(doc.id, 'archive')}
            >
              撤回
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<FileTextOutlined />}
        title="产品文档管理"
        description="说明书命名：货号-Product name.pdf；COA 命名：货号_批次号_COA.pdf。上传后按货号自动匹配，确认上架后前台可见。"
        extra={
          <Space wrap>
            <Select<DocumentType>
              value={documentType}
              onChange={(value) => setDocumentType(value)}
              style={{ width: 105 }}
              options={[
                { value: 'datasheet', label: '说明书' },
                { value: 'coa', label: 'COA' },
              ]}
            />
            <Select<StatusFilter>
              value={status}
              onChange={(value) => setStatus(value)}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '未上架' },
                { value: 'unmatched', label: '需检查货号' },
                { value: 'retry', label: '需重传' },
                { value: 'active', label: '已上架' },
                { value: 'archived', label: '已隐藏/撤回' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => loadDocuments()}>
              刷新
            </Button>
            <Button
              icon={<ThunderboltOutlined />}
              loading={matching}
              disabled={loading}
              onClick={handleBind}
            >
              自动匹配
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              上传 PDF
            </Button>
          </Space>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => handleUploadFiles(e.currentTarget.files)}
      />

      <Alert
        type="info"
        showIcon
        message={
          <>
            {documentType === 'coa'
              ? 'COA 必须包含货号和批次号，例如 LV10001_20240601_COA.pdf。同一货号可以持续上传不同批次。'
              : '说明书按文件名前缀货号对应商品，例如 LV10001-zebrafish aqp1 Elisa Kit.pdf。同一商品只保留一份当前生效说明书。'}
            <span className="ml-2 text-slate-500">上传后系统会自动匹配货号；确认上架后客户前台才会看到。</span>
          </>
        }
      />

      <Card
        size="small"
        title="批次中心"
        extra={
          <Space wrap>
            <Select
              value={selectedBatchId}
              onChange={(value) => setSelectedBatchId(value)}
              style={{ minWidth: 260 }}
              options={[
                { value: '', label: '全部批次 / 不按批次筛选' },
                ...batches.map((batch) => ({ value: batch.id, label: `${batch.title}（${batch.total} 个）` })),
              ]}
            />
            <Button icon={<ReloadOutlined />} loading={loadingBatches} onClick={handleRefreshBatch}>
              刷新状态
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={confirmingExact}
              disabled={!canConfirmBatch}
              onClick={handleConfirmExact}
            >
              {pendingPublishCount > 0 ? `一键上架 ${pendingPublishCount} 个` : '确认上架前台'}
            </Button>
            <Button icon={<CopyOutlined />} disabled={documents.length === 0} onClick={handleCopyIssueList}>
              复制异常清单
            </Button>
            <Popconfirm
              title="确定撤回本批次吗？"
              description={`确定撤回本批次“${selectedBatch?.title || ''}”吗？该批次文件会从前台下架，后台保留记录；如果上传错了，可以重新上传。`}
              okText="撤回"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={handleArchiveBatch}
            >
              <Button
                danger
                icon={<InboxOutlined />}
                loading={actionDocId === `batch:${selectedBatchId}`}
                disabled={!selectedBatchId || selectedBatch?.status === 'archived'}
              >
                撤回本批次
              </Button>
            </Popconfirm>
            {selectedBatch?.status === 'archived' && (
              <Button
                icon={<RollbackOutlined />}
                loading={actionDocId === `reopen-batch:${selectedBatchId}`}
                disabled={!selectedBatchId}
                onClick={handleReopenBatch}
              >
                恢复本批次
              </Button>
            )}
          </Space>
        }
      >
        <p className="text-xs text-slate-500">当前批次按 6 个模块显示：上传、识别、匹配、上架、错误处理和批次审计。</p>

        {selectedBatch ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <WorkflowModuleCard
              title="模块1 PDF 上传"
              value={`${uploadedCount}/${requestedCount}`}
              detail={uploadFailedCount > 0 ? `${uploadFailedCount} 个上传失败` : '文件已进入后台存储'}
              tone={uploadFailedCount > 0 ? 'warn' : uploadedCount > 0 ? 'ok' : 'muted'}
            />
            <WorkflowModuleCard
              title="模块2 名称识别"
              value={`${filenameOkCount}/${uploadedCount}`}
              detail={filenameFailedCount > 0 ? `${filenameFailedCount} 个文件名需修正` : '货号已从文件名提取'}
              tone={filenameFailedCount > 0 ? 'warn' : uploadedCount > 0 ? 'ok' : 'muted'}
              action={
                filenameFailedCount > 0 ? (
                  <Button type="link" size="small" onClick={handleShowUnmatched}>
                    查看文件名问题
                  </Button>
                ) : null
              }
            />
            <WorkflowModuleCard
              title="模块3 货号匹配"
              value={`${matchedExactCount + matchedManualCount}/${uploadedCount}`}
              detail={matchFailedCount > 0 ? `${matchFailedCount} 个未匹配产品` : '按货号找到产品页面'}
              tone={matchFailedCount > 0 ? 'warn' : uploadedCount > 0 ? 'ok' : 'muted'}
              action={
                matchFailedCount > 0 ? (
                  <Button type="link" size="small" onClick={handleShowUnmatched}>
                    查看未匹配
                  </Button>
                ) : null
              }
            />
            <WorkflowModuleCard
              title="模块4 上架校验"
              value={`${pendingPublishCount}/${uploadedCount}`}
              detail={pendingPublishCount > 0 ? '可确认上架到前台' : '没有待上架文件'}
              tone={pendingPublishCount > 0 ? 'wait' : publishedCount > 0 ? 'ok' : 'muted'}
              action={
                pendingPublishCount > 0 ? (
                  <Button type="link" size="small" disabled={!canConfirmBatch} onClick={handleConfirmExact}>
                    一键上架 {pendingPublishCount} 个
                  </Button>
                ) : null
              }
            />
            <WorkflowModuleCard
              title="模块5 错误处理"
              value={`${deletedNeedsRetryCount}/${uploadedCount}`}
              detail={
                deletedNeedsRetryCount > 0
                  ? '已删除文件需重传'
                  : duplicateEffectiveCount > 0
                    ? `${duplicateEffectiveCount} 个前台已有可用说明书`
                    : '没有需处理文件'
              }
              tone={deletedNeedsRetryCount > 0 ? 'error' : duplicateEffectiveCount > 0 ? 'muted' : 'ok'}
              action={
                deletedNeedsRetryCount > 0 ? (
                  <Button type="link" size="small" onClick={handleShowRetry}>
                    查看需重传
                  </Button>
                ) : null
              }
            />
            <WorkflowModuleCard
              title="模块6 批次审计"
              value={`${frontendVerifiedCount}/${requestedCount}`}
              detail={
                selectedBatch.alert_level === 'high_failure'
                  ? '失败比例偏高'
                  : selectedBatch.status === 'archived'
                    ? `${withdrawnCount} 个已撤回`
                    : selectedBatch.status === 'completed'
                      ? '批次已完成'
                      : '批次处理中'
              }
              tone={selectedBatch.alert_level === 'high_failure' ? 'error' : selectedBatch.status === 'completed' ? 'ok' : 'wait'}
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            系统会默认选择最新批次。选择批次后，可以查看该批次统计并批量确认“货号精确匹配”的文件。
          </p>
        )}

        {selectedBatch && pendingPublishCount > 0 && selectedBatch.status !== 'archived' && (
          <Alert
            className="mt-3"
            type="warning"
            showIcon
            message={`当前批次已有 ${pendingPublishCount} 个文件完成货号精确匹配，但还未上架。请点击右上角“一键上架 ${pendingPublishCount} 个”，完成后前台产品页才会显示说明书。`}
          />
        )}
        {selectedBatch?.alert_level === 'high_failure' && (
          <Alert className="mt-3" type="error" showIcon message="当前批次失败比例超过 20%。建议撤回本批次，修正文件后重新上传。" />
        )}
        {selectedBatch && duplicateEffectiveCount > 0 && (
          <Alert
            className="mt-3"
            type="info"
            showIcon
            message={`当前批次有 ${duplicateEffectiveCount} 个文件和前台已生效说明书重复，系统已自动隐藏这次上传的副本；这些文件不会影响前台。`}
          />
        )}
        {selectedBatch && deletedNeedsRetryCount > 0 && (
          <Alert
            className="mt-3"
            type="error"
            showIcon
            message={`当前批次有 ${deletedNeedsRetryCount} 个文件已从存储删除，不能上架或恢复；请重新上传这些文件。已删除文件会在下方列表中显示“需重传”。`}
          />
        )}
        {selectedBatch && selectedBatch.pending_unmatched > 0 && (
          <Alert
            className="mt-3"
            type="warning"
            showIcon
            message={`当前批次有 ${selectedBatch.pending_unmatched} 个文件没有找到对应货号。`}
            action={
              <Button size="small" onClick={handleShowUnmatched}>
                查看文件
              </Button>
            }
          />
        )}
        {selectedBatch?.note && (
          <Alert className="mt-3" type="error" showIcon message={<span className="whitespace-pre-line">{selectedBatch.note}</span>} />
        )}
      </Card>

      {error && <Alert type="error" showIcon message={<span className="whitespace-pre-line">{error}</span>} />}

      {uploadSummary && (
        <Alert
          type="info"
          showIcon
          message={<span className="whitespace-pre-line">{uploadSummary}</span>}
          description={uploadProgressDetail || undefined}
        />
      )}

      {issueReport && (
        <Card
          size="small"
          title="异常清单"
          extra={
            <Button size="small" onClick={() => setIssueReport('')}>
              关闭
            </Button>
          }
        >
          <Input.TextArea
            readOnly
            value={issueReport}
            rows={12}
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="mt-2 text-xs text-slate-500">
            点击文本框会自动选中全部内容；浏览器不允许自动复制时，可以在这里手动复制。
          </p>
        </Card>
      )}

      <Table<ProductDocument>
        rowKey="id"
        columns={columns}
        dataSource={documents}
        loading={loading}
        locale={{ emptyText: '暂无文档' }}
        pagination={{ pageSize: 50, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 1100 }}
      />
    </div>
  )
}
