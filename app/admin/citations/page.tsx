'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Card, Input, InputNumber, Popover, Segmented, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExportOutlined,
  FileTextOutlined,
  GiftOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { calculateCitationPoints } from '@/lib/citations/rules'
import PageHeader from '@/components/admin/PageHeader'

interface ExtractionFile {
  file_url?: unknown
  file_name?: unknown
  file_type?: unknown
  file_size?: unknown
}

interface ExtractionResult {
  title?: string
  authors?: string
  affiliation?: string
  journal?: string
  doi?: string
  evidence_text?: string
  matched_if?: unknown
  matched_if_source?: string
  if_source?: string
  files?: ExtractionFile[]
}

interface Paper {
  id: string
  title: string
  authors: string
  affiliation: string
  journal: string
  doi: string
  product_cat_no: string
  file_url: string
  file_name: string
  file_type: string
  file_size: number | null
  file_hash: string
  detected_products: string[]
  detected_brands: string[]
  evidence_text: string
  extraction_status: string
  extraction_result: ExtractionResult | null
  if_source: string
  upload_status: string
  impact_factor: number | null
  points_awarded: number
  created_at: string
  rejection_reason: string
  review_notes: string
  profiles: { username: string; full_name: string } | null
}

interface AdminCitationsResponse {
  papers?: Paper[]
  error?: string
}

interface AdminCitationActionResponse {
  error?: string
  pointsAwarded?: number
  rejectedAsDuplicate?: boolean
}

interface CitationActionError extends Error {
  rejectedAsDuplicate?: boolean
}

function isCitationActionError(err: unknown): err is CitationActionError {
  return err instanceof Error
}

interface CitationReviewFile {
  file_url: string
  file_name?: string
  file_type?: string
  file_size?: number | null
}

interface ReviewForm {
  title: string
  authors: string
  affiliation: string
  journal: string
  doi: string
  product_cat_no: string
  evidence_text: string
  impact_factor: string
  if_source: string
  review_notes: string
  rejection_reason: string
}

const STATUS_MAP: Record<string, string> = {
  pending: '待审核',
  verified: '已通过',
  rejected: '已拒绝',
}

function fileSizeLabel(size?: number | null) {
  if (!size) return ''
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${Math.round(size / 1024)} KB`
}

function hasPlaceholder(value?: string | null) {
  return !value || value.includes('待管理员审核') || value === '未识别'
}

function isReliableIfCandidate(value: unknown, source?: string | null) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0.1 && Boolean(source?.includes('期刊 IF 数据表'))
}

function getReviewFiles(p: Paper): CitationReviewFile[] {
  const resultFiles = Array.isArray(p.extraction_result?.files) ? p.extraction_result.files : []
  const files = resultFiles
    .map((file) => ({
      file_url: typeof file.file_url === 'string' ? file.file_url : '',
      file_name: typeof file.file_name === 'string' ? file.file_name : '',
      file_type: typeof file.file_type === 'string' ? file.file_type : '',
      file_size: typeof file.file_size === 'number' ? file.file_size : null,
    }))
    .filter((file: CitationReviewFile) => file.file_url)

  if (files.length > 0) return files
  return p.file_url ? [{
    file_url: p.file_url,
    file_name: p.file_name,
    file_type: p.file_type,
    file_size: p.file_size,
  }] : []
}

function createForm(p: Paper): ReviewForm {
  const result = p.extraction_result || {}
  const paperIf = Number(p.impact_factor) >= 0.1 ? String(p.impact_factor) : ''
  const extractedIf = isReliableIfCandidate(result.matched_if, result.matched_if_source || result.if_source)
    ? String(result.matched_if)
    : ''
  return {
    title: hasPlaceholder(p.title) ? (result.title || '') : (p.title || ''),
    authors: hasPlaceholder(p.authors) ? (result.authors || '') : (p.authors || ''),
    affiliation: p.affiliation || result.affiliation || '',
    journal: hasPlaceholder(p.journal) ? (result.journal || '') : (p.journal || ''),
    doi: p.doi || result.doi || '',
    product_cat_no: p.product_cat_no || (Array.isArray(p.detected_products) ? p.detected_products.join(', ') : ''),
    evidence_text: p.evidence_text || result.evidence_text || '',
    impact_factor: paperIf || extractedIf,
    if_source: paperIf ? (p.if_source || '') : (extractedIf ? '期刊 IF 数据表' : ''),
    review_notes: p.review_notes || '',
    rejection_reason: p.rejection_reason || '',
  }
}

function statusTag(status: string) {
  if (status === 'verified') return <Tag color="green">{STATUS_MAP[status] || status}</Tag>
  if (status === 'rejected') return <Tag color="volcano">{STATUS_MAP[status] || status}</Tag>
  return <Tag color="gold">{STATUS_MAP[status] || status}</Tag>
}

export default function AdminCitationsPage() {
  const { message } = App.useApp()
  const [papers, setPapers] = useState<Paper[]>([])
  const [forms, setForms] = useState<Record<string, ReviewForm>>({})
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`/api/admin/citations?status=${statusFilter}`)
      const data = await res.json().catch(() => ({})) as AdminCitationsResponse
      if (!res.ok || data.error) {
        setPapers([])
        setForms({})
        setLoadError(data.error || '文献审核列表加载失败')
        return
      }
      const nextPapers = data.papers || []
      setPapers(nextPapers)
      setForms(Object.fromEntries(nextPapers.map((p: Paper) => [p.id, createForm(p)])))
    } catch (err: unknown) {
      setPapers([])
      setForms({})
      setLoadError(err instanceof Error ? err.message : '文献审核列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次后台数据请求。
    load()
  }, [load])

  function updateForm(id: string, patch: Partial<ReviewForm>) {
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function apiAction(body: object) {
    const res = await fetch('/api/admin/citations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({})) as AdminCitationActionResponse
    if (!res.ok || data.error) {
      const error = new Error(data.error || '操作失败') as CitationActionError
      error.rejectedAsDuplicate = Boolean(data.rejectedAsDuplicate)
      throw error
    }
    return data
  }

  async function handleApprove(p: Paper) {
    const form = forms[p.id]
    if (!form) return
    const ifValue = parseFloat(form.impact_factor)
    if (!ifValue || ifValue < 0.1) {
      message.warning('请先填写有效的期刊影响因子 IF，不能使用 0.003 这类明显异常的小数。')
      return
    }
    setActionId(`approve:${p.id}`)
    try {
      const data = await apiAction({
        action: 'approve',
        paperId: p.id,
        ...form,
        impact_factor: ifValue,
      })
      message.success(ifValue >= 10
        ? `高分文献审核通过：IF ${ifValue}，已发放 ${data.pointsAwarded} 积分。`
        : `审核通过，已发放 ${data.pointsAwarded} 积分。`)
      await load()
    } catch (err: unknown) {
      const actionError = isCitationActionError(err) ? err : null
      message.error(actionError?.message || '审核失败')
      if (actionError?.rejectedAsDuplicate) {
        await load()
      }
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(p: Paper) {
    const form = forms[p.id]
    const reason = form?.rejection_reason?.trim()
    if (!reason) {
      message.warning('请先填写明确的拒绝原因，这段文字会反馈给提交人。')
      return
    }
    setActionId(`reject:${p.id}`)
    try {
      await apiAction({
        action: 'reject',
        paperId: p.id,
        rejection_reason: reason,
      })
      message.success('已拒绝该文献申请。')
      await load()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '拒绝失败')
    } finally {
      setActionId(null)
    }
  }

  async function handleUpdateIf(p: Paper) {
    const form = forms[p.id]
    if (!form) return
    const ifValue = parseFloat(form.impact_factor)
    if (!ifValue || ifValue < 0.1) {
      message.warning('请先填写有效的期刊影响因子 IF。')
      return
    }
    setActionId(`update_if:${p.id}`)
    try {
      await apiAction({
        action: 'update_if',
        paperId: p.id,
        impact_factor: ifValue,
        if_source: form.if_source || `管理员更正 IF ${p.impact_factor ?? '未填写'} -> ${ifValue}`,
        review_notes: form.review_notes,
      })
      message.success(`IF 已更正为 ${ifValue}。`)
      await load()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'IF 更正失败')
    } finally {
      setActionId(null)
    }
  }

  const columns: ColumnsType<Paper> = [
    {
      title: '论文 / 期刊',
      key: 'title',
      render: (_, p) => {
        const form = forms[p.id] || createForm(p)
        return (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">
              {hasPlaceholder(form.title) ? '待识别论文题目' : form.title}
            </div>
            <div className="truncate text-xs text-slate-500">
              {form.journal || '待识别期刊'} {form.doi ? `· DOI: ${form.doi}` : ''}
            </div>
          </div>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'upload_status',
      key: 'upload_status',
      width: 90,
      render: (status: string) => statusTag(status),
    },
    {
      title: '投稿人',
      key: 'profiles',
      width: 110,
      render: (_, p) => (
        <span className="text-xs text-slate-500">
          {p.profiles?.full_name || p.profiles?.username || '未知'}
        </span>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (v: string) => <span className="text-xs text-slate-500">{new Date(v).toLocaleString('zh-CN')}</span>,
    },
    {
      title: '积分',
      key: 'points',
      width: 90,
      render: (_, p) => {
        if (p.upload_status === 'verified') return <span className="font-medium text-slate-900">+{p.points_awarded}</span>
        if (p.upload_status === 'pending') {
          const form = forms[p.id] || createForm(p)
          const ifValue = parseFloat(form.impact_factor)
          return ifValue >= 0.1
            ? <span className="text-slate-600">预计 +{calculateCitationPoints(ifValue)}</span>
            : <span className="text-slate-400">-</span>
        }
        return <span className="text-slate-400">-</span>
      },
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<FileTextOutlined />}
        title="文献引用审核"
        description="前台已完成文献识别。后台只需打开文件核对证据、填写期刊 IF、确认通过或写明拒绝原因。"
        extra={
          <>
            <Segmented
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as string)}
              options={[
                { value: 'pending', label: '待审核' },
                { value: 'verified', label: '已通过' },
                { value: 'rejected', label: '已拒绝' },
                { value: 'all', label: '全部' },
              ]}
            />
            <Tag color="blue">
              {STATUS_MAP[statusFilter] || '全部'} {papers.length} 篇
            </Tag>
          </>
        }
      />

      {loadError && (
        <Alert type="error" showIcon message="文献审核列表加载失败" description={loadError} style={{ marginBottom: 16 }} />
      )}

      <Table<Paper>
        rowKey="id"
        columns={columns}
        dataSource={papers}
        loading={loading}
        scroll={{ x: 900 }}
        locale={{ emptyText: statusFilter === 'pending' ? '暂无客户提交的待审核文献' : `暂无${STATUS_MAP[statusFilter] || ''}文献` }}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 篇` }}
        expandable={{
          expandedRowRender: (p) => {
            const form = forms[p.id] || createForm(p)
            const ifValue = parseFloat(form.impact_factor)
            const pointPreview = ifValue >= 0.1 ? calculateCitationPoints(ifValue) : 0
            const missingCore = hasPlaceholder(form.title) || hasPlaceholder(form.journal)
            const missingEvidence = !form.product_cat_no && !form.evidence_text && (!p.detected_brands || p.detected_brands.length === 0)
            const canApprove = p.upload_status === 'pending' && ifValue >= 0.1 && !missingCore && !missingEvidence
            const reviewFiles = getReviewFiles(p)

            return (
              <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs font-medium text-slate-500">论文题目</div>
                      <Input
                        value={form.title}
                        onChange={(e) => updateForm(p.id, { title: e.target.value })}
                        placeholder="系统未识别时请补充"
                        disabled={p.upload_status !== 'pending'}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-slate-500">期刊名称</div>
                      <Input
                        value={form.journal}
                        onChange={(e) => updateForm(p.id, { journal: e.target.value })}
                        placeholder="用于匹配 IF"
                        disabled={p.upload_status !== 'pending'}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-slate-500">DOI</div>
                      <Input
                        value={form.doi}
                        onChange={(e) => updateForm(p.id, { doi: e.target.value })}
                        placeholder="可选，但有助于防重复"
                        disabled={p.upload_status !== 'pending'}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-slate-500">发表单位 / 研究单位</div>
                      <Input
                        value={form.affiliation}
                        onChange={(e) => updateForm(p.id, { affiliation: e.target.value })}
                        placeholder="例如 上海交通大学"
                        disabled={p.upload_status !== 'pending'}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-slate-500">作者（后台留痕）</div>
                      <Input
                        value={form.authors}
                        onChange={(e) => updateForm(p.id, { authors: e.target.value })}
                        placeholder="可选；公开页默认不展示长作者名单"
                        disabled={p.upload_status !== 'pending'}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">确认的爱萌产品货号/品牌证据</div>
                    <Input
                      value={form.product_cat_no}
                      onChange={(e) => updateForm(p.id, { product_cat_no: e.target.value })}
                      placeholder="如 LV30229, LV30536；若无货号，证据片段必须包含 Animalunion/Aimeng Uning"
                      disabled={p.upload_status !== 'pending'}
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">文献原文证据片段</div>
                    <Input.TextArea
                      value={form.evidence_text}
                      onChange={(e) => updateForm(p.id, { evidence_text: e.target.value })}
                      rows={3}
                      placeholder="粘贴或保留系统识别出的实验方法/产品来源片段"
                      disabled={p.upload_status !== 'pending'}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {Array.isArray(p.detected_products) && p.detected_products.map((item) => (
                      <Tag key={item} color="blue">识别货号 {item}</Tag>
                    ))}
                    {Array.isArray(p.detected_brands) && p.detected_brands.map((item) => (
                      <Tag key={item} color="green">品牌 {item}</Tag>
                    ))}
                    {p.extraction_status && (
                      <Tag>识别状态 {p.extraction_status}</Tag>
                    )}
                  </div>

                  {reviewFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {reviewFiles.map((file, index) => (
                        <Popover key={`${file.file_url}-${index}`} content={file.file_name || `文献文件 ${index + 1}`}>
                          <Button
                            size="small"
                            icon={<FileTextOutlined />}
                            href={file.file_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {reviewFiles.length > 1 ? `查看文件 ${index + 1}` : '查看文件'}
                            {fileSizeLabel(file.file_size) && (
                              <span className="text-xs text-slate-400"> {fileSizeLabel(file.file_size)}</span>
                            )}
                            <ExportOutlined className="ml-1 text-xs text-slate-400" />
                          </Button>
                        </Popover>
                      ))}
                    </div>
                  )}
                </div>

                <Card size="small">
                  <div className="space-y-3">
                    <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                      <div>
                        <div className="mb-1 text-xs font-medium text-slate-500">期刊影响因子 IF</div>
                        <InputNumber
                          min={0}
                          step={0.001}
                          style={{ width: '100%' }}
                          value={form.impact_factor === '' ? null : Number(form.impact_factor)}
                          onChange={(v) => updateForm(p.id, { impact_factor: v === null || v === undefined ? '' : String(v) })}
                          placeholder="请人工填写，例如 6.240"
                          disabled={p.upload_status === 'rejected'}
                        />
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">积分预览</div>
                        <div className="text-lg font-bold text-blue-600">{pointPreview || '-'}</div>
                      </div>
                    </div>
                    {!form.impact_factor && (
                      <Alert
                        type="warning"
                        showIcon
                        message="当前期刊还没有匹配到网站 IF 数据表。请管理员人工核对 JCR/期刊 IF 后填写；后续导入 IF 表后可自动匹配。"
                      />
                    )}

                    <div>
                      <div className="mb-1 text-xs font-medium text-slate-500">IF 查询依据（内部留痕）</div>
                      <Input
                        value={form.if_source}
                        onChange={(e) => updateForm(p.id, { if_source: e.target.value })}
                        placeholder="例如：JCR 2025 官网查询 / 期刊官网 / 管理员手动核对"
                        disabled={p.upload_status === 'rejected'}
                      />
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        这里不是让 AI 识别。它只是记录管理员从哪里查到这个 IF，便于以后复核；不确定时可填写“管理员手动核对”。
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-xs font-medium text-slate-500">审核备注</div>
                      <Input.TextArea
                        value={form.review_notes}
                        onChange={(e) => updateForm(p.id, { review_notes: e.target.value })}
                        rows={2}
                        placeholder="内部备注，可空"
                        disabled={p.upload_status === 'rejected'}
                      />
                    </div>

                    {p.upload_status === 'pending' ? (
                      <>
                        <div className="space-y-1 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            {missingCore ? <CloseCircleOutlined className="text-red-500" /> : <CheckCircleOutlined className="text-green-600" />}
                            论文题目和期刊名称已确认
                          </div>
                          <div className="flex items-center gap-2">
                            {missingEvidence ? <CloseCircleOutlined className="text-red-500" /> : <CheckCircleOutlined className="text-green-600" />}
                            爱萌产品货号或品牌证据已确认
                          </div>
                          <div className="flex items-center gap-2">
                            {ifValue >= 0.1 ? <CheckCircleOutlined className="text-green-600" /> : <CloseCircleOutlined className="text-red-500" />}
                            期刊 IF 已确认
                          </div>
                        </div>

                        <Button
                          type="primary"
                          block
                          icon={<TrophyOutlined />}
                          onClick={() => handleApprove(p)}
                          loading={actionId === `approve:${p.id}`}
                          disabled={!canApprove || actionId === `approve:${p.id}`}
                        >
                          确认通过并发放积分
                        </Button>

                        <div className="flex gap-2">
                          <Input
                            value={form.rejection_reason}
                            onChange={(e) => updateForm(p.id, { rejection_reason: e.target.value })}
                            placeholder="拒绝原因，会反馈给提交人，例如：未看到爱萌货号/品牌证据"
                          />
                          <Button
                            danger
                            onClick={() => handleReject(p)}
                            disabled={actionId === `reject:${p.id}` || !form.rejection_reason.trim()}
                          >
                            拒绝
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                        {p.upload_status === 'verified' ? (
                          <>
                            <div className="flex items-center gap-2 text-green-700">
                              <GiftOutlined />
                              已发放 {p.points_awarded} 积分，IF {p.impact_factor}
                            </div>
                            <Button
                              className="mt-3"
                              block
                              onClick={() => handleUpdateIf(p)}
                              loading={actionId === `update_if:${p.id}`}
                              disabled={actionId === `update_if:${p.id}`}
                            >
                              保存 IF 更正
                            </Button>
                          </>
                        ) : (
                          <div className="text-red-600">拒绝原因：{p.rejection_reason || p.review_notes || '未填写'}</div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )
          },
        }}
      />
    </div>
  )
}
