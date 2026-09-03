'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, ImagePlus, Loader2, Upload } from 'lucide-react'
import { getPurchasePointProductLabel, getPurchasePointProductOption, PURCHASE_POINT_PRODUCT_OPTIONS } from '@/lib/purchase-points'

const PHOTO_TYPE_OPTIONS = [
  { value: 'product_front', label: '产品正面照片' },
  { value: 'catalog_batch', label: '货号/批号位置' },
  { value: 'outer_package', label: '外包装照片' },
  { value: 'usage_scene', label: '使用场景照片' },
  { value: 'other', label: '其他照片' },
]

const CHANNEL_OPTIONS = ['代理商购买', '直营网店/官方渠道', '经销商推荐', '展会/活动', '其他']

const STATUS_LABELS: Record<string, string> = {
  pending: '审核中',
  needs_more_info: '需补充资料',
  approved: '已通过',
  rejected: '已拒绝',
  archived: '已归档',
}

interface ClaimPhoto {
  id: string
  photo_type: string
  file_url: string
}

interface PurchasePointClaim {
  id: string
  product_type: string
  product_spec: string
  point_code: string
  catalog_number: string | null
  batch_number: string | null
  total_points: number
  status: string
  review_note: string | null
  rejection_reason: string | null
  created_at: string
  purchase_point_claim_photos?: ClaimPhoto[]
}

interface ClaimsResponse {
  claims?: PurchasePointClaim[]
  error?: string
}

interface SubmitResponse {
  error?: string
  message?: string
  expectedPoints?: number
}

function productLabel(type: string) {
  return getPurchasePointProductLabel(type)
}

function statusClass(status: string) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'needs_more_info') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

export default function PurchasePointsPage() {
  const [productType, setProductType] = useState('elisa')
  const [productSpec, setProductSpec] = useState('96T')
  const [catalogNumber, setCatalogNumber] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [purchaseChannel, setPurchaseChannel] = useState(CHANNEL_OPTIONS[0])
  const [notes, setNotes] = useState('')
  const [photoConsent, setPhotoConsent] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [photoTypes, setPhotoTypes] = useState<string[]>(['product_front'])
  const [claims, setClaims] = useState<PurchasePointClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const currentProduct = getPurchasePointProductOption(productType)

  const loadClaims = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/purchase-points/claims')
      const data = await res.json().catch(() => ({})) as ClaimsResponse
      if (!res.ok || data.error) {
        setError(data.error || '积分申请记录加载失败')
        setClaims([])
        return
      }
      setClaims(data.claims || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '积分申请记录加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次申请记录请求。
    loadClaims()
  }, [loadClaims])

  function handleTypeChange(nextType: string) {
    const nextProduct = getPurchasePointProductOption(nextType)
    setProductType(nextType)
    setProductSpec(nextProduct.specs[0])
  }

  function handleFileChange(nextFiles: FileList | null) {
    const selected = Array.from(nextFiles || []).slice(0, 3)
    setFiles(selected)
    setPhotoTypes(selected.map((_, index) => photoTypes[index] || (index === 0 ? 'product_front' : 'other')))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!catalogNumber.trim()) {
      setError('请填写产品货号')
      return
    }
    if (!batchNumber.trim()) {
      setError('请填写产品批号')
      return
    }
    if (files.length === 0) {
      setError('请至少上传 1 张商品照片')
      return
    }

    const formData = new FormData()
    formData.append('product_type', productType)
    formData.append('product_spec', productSpec)
    formData.append('catalog_number', catalogNumber)
    formData.append('batch_number', batchNumber)
    formData.append('purchase_channel', purchaseChannel)
    formData.append('notes', notes)
    formData.append('photo_consent', String(photoConsent))
    files.forEach((file, index) => {
      formData.append('photos', file)
      formData.append('photo_types', photoTypes[index] || 'other')
    })

    setSubmitting(true)
    try {
      const res = await fetch('/api/purchase-points/claims', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({})) as SubmitResponse
      if (!res.ok || data.error) {
        setError(data.error || '提交失败')
        return
      }
      setMessage(data.message || `提交成功，预计可获得 ${data.expectedPoints || 0} 积分。`)
      setCatalogNumber('')
      setBatchNumber('')
      setNotes('')
      setFiles([])
      setPhotoTypes(['product_front'])
      await loadClaims()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '网络或服务器错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/member" className="text-xs text-slate-500 hover:text-blue-600">返回会员中心</Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">购买积分申请</h1>
            <p className="text-sm text-slate-500 mt-1">填写货号、批号并上传商品照片，管理员审核通过后积分自动到账。</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">产品类型</label>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {PURCHASE_POINT_PRODUCT_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleTypeChange(item.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    productType === item.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">规格</label>
              <select
                value={productSpec}
                onChange={(event) => setProductSpec(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {currentProduct.specs.map((spec) => (
                  <option key={spec} value={spec}>{spec === 'default' ? '默认规格' : spec}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">货号</label>
              <input
                value={catalogNumber}
                onChange={(event) => setCatalogNumber(event.target.value)}
                placeholder="例如 LV10001M 或 LV10001S"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">批号</label>
              <input
                value={batchNumber}
                onChange={(event) => setBatchNumber(event.target.value)}
                placeholder="请输入产品标签或瓶身上的批号"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">购买渠道（选填）</label>
              <select
                value={purchaseChannel}
                onChange={(event) => setPurchaseChannel(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {CHANNEL_OPTIONS.map((channel) => (
                  <option key={channel} value={channel}>{channel}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">商品照片</label>
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:border-blue-400">
              <ImagePlus className="w-6 h-6 text-slate-400" />
              <span className="mt-2 text-sm font-medium text-slate-700">上传至少 1 张，最多 3 张</span>
              <span className="mt-1 text-xs text-slate-500">建议拍清产品标签上的货号和批号，可帮助管理员更快审核</span>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={(event) => handleFileChange(event.target.files)}
                className="hidden"
              />
            </label>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_160px]">
                    <div className="min-w-0 text-sm text-slate-700 truncate">{file.name}</div>
                    <select
                      value={photoTypes[index] || 'other'}
                      onChange={(event) => {
                        setPhotoTypes((prev) => {
                          const next = [...prev]
                          next[index] = event.target.value
                          return next
                        })
                      }}
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                    >
                      {PHOTO_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">备注（选填）</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="例如购买时间、代理商名称、特殊情况说明"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={photoConsent}
              onChange={(event) => setPhotoConsent(event.target.checked)}
              className="mt-1"
            />
            <span>同意爱萌优宁在审核和活动展示中使用我上传的商品照片。未勾选也可以正常申请积分。</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {message && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            提交积分申请
          </button>
        </form>

        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">我的申请记录</h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : claims.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">暂无购买积分申请</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {claims.map((claim) => (
                <div key={claim.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {productLabel(claim.product_type)} · {claim.product_spec || '默认规格'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        货号 {claim.catalog_number || '-'} · 批号 {claim.batch_number || '-'} · {new Date(claim.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusClass(claim.status)}`}>
                      {STATUS_LABELS[claim.status] || claim.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    预计积分 {claim.total_points}
                  </div>
                  {(claim.review_note || claim.rejection_reason) && (
                    <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {claim.rejection_reason || claim.review_note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
