'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Image as ImageIcon, Loader2, UploadCloud, X } from 'lucide-react'

interface MatchedProduct {
  id: string
  cat_no: string
  name: string
  species: string
  target: string
}

interface CitationUploadedFile {
  file_url: string
  file_name: string
  file_type: string
  file_hash: string
  file_path: string
  file_size: number
}

interface CitationExtractionFormResult {
  title?: string
  authors?: string
  affiliation?: string
  doi?: string
  journal?: string
  publication_year?: string
  evidence_text?: string
  product_cat_no?: string[] | string
  matched_if?: number | null
  confidence?: number
  files?: CitationUploadedFile[]
  [key: string]: unknown
}

const MAX_CITATION_FILE_SIZE = 20 * 1024 * 1024
const MAX_CITATION_FILE_SIZE_MB = 20
const MAX_SCREENSHOT_FILES = 4

function createInitialForm() {
  return {
    product_cat_no: '',
    title: '',
    authors: '',
    affiliation: '',
    doi: '',
    journal: '',
    publication_year: '',
    abstract: '',
    evidence_text: '',
    file_url: '',
    file_name: '',
    file_type: '',
    file_hash: '',
    file_path: '',
    file_size: 0,
    extraction_result: null as CitationExtractionFormResult | null,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

export default function CitationSubmitPage() {
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [sizeDialog, setSizeDialog] = useState<{ fileName?: string; sizeMb?: string } | null>(null)
  const [extractMessage, setExtractMessage] = useState('')
  const [showOptional, setShowOptional] = useState(false)

  const [productQuery, setProductQuery] = useState('')
  const [matchedProducts, setMatchedProducts] = useState<MatchedProduct[]>([])
  const [showMatches, setShowMatches] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<MatchedProduct | null>(null)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [citationFiles, setCitationFiles] = useState<CitationUploadedFile[]>([])

  const [form, setForm] = useState(createInitialForm())

  const matchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (matchRef.current && !matchRef.current.contains(e.target as Node)) {
        setShowMatches(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchMatches = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setMatchedProducts([])
      setShowMatches(false)
      return
    }
    setLoadingMatches(true)
    try {
      const res = await fetch(`/api/products/match?query=${encodeURIComponent(query)}`)
      const data = await res.json()
      setMatchedProducts(data.products || [])
      setShowMatches((data.products || []).length > 0)
    } catch {
      setMatchedProducts([])
    } finally {
      setLoadingMatches(false)
    }
  }, [])

  function handleProductInputChange(value: string) {
    setProductQuery(value)
    setSelectedProduct(null)
    setForm((prev) => ({ ...prev, product_cat_no: value }))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchMatches(value)
    }, 250)
  }

  function handleSelectProduct(product: MatchedProduct) {
    setSelectedProduct(product)
    setProductQuery(`${product.cat_no} - ${product.name}`)
    setForm((prev) => ({ ...prev, product_cat_no: product.cat_no }))
    setShowMatches(false)
  }

  const syncPrimaryFile = useCallback((files: CitationUploadedFile[]) => {
    const first = files[0]
    setCitationFiles(files)
    setForm((prev) => ({
      ...prev,
      file_url: first?.file_url || '',
      file_name: first?.file_name || '',
      file_type: first?.file_type || '',
      file_hash: first?.file_hash || '',
      file_path: first?.file_path || '',
      file_size: first?.file_size || 0,
    }))
  }, [])

  const extractFromFiles = useCallback(async (override?: CitationUploadedFile[]) => {
    const targetFiles = override || citationFiles
    if (targetFiles.length === 0) {
      setError('请先上传文献文件。')
      return
    }
    setExtracting(true)
    setError('')
    setExtractMessage('')
    try {
      const res = await fetch('/api/citations/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: targetFiles.map((file) => ({
            file_url: file.file_url,
            file_type: file.file_type,
            file_name: file.file_name,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '识别失败')
      const result = (data.result || {}) as CitationExtractionFormResult
      const catNos = Array.isArray(result.product_cat_no) ? result.product_cat_no.join(', ') : ''
      setForm((prev) => ({
        ...prev,
        product_cat_no: catNos || prev.product_cat_no,
        title: result.title || prev.title,
        authors: result.authors || prev.authors,
        affiliation: result.affiliation || prev.affiliation,
        doi: result.doi || prev.doi,
        journal: result.journal || prev.journal,
        publication_year: result.publication_year || prev.publication_year,
        evidence_text: result.evidence_text || prev.evidence_text,
        extraction_result: {
          ...result,
          files: targetFiles,
        },
      }))
      if (catNos) setProductQuery(catNos)
      const ifMessage = result.matched_if
        ? `，已匹配期刊 IF ${result.matched_if}`
        : '，暂未匹配到期刊 IF'
      setExtractMessage(`已识别候选信息，可信度 ${Math.round((result.confidence || 0) * 100)}%${ifMessage}。请快速核对后提交。`)
      setShowOptional(true)
    } catch (err: unknown) {
      const message = getErrorMessage(err, '识别失败')
      const firstFileType = targetFiles[0]?.file_type || ''
      setExtractMessage(firstFileType === 'application/pdf'
        ? message
        : `${message} 文件已经保存，您可以继续提交等待后台审核。`)
      if (!message.includes('文件已经保存') && !message.includes('额度')) {
        setError(message)
      }
    } finally {
      setExtracting(false)
    }
  }, [citationFiles])

  async function uploadOneCitationFile(file: File): Promise<CitationUploadedFile> {
    if (file.size > MAX_CITATION_FILE_SIZE) {
      setSizeDialog({
        fileName: file.name,
        sizeMb: (file.size / 1024 / 1024).toFixed(1),
      })
      throw new Error('文件超过上传限制')
    }

    const body = new FormData()
    body.append('file', file)
    const res = await fetch('/api/citations/upload', { method: 'POST', body })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || '上传失败')

    return {
      file_url: data.url,
      file_name: data.fileName,
      file_type: data.fileType,
      file_hash: data.fileHash,
      file_path: data.path,
      file_size: data.size,
    }
  }

  async function uploadCitationFiles(fileList: FileList) {
    const files = Array.from(fileList)
    if (files.length === 0) return

    const pdfFiles = files.filter((file) => file.type === 'application/pdf')
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    const hasUnsupported = files.some((file) => !file.type.startsWith('image/') && file.type !== 'application/pdf')

    if (hasUnsupported) {
      setError('仅支持 PDF、PNG、JPG、WebP 文件。')
      return
    }
    if (pdfFiles.length > 0 && files.length > 1) {
      setError('PDF 请单独上传；如果使用截图，请一次选择 2-4 张图片，不要和 PDF 混合上传。')
      return
    }
    if (imageFiles.length > MAX_SCREENSHOT_FILES) {
      setError(`截图最多一次上传 ${MAX_SCREENSHOT_FILES} 张。建议上传论文首页和产品证据页。`)
      return
    }
    const oversizedFile = files.find((file) => file.size > MAX_CITATION_FILE_SIZE)
    if (oversizedFile) {
      setSizeDialog({
        fileName: oversizedFile.name,
        sizeMb: (oversizedFile.size / 1024 / 1024).toFixed(1),
      })
      return
    }

    setUploading(true)
    setError('')
    try {
      const uploadedFiles = []
      for (const file of files) {
        uploadedFiles.push(await uploadOneCitationFile(file))
      }
      syncPrimaryFile(uploadedFiles)
      setExtractMessage(
        imageFiles.length > 0
          ? `已上传 ${uploadedFiles.length} 张截图，正在合并识别论文信息和产品证据...`
          : 'PDF 已上传，正在尝试智能识别；如识别不到，管理员会打开文件审核。'
      )
      await extractFromFiles(uploadedFiles)
    } catch (err: unknown) {
      const message = getErrorMessage(err, '上传失败')
      if (message === '文件超过上传限制') {
        return
      }
      if (message.includes('FormData') || message.includes('body') || message.includes('超过')) {
        const firstFile = files[0]
        setSizeDialog({
          fileName: firstFile?.name,
          sizeMb: firstFile ? (firstFile.size / 1024 / 1024).toFixed(1) : undefined,
        })
      } else {
        setError(message)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/citations/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          files: citationFiles,
          extraction_result: {
            ...(form.extraction_result || {}),
            files: citationFiles,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '提交失败')
      setSuccess('提交成功！文献已进入后台审核，审核通过后会按期刊 IF 一次性发放积分。')
      setForm(createInitialForm())
      setCitationFiles([])
      setProductQuery('')
      setSelectedProduct(null)
      setShowOptional(false)
    } catch (err: unknown) {
      setError(getErrorMessage(err, '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {sizeDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="text-center text-lg font-bold text-gray-900">文件超过上传限制</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              当前文件{sizeDialog.fileName ? `「${sizeDialog.fileName}」` : ''}约 {sizeDialog.sizeMb || '超过'} MB，
              网站目前支持单个文件最大 {MAX_CITATION_FILE_SIZE_MB} MB。
            </p>
            <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              建议把文献有效页面截图后上传图片格式：论文题目页、期刊名称页，以及出现 ELISA、LV货号、Animalunion 或 Aimeng Uning 的产品证据页。
            </div>
            <button
              type="button"
              onClick={() => setSizeDialog(null)}
              className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/user/citations" className="text-blue-600 hover:underline text-sm">
            ← 我的文献
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">提交引用文献</h1>
          <p className="text-sm text-gray-500 mb-6">
            提交使用爱萌产品的 SCI 论文，审核通过后可获得高额积分奖励
          </p>

          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-blue-600">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">上传文献 PDF 或文献页面截图</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        推荐上传完整 PDF；如果用截图，建议一次选择 2 张：论文首页 + 出现 ELISA、货号、品牌的实验材料页。系统会合并识别一次。
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {uploading ? '上传中...' : '选择文件'}
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        multiple
                        disabled={uploading}
                        onChange={(e) => {
                          if (e.target.files?.length) uploadCitationFiles(e.target.files)
                          e.target.value = ''
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {citationFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="space-y-2">
                        {citationFiles.map((file, index) => (
                          <div key={`${file.file_hash}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                              {file.file_type === 'application/pdf' ? (
                                <FileText className="h-4 w-4 shrink-0 text-red-500" />
                              ) : (
                                <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />
                              )}
                              <a href={file.file_url} target="_blank" rel="noreferrer" className="truncate text-blue-600 hover:underline">
                                {citationFiles.length > 1 ? `截图 ${index + 1}：` : ''}{file.file_name || '已上传文件'}
                              </a>
                            </div>
                            <span className="shrink-0 text-xs text-gray-400">
                              {(file.file_size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => extractFromFiles()}
                          disabled={extracting}
                          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                        >
                          {extracting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {extracting ? '识别中...' : '重新智能识别'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            syncPrimaryFile([])
                            setForm({ ...form, file_url: '', file_name: '', file_type: '', file_hash: '', file_path: '', file_size: 0, extraction_result: null })
                            setExtractMessage('')
                            setError('')
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          清空文件
                        </button>
                        {extractMessage && <span className="text-xs text-blue-700">{extractMessage}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Product - Smart Input */}
            <div ref={matchRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                产品货号（系统识别结果，可补充修正）
              </label>
              <input
                value={productQuery}
                onChange={(e) => handleProductInputChange(e.target.value)}
                onFocus={() => {
                  if (matchedProducts.length > 0) setShowMatches(true)
                }}
                placeholder="可填写多个货号，如 LV30229, LV30536, LV30253"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
              />
              {loadingMatches && (
                <div className="absolute right-3 top-[2.1rem]">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Match dropdown */}
              {showMatches && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
                  {matchedProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors border-b last:border-b-0 border-gray-100"
                    >
                      <span className="shrink-0 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono font-medium">
                        {p.cat_no}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-900 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400">
                          {p.species} · {p.target}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedProduct && (
                <div className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  已选择: {selectedProduct.cat_no}
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                论文题目（系统识别结果，可补充修正）
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                placeholder="论文完整标题"
              />
            </div>

            {/* Journal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                期刊名称（用于匹配 IF 积分）
              </label>
              <input
                value={form.journal}
                onChange={(e) => setForm({ ...form, journal: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                placeholder="期刊名称"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DOI
              </label>
              <input
                value={form.doi}
                onChange={(e) => setForm({ ...form, doi: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                placeholder="可选；如 10.1136/jitc-2024-010908"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                发表单位 / 研究单位（系统识别结果，可补充修正）
              </label>
              <input
                value={form.affiliation}
                onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                placeholder="例如 上海交通大学 / Shanghai Jiao Tong University"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                作者（可选，后台留痕）
              </label>
              <input
                value={form.authors}
                onChange={(e) => setForm({ ...form, authors: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                placeholder="可选；公开页面优先展示发表单位，不展示长作者名单"
              />
            </div>

            {/* Optional fields toggle */}
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {showOptional ? '收起可选项' : '+ 添加更多信息（摘要、发表年份、证据片段）'}
            </button>

            {showOptional && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">发表年份</label>
                    <input
                      value={form.publication_year}
                      onChange={(e) => setForm({ ...form, publication_year: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                      placeholder="2024"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">论文摘要</label>
                  <textarea
                    value={form.abstract}
                    onChange={(e) => setForm({ ...form, abstract: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                    placeholder="论文摘要（可选）"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">文献中出现货号/品牌的原文片段</label>
                  <textarea
                    value={form.evidence_text}
                    onChange={(e) => setForm({ ...form, evidence_text: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                    placeholder="可选；例如 ELISA kits (Animalunion Biotechnology, LV30229...)"
                  />
                </div>
              </div>
            )}

            {/* Points rules */}
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">积分奖励规则（审核通过后一次性发放）：</p>
              <ul className="space-y-1 text-blue-700">
                <li>
                  IF &lt; 5 → 500分 | 5-10 → 800分 | 10-20 → 1200分 | ≥20 → 1500分
                </li>
                <li>重复提交、无效文件、无法证明使用爱萌产品的文献不发放积分。</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={submitting || uploading || extracting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {submitting ? '提交中...' : uploading ? '文件上传中...' : extracting ? '文献识别中...' : '提交文献'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
