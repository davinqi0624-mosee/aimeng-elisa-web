'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Input,
  InputNumber,
  List,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  GiftOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { getPurchasePointProductLabel, PURCHASE_POINT_PRODUCT_OPTIONS } from '@/lib/purchase-points'
import PageHeader from '@/components/admin/PageHeader'

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

function statusTag(status: string) {
  if (status === 'approved') return <Tag color="green">{status}</Tag>
  if (status === 'rejected') return <Tag color="volcano">{status}</Tag>
  if (status === 'needs_more_info') return <Tag color="gold">{status}</Tag>
  if (status === 'archived') return <Tag>{status}</Tag>
  return <Tag color="processing">{status}</Tag>
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
  const { message } = App.useApp()
  const [status, setStatus] = useState('pending')
  const [claims, setClaims] = useState<PurchasePointClaim[]>([])
  const [rules, setRules] = useState<PointRule[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次后台数据请求。
    loadAll()
  }, [loadAll])

  function updateReviewForm(id: string, patch: Partial<{ photoBonus: string; note: string; rejectReason: string }>) {
    setReviewForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function claimAction(claim: PurchasePointClaim, action: string) {
    const form = reviewForms[claim.id] || { photoBonus: '0', note: '', rejectReason: '' }
    setSaving(true)
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
      message.success(data.pointsAwarded ? `${data.message}，已发放 ${data.pointsAwarded} 积分。` : (data.message || '操作成功'))
      await loadAll()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSaving(false)
    }
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
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
      message.success('基础规则已保存')
      await loadMeta()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '规则保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
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
      message.success('活动规则已保存')
      await loadMeta()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '活动保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(kind: 'rules' | 'campaigns', id: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/purchase-points/${kind}?id=${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as ActionResponse
      if (!res.ok || data.error) throw new Error(data.error || '删除失败')
      message.success('已删除')
      await loadMeta()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<PurchasePointClaim> = [
    {
      title: '产品 / 凭证',
      key: 'product',
      render: (_, claim) => (
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900">{productLabel(claim.product_type)} · {claim.product_spec}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {isGeneratedProductCredential(claim.point_code) ? '货号批号凭证' : `历史积分码 ${claim.point_code}`}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (s: string) => statusTag(s),
    },
    {
      title: '客户',
      key: 'customer',
      width: 110,
      render: (_, claim) => (
        <span className="text-xs text-slate-500">{profileName(claim.profiles, claim.user_id)}</span>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (v: string) => <span className="text-xs text-slate-500">{formatDate(v)}</span>,
    },
    {
      title: '积分合计',
      key: 'total',
      width: 90,
      render: (_, claim) => {
        const form = reviewForms[claim.id] || { photoBonus: '0', note: '', rejectReason: '' }
        return (
          <span className="font-medium text-slate-900">
            {Number(claim.base_points) + Number(claim.campaign_bonus_points) + (Number(form.photoBonus) || 0)}
          </span>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<GiftOutlined />}
        title="购买积分审核"
        description="审核货号、批号、商品照片和重复风险，通过后自动写入积分流水。"
        extra={<Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>刷新</Button>}
      />

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={status} onChange={(v) => setStatus(v as string)} options={STATUS_OPTIONS} />
        <span className="text-sm text-slate-500">{claims.length} 条申请</span>
      </div>

      <Table<PurchasePointClaim>
        rowKey="id"
        columns={columns}
        dataSource={claims}
        loading={loading}
        scroll={{ x: 800 }}
        locale={{ emptyText: '当前没有需要处理的购买积分申请' }}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        expandable={{
          expandedRowRender: (claim) => {
            const form = reviewForms[claim.id] || { photoBonus: '0', note: '', rejectReason: '' }
            const duplicateWarnings = Array.isArray(claim.duplicate_warnings) ? claim.duplicate_warnings : []
            const totalPreview = Number(claim.base_points) + Number(claim.campaign_bonus_points) + (Number(form.photoBonus) || 0)
            return (
              <div className="space-y-4">
                <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
                  <Descriptions.Item label="货号">{claim.catalog_number || '-'}</Descriptions.Item>
                  <Descriptions.Item label="批号">{claim.batch_number || '-'}</Descriptions.Item>
                  <Descriptions.Item label="渠道">{claim.purchase_channel || '-'}</Descriptions.Item>
                  <Descriptions.Item label="照片授权">{claim.photo_consent ? '已同意' : '未授权展示'}</Descriptions.Item>
                </Descriptions>

                {claim.notes && (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{claim.notes}</div>
                )}

                {duplicateWarnings.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    message={
                      <div className="space-y-0.5">
                        {duplicateWarnings.map((warning, index) => (
                          <div key={`${warning.file_hash || warning.claim_id || index}`}>{warning.message || '发现重复风险，请人工核对。'}</div>
                        ))}
                      </div>
                    }
                  />
                )}

                <Descriptions size="small" bordered column={{ xs: 2, sm: 2, lg: 4 }}>
                  <Descriptions.Item label="基础">{claim.base_points}</Descriptions.Item>
                  <Descriptions.Item label="活动">{claim.campaign_bonus_points}</Descriptions.Item>
                  <Descriptions.Item label="照片">{Number(form.photoBonus) || 0}</Descriptions.Item>
                  <Descriptions.Item label="合计"><span className="font-semibold">{totalPreview}</span></Descriptions.Item>
                </Descriptions>

                {(claim.purchase_point_claim_photos || []).length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(claim.purchase_point_claim_photos || []).map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-slate-200 bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- 后台审核缩略图使用 Supabase 动态公链，保持轻量。 */}
                        <img src={photo.file_url} alt={photo.file_name || '购买积分照片'} className="h-32 w-full object-cover" />
                        <div className="px-2 py-1.5 text-xs text-slate-500">{photo.photo_type} · {photo.storage_status}</div>
                      </a>
                    ))}
                  </div>
                )}

                {['pending', 'needs_more_info'].includes(claim.status) && (
                  <div className="grid gap-3 lg:grid-cols-[140px_1fr_1fr_auto]">
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={form.photoBonus === '' ? null : Number(form.photoBonus)}
                      onChange={(v) => updateReviewForm(claim.id, { photoBonus: v === null || v === undefined ? '' : String(v) })}
                      placeholder="照片奖励"
                    />
                    <Input
                      value={form.note}
                      onChange={(event) => updateReviewForm(claim.id, { note: event.target.value })}
                      placeholder="审核备注 / 需要补充资料"
                    />
                    <Input
                      value={form.rejectReason}
                      onChange={(event) => updateReviewForm(claim.id, { rejectReason: event.target.value })}
                      placeholder="拒绝原因"
                    />
                    <Space wrap>
                      <Popconfirm
                        title={`确认通过并发放 ${totalPreview} 积分？`}
                        okText="确定"
                        cancelText="取消"
                        onConfirm={() => claimAction(claim, 'approve')}
                      >
                        <Button type="primary" icon={<CheckCircleOutlined />} disabled={saving}>
                          通过
                        </Button>
                      </Popconfirm>
                      <Button disabled={saving} onClick={() => claimAction(claim, 'needs_more_info')}>
                        补充
                      </Button>
                      <Button danger icon={<CloseCircleOutlined />} disabled={saving} onClick={() => claimAction(claim, 'reject')}>
                        拒绝
                      </Button>
                    </Space>
                  </div>
                )}
              </div>
            )
          },
        }}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card size="small" title="基础规则">
          <form onSubmit={saveRule} className="space-y-3">
            <Select
              value={ruleForm.product_type}
              onChange={(nextType) => {
                setRuleForm((prev) => ({
                  ...prev,
                  product_type: nextType,
                  product_spec: productDefaultSpec(nextType),
                  points: String(productDefaultPoints(nextType)),
                }))
              }}
              options={PURCHASE_POINT_PRODUCT_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            />
            <Input
              value={ruleForm.product_spec}
              onChange={(event) => setRuleForm((prev) => ({ ...prev, product_spec: event.target.value }))}
              placeholder="规格，如 96T / 500ml"
            />
            <div className="grid grid-cols-2 gap-2">
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                placeholder="积分"
                value={ruleForm.points === '' ? null : Number(ruleForm.points)}
                onChange={(v) => setRuleForm((prev) => ({ ...prev, points: v === null || v === undefined ? '' : String(v) }))}
              />
              <InputNumber
                style={{ width: '100%' }}
                placeholder="排序"
                value={ruleForm.sort_order === '' ? null : Number(ruleForm.sort_order)}
                onChange={(v) => setRuleForm((prev) => ({ ...prev, sort_order: v === null || v === undefined ? '' : String(v) }))}
              />
            </div>
            <Button type="primary" block htmlType="submit" icon={<PlusOutlined />} disabled={saving}>
              保存基础规则
            </Button>
          </form>
          <List
            size="small"
            className="mt-4"
            dataSource={rules}
            locale={{ emptyText: '暂无基础规则' }}
            renderItem={(rule) => (
              <List.Item
                actions={[
                  <Popconfirm key="delete" title="确认删除？" okText="删除" cancelText="取消" onConfirm={() => deleteItem('rules', rule.id)}>
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <span className="text-xs text-slate-600">{productLabel(rule.product_type)} · {rule.product_spec} · {rule.points} 分</span>
              </List.Item>
            )}
          />
        </Card>

        <Card size="small" title="活动规则">
          <form onSubmit={saveCampaign} className="space-y-3">
            <Input
              value={campaignForm.name}
              onChange={(event) => setCampaignForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="活动名称"
            />
            <Input
              value={campaignForm.product_types}
              onChange={(event) => setCampaignForm((prev) => ({ ...prev, product_types: event.target.value }))}
              placeholder="产品类型，逗号分隔；空为全部"
            />
            <Input
              value={campaignForm.product_specs}
              onChange={(event) => setCampaignForm((prev) => ({ ...prev, product_specs: event.target.value }))}
              placeholder="规格，逗号分隔；空为全部"
            />
            <div className="grid grid-cols-2 gap-2">
              <InputNumber
                min={1}
                step={0.1}
                style={{ width: '100%' }}
                placeholder="倍率"
                value={campaignForm.multiplier === '' ? null : Number(campaignForm.multiplier)}
                onChange={(v) => setCampaignForm((prev) => ({ ...prev, multiplier: v === null || v === undefined ? '' : String(v) }))}
              />
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                placeholder="额外积分"
                value={campaignForm.bonus_points === '' ? null : Number(campaignForm.bonus_points)}
                onChange={(v) => setCampaignForm((prev) => ({ ...prev, bonus_points: v === null || v === undefined ? '' : String(v) }))}
              />
            </div>
            <Button type="primary" block htmlType="submit" icon={<PlusOutlined />} disabled={saving}>
              保存活动
            </Button>
          </form>
          <List
            size="small"
            className="mt-4"
            dataSource={campaigns}
            locale={{ emptyText: '暂无活动规则' }}
            renderItem={(campaign) => (
              <List.Item
                actions={[
                  <Popconfirm key="delete" title="确认删除？" okText="删除" cancelText="取消" onConfirm={() => deleteItem('campaigns', campaign.id)}>
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={<span className="text-sm">{campaign.name}</span>}
                  description={`倍率 ${campaign.multiplier} · 额外 ${campaign.bonus_points} 分 · ${campaign.is_active ? '启用' : '停用'}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  )
}
