import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getPointLedgerSummary, syncProfilePointTotals } from '@/lib/points/ledger'

const CLAIM_STATUSES = new Set(['pending', 'needs_more_info', 'approved', 'rejected', 'archived'])
const REVIEWABLE_STATUSES = new Set(['pending', 'needs_more_info'])

interface PurchasePointClaim {
  id: string
  user_id: string
  product_type: string
  product_spec: string
  point_code: string
  point_code_id: string | null
  catalog_number: string | null
  batch_number: string | null
  base_points: number
  campaign_bonus_points: number
  photo_bonus_points: number
  total_points: number
  status: string
}

interface ExistingAwardTransaction {
  id: string
  amount: number
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : fallback
}

function isStatus(value: string) {
  return CLAIM_STATUSES.has(value)
}

function credentialDescription(claim: PurchasePointClaim) {
  const catalog = claim.catalog_number ? `货号 ${claim.catalog_number}` : ''
  const batch = claim.batch_number ? `批号 ${claim.batch_number}` : ''
  return [claim.product_type, claim.product_spec, catalog, batch].filter(Boolean).join(' · ')
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'

  let query = supabase
    .from('purchase_point_claims')
    .select('*, purchase_point_claim_photos(*)')
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    if (!isStatus(status)) {
      return NextResponse.json({ error: '未知申请状态' }, { status: 400 })
    }
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const claims = data || []
  const userIds = Array.from(new Set(claims.map((claim) => claim.user_id).filter(Boolean)))
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] }
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))

  return NextResponse.json({
    claims: claims.map((claim) => ({
      ...claim,
      profiles: profileMap.get(claim.user_id) || null,
    })),
  })
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const action = cleanText(body.action)
    const claimId = cleanText(body.claimId)
    const reviewNote = cleanText(body.review_note)
    const rejectionReason = cleanText(body.rejection_reason)
    const photoBonusPoints = cleanNumber(body.photo_bonus_points)

    if (!claimId || !action) {
      return NextResponse.json({ error: '缺少申请 ID 或操作类型' }, { status: 400 })
    }

    const { data: claim, error: claimError } = await supabase
      .from('purchase_point_claims')
      .select('*')
      .eq('id', claimId)
      .single<PurchasePointClaim>()

    if (claimError || !claim) {
      return NextResponse.json({ error: claimError?.message || '积分申请不存在' }, { status: 404 })
    }

    if (action === 'approve') {
      if (!REVIEWABLE_STATUSES.has(claim.status)) {
        return NextResponse.json({ error: '该申请已经处理过，不能重复通过。' }, { status: 409 })
      }

      const totalPoints = cleanNumber(claim.base_points)
        + cleanNumber(claim.campaign_bonus_points)
        + photoBonusPoints

      if (totalPoints <= 0) {
        return NextResponse.json({ error: '积分值必须大于 0，不能审核通过。' }, { status: 400 })
      }

      let activeCode: { id: string; status: string; redeemed_claim_id: string | null } | null = null
      if (claim.point_code_id) {
        const { data: codeRow, error: codeError } = await supabase
          .from('purchase_point_codes')
          .select('id, status, redeemed_claim_id')
          .eq('id', claim.point_code_id)
          .maybeSingle()

        if (codeError) throw new Error(`检查历史积分码失败: ${codeError.message}`)
        if (!codeRow) {
          return NextResponse.json({ error: '该申请绑定的历史积分码不存在，请人工核对。' }, { status: 400 })
        }
        if (codeRow.status !== 'active' && codeRow.redeemed_claim_id !== claim.id) {
          return NextResponse.json({ error: '该历史积分码已被其他申请使用或停用，请人工核对。' }, { status: 409 })
        }
        activeCode = codeRow
      }

      const { data: existingAward, error: existingAwardError } = await supabase
        .from('point_transactions')
        .select('id, amount')
        .eq('source_table', 'purchase_point_claims')
        .eq('source_id', claim.id)
        .eq('type', 'earn')
        .maybeSingle<ExistingAwardTransaction>()

      if (existingAwardError) throw new Error(`检查积分流水失败: ${existingAwardError.message}`)
      if (existingAward && existingAward.amount !== totalPoints) {
        return NextResponse.json({
          error: `该申请已存在 ${existingAward.amount} 积分流水，与当前 ${totalPoints} 积分不一致，请人工核对后再处理。`,
        }, { status: 409 })
      }

      if (!existingAward) {
        const currentSummary = await getPointLedgerSummary(supabase, claim.user_id)
        const { error: pointError } = await supabase.from('point_transactions').insert({
          user_id: claim.user_id,
          amount: totalPoints,
          balance_after: currentSummary.availablePoints + totalPoints,
          type: 'earn',
          source: 'purchase_point_claim_approved',
          source_id: claim.id,
          source_table: 'purchase_point_claims',
          description: `购买积分申请审核通过（${credentialDescription(claim)}）`,
        })

        if (pointError) {
          if (pointError.code === '23505') {
            const { data: racedAward, error: racedAwardError } = await supabase
              .from('point_transactions')
              .select('id, amount')
              .eq('source_table', 'purchase_point_claims')
              .eq('source_id', claim.id)
              .eq('type', 'earn')
              .maybeSingle<ExistingAwardTransaction>()
            if (racedAwardError) throw new Error(`复查积分流水失败: ${racedAwardError.message}`)
            if (!racedAward || racedAward.amount !== totalPoints) {
              throw new Error('积分流水已被其他请求写入，但积分金额无法确认，请人工核对。')
            }
          } else {
            throw new Error(`积分流水写入失败: ${pointError.message}`)
          }
        }
      }

      if (activeCode) {
        const { error: codeUpdateError } = await supabase
          .from('purchase_point_codes')
          .update({
            status: 'used',
            redeemed_by: claim.user_id,
            redeemed_claim_id: claim.id,
            redeemed_at: new Date().toISOString(),
          })
          .eq('id', activeCode.id)

        if (codeUpdateError) throw new Error(`锁定历史积分码失败: ${codeUpdateError.message}`)
      }

      const syncedPoints = await syncProfilePointTotals(supabase, claim.user_id)
      const { error: updateError } = await supabase
        .from('purchase_point_claims')
        .update({
          status: 'approved',
          photo_bonus_points: photoBonusPoints,
          total_points: totalPoints,
          review_note: reviewNote || null,
          reviewed_by: admin!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claim.id)

      if (updateError) throw new Error(`更新申请状态失败: ${updateError.message}`)

      return NextResponse.json({
        message: '已审核通过并发放积分',
        pointsAwarded: totalPoints,
        balanceAfter: syncedPoints.availablePoints,
      })
    }

    if (action === 'needs_more_info') {
      if (!REVIEWABLE_STATUSES.has(claim.status)) {
        return NextResponse.json({ error: '该申请已经处理过，不能要求补充资料。' }, { status: 409 })
      }
      if (!reviewNote) {
        return NextResponse.json({ error: '请填写需要客户补充的内容。' }, { status: 400 })
      }
      const { error } = await supabase
        .from('purchase_point_claims')
        .update({
          status: 'needs_more_info',
          review_note: reviewNote,
          reviewed_by: admin!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claim.id)
      if (error) throw new Error(`更新申请失败: ${error.message}`)
      return NextResponse.json({ message: '已标记为需要补充资料' })
    }

    if (action === 'reject') {
      if (!REVIEWABLE_STATUSES.has(claim.status)) {
        return NextResponse.json({ error: '该申请已经处理过，不能重复拒绝。' }, { status: 409 })
      }
      if (!rejectionReason) {
        return NextResponse.json({ error: '请填写明确的拒绝原因。' }, { status: 400 })
      }
      const { error } = await supabase
        .from('purchase_point_claims')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          review_note: reviewNote || rejectionReason,
          reviewed_by: admin!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claim.id)
      if (error) throw new Error(`拒绝申请失败: ${error.message}`)
      return NextResponse.json({ message: '已拒绝' })
    }

    if (action === 'archive') {
      if (claim.status === 'approved') {
        return NextResponse.json({ error: '已通过并发放积分的申请不能直接归档。' }, { status: 400 })
      }
      const { error } = await supabase
        .from('purchase_point_claims')
        .update({
          status: 'archived',
          review_note: reviewNote || claim.status,
          reviewed_by: admin!.id,
          reviewed_at: new Date().toISOString(),
          archived_at: new Date().toISOString(),
        })
        .eq('id', claim.id)
      if (error) throw new Error(`归档申请失败: ${error.message}`)
      return NextResponse.json({ message: '已归档' })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[admin/purchase-points/claims]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '操作失败' }, { status: 500 })
  }
}
