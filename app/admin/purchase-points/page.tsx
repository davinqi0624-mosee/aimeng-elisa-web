'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Ticket,
  Trash2,
  XCircle,
} from 'lucide-react'
import { getPurchasePointProductLabel, PURCHASE_POINT_PRODUCT_OPTIONS } from '@/lib/purchase-points'

const STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'needs_more_info', label: '需补充' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'archived', label: '已归档' },
  { value: 'all', label: '全部' },
]

interface ClaimPhoto {
  id: string
  photo_type: string
  file_url: string
  file_name: string | null
  file_hash: string
  storage_status: string
}

interface ClaimProfile {
  full_name?: string | null
}

interface DuplicateWarning {
  type?: string
  message?: string
  file_hash?: string
  claim_id?: string
}

interface PurchasePointClaim {
  id: string
  user_id: string
  product_type: string
  product_spec: string
  point_code: string
  catalog_number: string | null
  batch_number: string | null
  purchase_channel: string | null
  notes: string | null
  photo_consent: boolean
  base_points: number
  campaign_name: string | null
  campaign_bonus_points: number
  photo_bonus_points: number
  total_points: number
  duplicate_warnings: DuplicateWarning[]
  status: string
  review_note: string | null
  rejection_reason: string | null
  created_at: string
  profiles: ClaimProfile | null
  purchase_point_claim_photos?: ClaimPhoto[]
}

interface PointRule {
  id: string
  product_type: string
  product_spec: string
  points: number
  is_active: boolean
  sort_order: number
}

interface Campaign {
  id: string
  name: string
  product_types: string[]
  product_specs: string[]
  multiplier: number
  bonus_points: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

interface ClaimsResponse {
  claims?: PurchasePointClaim[]
  error?: string
}

interface RulesResponse {
  rules?: PointRule[]
  error?: string
}

interface CampaignsResponse {
  campaigns?: Campaign[]
  error?: string
}

interface ActionResponse {
  error?: string
  message?: string
  pointsAwarded?: number
}

function productLabel(type: string) {
  return getPurchasePointProductLabel(type)
}

function statusClass(status: string) {
  if (status === 'approved') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
  if (status === 'rejected') return 'bg-red-500/10 text-red-300 border-red-500/30'
  if (status === 'needs_more_info') return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
  if (status === 'archived') return 'bg-slate-700 text-slate-300 border-slate-600'
  return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function profileName(profile: ClaimProfile | null, userId: string) {
  return profile?.full_name || userId.slice(0, 8)
}

function isGeneratedProductCredential(value: string) {
  return value.startsWith('CATBATCH:')
}

function productDefaultSpec(type: string) {
  return PURCHASE_POINT_PRODUCT_OPTIONS.find((item) => item.value === type)?.specs[0] || 'default'
}

function productDefaultPoints(type: string) {
  return PURCHASE_POINT_PRODUCT_OPTIONS.find((item) => item.value === type)?.defaultPoints || 50
}

export default function AdminPurchasePointsPage() {
  const [status, setStatus] = useState('pending')
  const [claims, setClaims] = useState<PurchasePointClaim[]>([])
  const [rules, setRules] = useState<PointRule[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reviewForms, setReviewForms] = useState<Record<string, { photoBonus: string; note: string; rejectReason: string }>>({})
  const [ruleForm, setRuleForm] = useState({ product_type: 'elisa', product_spec: '96T', points: '50', sort_order: '10' })
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    product_types: '',
    product_specs: '',
    multiplier: '1',
    bonus_points: '0',
    starts_at: '',
    ends_at: '',
  })

  const loadClaims = useCallback(async () => {
    const res = await fetch(`/api/admin/purchase-points/claims?status=${status}`)
    const data = await res.json().catch(() => ({})) as ClaimsResponse
    if (!res.ok || data.error) throw new Error(data.error || '购买积分申请加载失败')
    const nextClaims = data.claims || []
    setClaims(nextClaims)
    setReviewForms(Object.fromEntries(nextClaims.map((claim) => [
      claim.id,
      {
        photoBonus: String(claim.photo_bonus_points || 0),
        note: claim.review_note || '',
        rejectReason: claim.rejection_reason || '',
      },
    ])))
  }, [status])

  const loadMeta = useCallback(async () => {
    const [rulesRes, campaignsRes] = await Promise.all([
      fetch('/api/admin/purchase-points/rules'),
      fetch('/api/admin/purchase-points/campaigns'),
    ])
    const [rulesData, campaignsData] = await Promise.all([
      rulesRes.json().catch(() => ({})) as Promise<RulesResponse>,
      campaignsRes.json().catch(() => ({})) as Promise<CampaignsResponse>,
    ])
    if (!rulesRes.ok || rulesData.error) throw new Error(rulesData.error || '积分规则加载失败')
    if (!campaignsRes.ok || campaignsData.error) throw new Error(campaignsData.error || '活动规则加载失败')
    setRules(rulesData.rules || [])
    setCampaigns(campaignsData.campaigns || [])
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadClaims(), loadMeta()])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [loadClaims, loadMeta])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发后台数据请求。
    loadAll()
  }, [loadAll])

  function updateReviewForm(id: string, patch: Partial<{ photoBonus: string; note: string; rejectReason: string }>) {
    setReviewForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function claimAction(claim: PurchasePointClaim, action: string) {
    const form = reviewForms[claim.id] || { photoBonus: '0', note: '', rejectReason: '' }
    if (action === 'approve' && !confirm(`确认通过并发放 ${Number(claim.base_points) + Number(claim.campaign_bonus_points) + (Number(form.photoBonus) || 0)} 积分？`)) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/admin/purchase-points/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          claimId: claim.id,
          photo_bonus_points: Number(form.photoBonus) || 0,
          review_note: form.note,
          rejection_reason: form.rejectReason,
        }),
      })
      const data = await res.json().catch(() => ({})) as ActionResponse
      if (!res.ok || data.error) throw new Error(data.error || '操作失败')
      setMessage(data.pointsAwarded ? `${data.message}，已发放 ${data.pointsAwarded} 积分。` : (data.message || '操作成功'))
      await loadAll()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSaving(false)
    }
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/purchase-points/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ruleForm,
          points: Number(ruleForm.points) || 0,
          sort_order: Number(ruleForm.sort_order) || 0,
        }),
      })
      const data = await res.json().catch(() => ({})) as ActionResponse
      if (!res.ok || data.error) throw new Error(data.error || '规则保存失败')
      setMessage('基础规则已保存')
      await loadMeta()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '规则保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/purchase-points/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campaignForm,
          product_types: campaignForm.product_types.split(',').map((item) => item.trim()).filter(Boolean),
          product_specs: campaignForm.product_specs.split(',').map((item) => item.trim()).filter(Boolean),
          multiplier: Number(campaignForm.multiplier) || 1,
          bonus_points: Number(campaignForm.bonus_points) || 0,
        }),
      })
      const data = await res.json().catch(() => ({})) as ActionResponse
      if (!res.ok || data.error) throw new Error(data.error || '活动保存失败')
      setCampaignForm({ name: '', product_types: '', product_specs: '', multiplier: '1', bonus_points: '0', starts_at: '', ends_at: '' })
      setMessage('活动规则已保存')
      await loadMeta()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '活动保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(kind: 'rules' | 'campaigns', id: string) {
    if (!confirm('确认删除？')) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/admin/purchase-points/${kind}?id=${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as ActionResponse
      if (!res.ok || data.error) throw new Error(data.error || '删除失败')
      setMessage('已删除')
      await loadMeta()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            <Ticket className="w-5 h-5" />
            <span className="text-sm font-medium">会员积分</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-white">购买积分审核</h1>
          <p className="mt-1 text-sm text-slate-400">审核货号、批号、商品照片和重复风险，通过后自动写入积分流水。</p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {(error || message) && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
          error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        }`}>
          {error ? <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0" />}
          {error || message}
        </div>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <h2 className="font-semibold text-white">申请审核</h2>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((item) => (
              <button
                key={item.value}
                onClick={() => setStatus(item.value)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  status === item.value ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : claims.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">当前没有需要处理的购买积分申请</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {claims.map((claim) => {
              const form = reviewForms[claim.id] || { photoBonus: '0', note: '', rejectReason: '' }
              const duplicateWarnings = Array.isArray(claim.duplicate_warnings) ? claim.duplicate_warnings : []
              const totalPreview = Number(claim.base_points) + Number(claim.campaign_bonus_points) + (Number(form.photoBonus) || 0)
              return (
                <article key={claim.id} className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{productLabel(claim.product_type)} · {claim.product_spec}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(claim.status)}`}>{claim.status}</span>
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                          {isGeneratedProductCredential(claim.point_code) ? '货号批号凭证' : `历史积分码 ${claim.point_code}`}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        客户 {profileName(claim.profiles, claim.user_id)} · {formatDate(claim.created_at)}
                      </div>
                      <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
                        <span>货号: {claim.catalog_number || '-'}</span>
                        <span>批号: {claim.batch_number || '-'}</span>
                        <span>渠道: {claim.purchase_channel || '-'}</span>
                        <span>照片授权: {claim.photo_consent ? '已同意' : '未授权展示'}</span>
                      </div>
                      {claim.notes && <p className="mt-2 rounded-md bg-slate-950 px-3 py-2 text-xs text-slate-300">{claim.notes}</p>}
                      {duplicateWarnings.length > 0 && (
                        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          {duplicateWarnings.map((warning, index) => (
                            <div key={`${warning.file_hash || warning.claim_id || index}`}>{warning.message || '发现重复风险，请人工核对。'}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 lg:w-48">
                      <div className="flex justify-between"><span>基础</span><span>{claim.base_points}</span></div>
                      <div className="flex justify-between"><span>活动</span><span>{claim.campaign_bonus_points}</span></div>
                      <div className="flex justify-between"><span>照片</span><span>{Number(form.photoBonus) || 0}</span></div>
                      <div className="mt-2 flex justify-between border-t border-slate-800 pt-2 font-semibold text-cyan-200"><span>合计</span><span>{totalPreview}</span></div>
                    </div>
                  </div>

                  {(claim.purchase_point_claim_photos || []).length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {(claim.purchase_point_claim_photos || []).map((photo) => (
                        <a key={photo.id} href={photo.file_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                          {/* eslint-disable-next-line @next/next/no-img-element -- 后台审核缩略图使用 Supabase 动态公链，保持轻量。 */}
                          <img src={photo.file_url} alt={photo.file_name || '购买积分照片'} className="h-32 w-full object-cover" />
                          <div className="px-2 py-1.5 text-xs text-slate-400">{photo.photo_type} · {photo.storage_status}</div>
                        </a>
                      ))}
                    </div>
                  )}

                  {['pending', 'needs_more_info'].includes(claim.status) && (
                    <div className="mt-4 grid gap-3 lg:grid-cols-[120px_1fr_1fr_auto]">
                      <input
                        value={form.photoBonus}
                        onChange={(event) => updateReviewForm(claim.id, { photoBonus: event.target.value })}
                        type="number"
                        min="0"
                        placeholder="照片奖励"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                      />
                      <input
                        value={form.note}
                        onChange={(event) => updateReviewForm(claim.id, { note: event.target.value })}
                        placeholder="审核备注 / 需要补充资料"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                      />
                      <input
                        value={form.rejectReason}
                        onChange={(event) => updateReviewForm(claim.id, { rejectReason: event.target.value })}
                        placeholder="拒绝原因"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => claimAction(claim, 'approve')} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
                          <BadgeCheck className="w-4 h-4" />
                          通过
                        </button>
                        <button onClick={() => claimAction(claim, 'needs_more_info')} disabled={saving} className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10 disabled:opacity-60">
                          补充
                        </button>
                        <button onClick={() => claimAction(claim, 'reject')} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60">
                          <XCircle className="w-4 h-4" />
                          拒绝
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold text-white">基础规则</h2>
          <form onSubmit={saveRule} className="mt-4 space-y-3">
            <select value={ruleForm.product_type} onChange={(event) => {
              const nextType = event.target.value
              setRuleForm((prev) => ({
                ...prev,
                product_type: nextType,
                product_spec: productDefaultSpec(nextType),
                points: String(productDefaultPoints(nextType)),
              }))
            }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              {PURCHASE_POINT_PRODUCT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <input value={ruleForm.product_spec} onChange={(event) => setRuleForm((prev) => ({ ...prev, product_spec: event.target.value }))} placeholder="规格，如 96T / 500ml" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <div className="grid grid-cols-2 gap-2">
              <input value={ruleForm.points} onChange={(event) => setRuleForm((prev) => ({ ...prev, points: event.target.value }))} type="number" min="0" placeholder="积分" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              <input value={ruleForm.sort_order} onChange={(event) => setRuleForm((prev) => ({ ...prev, sort_order: event.target.value }))} type="number" placeholder="排序" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </div>
            <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60">
              <Plus className="w-4 h-4" />
              保存基础规则
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300">
                <span>{productLabel(rule.product_type)} · {rule.product_spec} · {rule.points} 分</span>
                <button onClick={() => deleteItem('rules', rule.id)} className="text-slate-500 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold text-white">活动规则</h2>
          <form onSubmit={saveCampaign} className="mt-4 space-y-3">
            <input value={campaignForm.name} onChange={(event) => setCampaignForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="活动名称" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input value={campaignForm.product_types} onChange={(event) => setCampaignForm((prev) => ({ ...prev, product_types: event.target.value }))} placeholder="产品类型，逗号分隔；空为全部" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input value={campaignForm.product_specs} onChange={(event) => setCampaignForm((prev) => ({ ...prev, product_specs: event.target.value }))} placeholder="规格，逗号分隔；空为全部" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <div className="grid grid-cols-2 gap-2">
              <input value={campaignForm.multiplier} onChange={(event) => setCampaignForm((prev) => ({ ...prev, multiplier: event.target.value }))} type="number" min="1" step="0.1" placeholder="倍率" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              <input value={campaignForm.bonus_points} onChange={(event) => setCampaignForm((prev) => ({ ...prev, bonus_points: event.target.value }))} type="number" min="0" placeholder="额外积分" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </div>
            <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60">
              <Plus className="w-4 h-4" />
              保存活动
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">{campaign.name}</span>
                  <button onClick={() => deleteItem('campaigns', campaign.id)} className="text-slate-500 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <div className="mt-1 text-slate-500">倍率 {campaign.multiplier} · 额外 {campaign.bonus_points} 分 · {campaign.is_active ? '启用' : '停用'}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
