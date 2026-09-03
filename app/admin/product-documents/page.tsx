'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Loader2, Upload, Wand2, CheckCircle2, CircleAlert, FileUp, RefreshCw, Undo2, Archive, Copy } from 'lucide-react'

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

function getModuleStyle(tone: 'ok' | 'wait' | 'warn' | 'error' | 'muted') {
  if (tone === 'ok') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  if (tone === 'warn') return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  if (tone === 'error') return 'border-red-500/30 bg-red-500/10 text-red-100'
  if (tone === 'wait') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
  return 'border-slate-700 bg-slate-800/50 text-slate-200'
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
    <div className={`rounded-lg border p-4 ${getModuleStyle(tone)}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-current/80">{title}</div>
        {tone === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 min-h-[32px] text-xs text-current/75">{detail}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
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
    const confirmed = window.confirm(
      `确定撤回本批次“${selectedBatch.title}”吗？该批次文件会从前台下架，后台保留记录；如果上传错了，可以重新上传。`
    )
    if (!confirmed) return

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

  const getStatusStyle = (doc: ProductDocument) => {
    if (isFileRemoved(doc) && !doc.review_note?.includes('前台已有可用')) return 'bg-red-500/10 text-red-300'
    if (doc.status === 'active') return 'bg-emerald-500/10 text-emerald-300'
    if (doc.status === 'archived') return 'bg-slate-500/10 text-slate-300'
    return doc.product_id ? 'bg-cyan-500/10 text-cyan-300' : 'bg-amber-500/10 text-amber-300'
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

  const visibleCount = documents.length
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            产品文档管理
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            说明书命名：货号-Product name.pdf；COA 命名：货号_批次号_COA.pdf。上传后按货号自动匹配，确认上架后前台可见。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
            <option value="datasheet">说明书</option>
            <option value="coa">COA</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
            <option value="all">全部状态</option>
            <option value="pending">未上架</option>
            <option value="unmatched">需检查货号</option>
            <option value="retry">需重传</option>
            <option value="active">已上架</option>
            <option value="archived">已隐藏/撤回</option>
          </select>
          <button onClick={() => loadDocuments()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button onClick={handleBind} disabled={matching || loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50">
            {matching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            自动匹配
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            上传 PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => handleUploadFiles(e.currentTarget.files)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
        {documentType === 'coa'
          ? 'COA 必须包含货号和批次号，例如 LV10001_20240601_COA.pdf。同一货号可以持续上传不同批次。'
          : '说明书按文件名前缀货号对应商品，例如 LV10001-zebrafish aqp1 Elisa Kit.pdf。同一商品只保留一份当前生效说明书。'}
        <span className="ml-2 text-cyan-200">
          上传后系统会自动匹配货号；确认上架后客户前台才会看到。
        </span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">批次中心</h2>
            <p className="mt-1 text-xs text-slate-400">
              当前批次按 6 个模块显示：上传、识别、匹配、上架、错误处理和批次审计。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="min-w-[260px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">全部批次 / 不按批次筛选</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.title}（{batch.total} 个）
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRefreshBatch}
              disabled={loadingBatches}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {loadingBatches ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              刷新状态
            </button>
            <button
              type="button"
              onClick={handleConfirmExact}
              disabled={!canConfirmBatch}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {confirmingExact ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {pendingPublishCount > 0 ? `一键上架 ${pendingPublishCount} 个` : '确认上架前台'}
            </button>
            <button
              type="button"
              onClick={handleCopyIssueList}
              disabled={documents.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              复制异常清单
            </button>
            <button
              type="button"
              onClick={handleArchiveBatch}
              disabled={!selectedBatchId || selectedBatch?.status === 'archived' || actionDocId === `batch:${selectedBatchId}`}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50"
            >
              {actionDocId === `batch:${selectedBatchId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              撤回本批次
            </button>
            {selectedBatch?.status === 'archived' && (
              <button
                type="button"
                onClick={handleReopenBatch}
                disabled={!selectedBatchId || actionDocId === `reopen-batch:${selectedBatchId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
              >
                {actionDocId === `reopen-batch:${selectedBatchId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                恢复本批次
              </button>
            )}
          </div>
        </div>

        {selectedBatch ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
                  <button type="button" onClick={handleShowUnmatched} className="text-xs font-medium underline-offset-2 hover:underline">
                    查看文件名问题
                  </button>
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
                  <button type="button" onClick={handleShowUnmatched} className="text-xs font-medium underline-offset-2 hover:underline">
                    查看未匹配
                  </button>
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
                  <button type="button" onClick={handleConfirmExact} disabled={!canConfirmBatch} className="text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50">
                    一键上架 {pendingPublishCount} 个
                  </button>
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
                  <button type="button" onClick={handleShowRetry} className="text-xs font-medium underline-offset-2 hover:underline">
                    查看需重传
                  </button>
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
          <p className="mt-4 text-xs text-slate-500">
            系统会默认选择最新批次。选择批次后，可以查看该批次统计并批量确认“货号精确匹配”的文件。
          </p>
        )}

        {selectedBatch && pendingPublishCount > 0 && selectedBatch.status !== 'archived' && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            当前批次已有 {pendingPublishCount} 个文件完成货号精确匹配，但还未上架。请点击右上角“一键上架 {pendingPublishCount} 个”，完成后前台产品页才会显示说明书。
          </div>
        )}
        {selectedBatch?.alert_level === 'high_failure' && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            当前批次失败比例超过 20%。建议撤回本批次，修正文件后重新上传。
          </div>
        )}
        {selectedBatch && duplicateEffectiveCount > 0 && (
          <div className="mt-4 rounded-lg border border-slate-600/40 bg-slate-800/60 px-4 py-3 text-sm text-slate-200">
            当前批次有 {duplicateEffectiveCount} 个文件和前台已生效说明书重复，系统已自动隐藏这次上传的副本；这些文件不会影响前台。
          </div>
        )}
        {selectedBatch && deletedNeedsRetryCount > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            当前批次有 {deletedNeedsRetryCount} 个文件已从存储删除，不能上架或恢复；请重新上传这些文件。已删除文件会在下方列表中显示“需重传”。
          </div>
        )}
        {selectedBatch && selectedBatch.pending_unmatched > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            当前批次有 {selectedBatch.pending_unmatched} 个文件没有找到对应货号。
            <button type="button" onClick={handleShowUnmatched} className="ml-2 font-semibold underline underline-offset-2">
              查看文件
            </button>
          </div>
        )}
        {selectedBatch?.note && (
          <div className="mt-4 whitespace-pre-line rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {selectedBatch.note}
          </div>
        )}
      </div>

      {error && (
        <div className="whitespace-pre-line rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {uploadSummary && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
          <div>{uploadSummary}</div>
          {uploadProgressDetail && (
            <div className="mt-2 text-xs leading-5 text-slate-400">
              {uploadProgressDetail}
            </div>
          )}
        </div>
      )}
      {issueReport && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">异常清单</h2>
            <button
              type="button"
              onClick={() => setIssueReport('')}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              关闭
            </button>
          </div>
          <textarea
            readOnly
            value={issueReport}
            className="h-80 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-200 outline-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="mt-2 text-xs text-slate-500">
            点击文本框会自动选中全部内容；浏览器不允许自动复制时，可以在这里手动复制。
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-slate-800 bg-slate-950 px-4 py-3 text-xs font-medium text-slate-400">
          <div className="col-span-2">时间</div>
          <div className="col-span-3">文件名</div>
          <div className="col-span-2">商品</div>
          <div className="col-span-2">匹配结果</div>
          <div className="col-span-1">状态</div>
          <div className="col-span-2 text-right">操作</div>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">加载中...</div>
        ) : visibleCount === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">暂无文档</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {documents.map((doc) => (
              <div key={doc.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm text-slate-200">
                <div className="col-span-2 text-xs text-slate-400">{formatTime(doc.created_at)}</div>
                <div className="col-span-3 min-w-0">
                  <div className="truncate" title={doc.file_name || doc.file_url}>{doc.file_name || doc.file_url.split('/').pop() || '-'}</div>
                  <div className="mt-1 truncate text-[11px] text-slate-500">
                    货号 {doc.catalog_number || '-'}
                    {doc.document_type === 'coa' ? ` / 批次 ${doc.batch_number || '-'}` : ''}
                  </div>
                </div>
                <div className="col-span-2 min-w-0">
                  {doc.product ? (
                    <>
                      <div className="truncate text-cyan-300" title={doc.product.name}>{doc.product.name}</div>
                      <div className="mt-1 truncate text-[11px] text-slate-500">
                        {doc.product.catalog_number || doc.product.cat_no || doc.product.target || '-'}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </div>
                <div className="col-span-2 text-xs text-slate-400">
                  <div className="truncate" title={doc.failure_reason || doc.review_note || doc.match_reason || '等待匹配'}>
                    {doc.failure_reason || doc.match_reason || doc.review_note || '等待匹配'}
                  </div>
                  {doc.review_note && <div className="mt-1 truncate text-[11px] text-amber-300" title={doc.review_note}>{doc.review_note}</div>}
                  {doc.match_score != null && <div className="mt-1 text-[11px] text-slate-500">分值 {doc.match_score}</div>}
                </div>
                <div className="col-span-1">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${getStatusStyle(doc)}`}>
                    {doc.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <CircleAlert className="w-3 h-3" />}
                    {getStatusLabel(doc)}
                  </span>
                </div>
                <div className="col-span-2 flex flex-wrap justify-end gap-1">
                  {isFileRemoved(doc) ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-500">
                      <FileUp className="w-3.5 h-3.5" />
                      文件已删除
                    </span>
                  ) : (
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                      <FileUp className="w-3.5 h-3.5" />
                      查看文件
                    </a>
                  )}
                  {doc.status === 'pending' && doc.product_id && (
                    <button
                      type="button"
                      disabled={actionDocId === doc.id}
                      onClick={() => handleDocumentAction(doc.id, 'confirm')}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                    >
                      {actionDocId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      上架
                    </button>
                  )}
                  {doc.status === 'pending' && doc.product_id && (
                    <button
                      type="button"
                      disabled={actionDocId === doc.id}
                      onClick={() => handleDocumentAction(doc.id, 'reset')}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-2 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      取消匹配
                    </button>
                  )}
                  {doc.status === 'archived' && !isFileRemoved(doc) && (
                    <button
                      type="button"
                      disabled={actionDocId === doc.id}
                      onClick={() => handleDocumentAction(doc.id, 'reopen')}
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
                    >
                      {actionDocId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                      恢复
                    </button>
                  )}
                  {doc.status !== 'archived' && (
                    <button
                      type="button"
                      disabled={actionDocId === doc.id}
                      onClick={() => handleDocumentAction(doc.id, 'archive')}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      撤回
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
