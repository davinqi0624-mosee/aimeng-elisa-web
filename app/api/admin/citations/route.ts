import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import {
  calculateCitationPoints,
  cleanText,
  extractBrandKeywords,
  extractCatalogNumbers,
  isPlaceholderCitationText,
  normalizeCatalogNumbers,
  normalizeDoi,
} from '@/lib/citations/rules'
import { getPointLedgerSummary, syncProfilePointTotals } from '@/lib/points/ledger'

interface PaperExtractionFile {
  file_hash?: unknown
}

interface PaperWithFiles {
  id?: string
  file_hash?: unknown
  extraction_result?: {
    files?: PaperExtractionFile[]
    affiliation?: unknown
  } | null
}

interface ExistingAwardTransaction {
  id: string
  amount: number
}

async function rejectDuplicatePaper(
  supabase: ReturnType<typeof createAdminClient>,
  paperId: string,
  reason: string,
  duplicateOf?: string,
) {
  const { error } = await supabase
    .from('papers')
    .update({
      upload_status: 'rejected',
      status: 'rejected',
      rejection_reason: reason,
      review_notes: reason,
      is_displayed: false,
      duplicate_of: duplicateOf || null,
    })
    .eq('id', paperId)

  if (error) throw error
}

function getPaperFileHashes(paper: PaperWithFiles | null | undefined) {
  const files = Array.isArray(paper?.extraction_result?.files) ? paper.extraction_result.files : []
  return Array.from(new Set([
    cleanText(paper?.file_hash),
    ...files.map((file) => cleanText(file?.file_hash)),
  ].filter(Boolean)))
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'

  let query = supabase
    .from('papers')
    .select('*, profiles(username, full_name), products(name)')
    .eq('citation_type', 'user_submitted')
    .eq('source_type', 'customer_upload')
    .eq('discovery_status', 'manual')
    .not('file_url', 'is', null)
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })

  query = query.eq('upload_status', status)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ papers: data || [] })
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const { action, paperId, impact_factor, rejection_reason } = body

    if (!paperId || !action) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    const { data: paper } = await supabase.from('papers').select('*').eq('id', paperId).single()
    if (!paper) {
      return NextResponse.json({ error: '文献不存在' }, { status: 404 })
    }

    if (action === 'approve') {
      if (paper.upload_status !== 'pending') {
        return NextResponse.json({ error: '这篇文献已经处理过，不能重复审核。' }, { status: 409 })
      }

      const ifVal = parseFloat(impact_factor) || 0
      if (!ifVal || ifVal < 0.1) {
        return NextResponse.json({ error: '请输入有效的期刊影响因子 IF，不能使用 0.003 这类明显异常的小数。' }, { status: 400 })
      }
      if (paper.upload_status === 'verified' || paper.points_awarded > 0) {
        return NextResponse.json({ error: '这篇文献已经审核通过并发放过积分，不能重复发放。' }, { status: 409 })
      }

      const title = cleanText(body.title) || paper.title
      const journal = cleanText(body.journal) || paper.journal
      const authors = cleanText(body.authors) || paper.authors
      const affiliation = cleanText(body.affiliation) || paper.affiliation || cleanText(paper.extraction_result?.affiliation)
      const doi = cleanText(body.doi) || paper.doi
      const productCatNo = cleanText(body.product_cat_no) || paper.product_cat_no
      const evidenceText = cleanText(body.evidence_text) || paper.evidence_text
      const reviewNotes = cleanText(body.review_notes)
      const combined = `${title} ${journal} ${authors} ${affiliation} ${doi} ${productCatNo} ${evidenceText} ${JSON.stringify(paper.extraction_result || {})}`
      const detectedProducts = Array.from(new Set([
        ...normalizeCatalogNumbers(productCatNo),
        ...extractCatalogNumbers(combined),
      ]))
      const detectedBrands = Array.from(new Set([
        ...(Array.isArray(paper.detected_brands) ? paper.detected_brands : []),
        ...extractBrandKeywords(combined),
      ]))

      if (isPlaceholderCitationText(title) || isPlaceholderCitationText(journal)) {
        return NextResponse.json({ error: '请先确认论文题目和期刊名称，再审核通过。' }, { status: 400 })
      }
      if (detectedProducts.length === 0 && detectedBrands.length === 0) {
        return NextResponse.json({ error: '未确认爱萌产品货号或品牌证据，不能审核通过。' }, { status: 400 })
      }

      const normalizedDoi = normalizeDoi(doi)
      const currentFileHashes = getPaperFileHashes(paper)
      if (currentFileHashes.length > 0) {
        const { data: possibleDuplicates } = await supabase
          .from('papers')
          .select('id, title, file_hash, extraction_result')
          .neq('id', paperId)
          .eq('user_id', paper.user_id)
          .neq('upload_status', 'rejected')

        const duplicateFile = ((possibleDuplicates || []) as PaperWithFiles[]).find((item) => (
          getPaperFileHashes(item).some((hash) => currentFileHashes.includes(hash))
        ))
        if (duplicateFile) {
          const reason = '同一客户已经提交过相同文件，本次申请按重复提交处理，不能重复发放积分。'
          await rejectDuplicatePaper(supabase, paperId, reason, duplicateFile.id)
          return NextResponse.json({
            error: reason,
            rejectedAsDuplicate: true,
          }, { status: 409 })
        }
      }
      if (normalizedDoi) {
        const { data: duplicateDoi } = await supabase
          .from('papers')
          .select('id, title')
          .neq('id', paperId)
          .eq('user_id', paper.user_id)
          .ilike('doi', normalizedDoi)
          .maybeSingle()
        if (duplicateDoi) {
          const reason = '同一客户已经提交过相同 DOI，本次申请按重复提交处理，不能重复发放积分。'
          await rejectDuplicatePaper(supabase, paperId, reason, duplicateDoi.id)
          return NextResponse.json({
            error: reason,
            rejectedAsDuplicate: true,
          }, { status: 409 })
        }
      }

      const totalPoints = calculateCitationPoints(ifVal)

      // Award verification points to user
      if (!paper.user_id) {
        return NextResponse.json({ error: '该文献没有绑定提交用户，不能发放积分。' }, { status: 400 })
      }

      const { data: existingAward, error: existingAwardError } = await supabase
        .from('point_transactions')
        .select('id, amount')
        .eq('source_table', 'papers')
        .eq('source_id', paperId)
        .eq('type', 'earn')
        .maybeSingle<ExistingAwardTransaction>()

      if (existingAwardError) {
        throw new Error(`检查文献积分流水失败: ${existingAwardError.message}`)
      }
      if (existingAward && existingAward.amount !== totalPoints) {
        return NextResponse.json({
          error: `该文献已经存在 ${existingAward.amount} 积分的奖励流水，与当前 IF 对应的 ${totalPoints} 积分不一致。请先人工核对积分流水后再处理。`,
        }, { status: 409 })
      }

      if (!existingAward) {
        const currentSummary = await getPointLedgerSummary(supabase, paper.user_id)
        const { error: pointError } = await supabase.from('point_transactions').insert({
          user_id: paper.user_id,
          amount: totalPoints,
          balance_after: currentSummary.availablePoints + totalPoints,
          type: 'earn',
          source: 'paper_citation_verified',
          source_id: paperId,
          source_table: 'papers',
          description: `文献审核通过奖励 (IF=${ifVal})`,
        })

        if (pointError) {
          if (pointError.code === '23505') {
            const { data: racedAward, error: racedAwardError } = await supabase
              .from('point_transactions')
              .select('id, amount')
              .eq('source_table', 'papers')
              .eq('source_id', paperId)
              .eq('type', 'earn')
              .maybeSingle<ExistingAwardTransaction>()
            if (racedAwardError) throw new Error(`复查文献积分流水失败: ${racedAwardError.message}`)
            if (!racedAward || racedAward.amount !== totalPoints) {
              throw new Error('该文献积分流水已被其他请求写入，但积分金额无法确认，请人工核对后再处理。')
            }
          } else {
            throw new Error(`积分流水写入失败: ${pointError.message}`)
          }
        }
      }

      const syncedPoints = await syncProfilePointTotals(supabase, paper.user_id)

      // Update paper after the point transaction succeeds, so a failed award cannot leave a false verified state.
      const { error: updErr } = await supabase
        .from('papers')
        .update({
          title,
          authors,
          affiliation: affiliation || null,
          journal,
          doi: doi || null,
          product_cat_no: detectedProducts.join(', ') || productCatNo,
          detected_products: detectedProducts,
          detected_brands: detectedBrands,
          evidence_text: evidenceText || null,
          upload_status: 'verified',
          status: 'verified',
          impact_factor: ifVal,
          if_source: cleanText(body.if_source) || paper.if_source || '管理员审核确认',
          review_notes: reviewNotes || null,
          is_displayed: true,
          points_awarded: totalPoints,
          verified_by: null,
          verified_admin_id: admin!.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', paperId)

      if (updErr) throw updErr

      return NextResponse.json({
        message: '审核通过',
        pointsAwarded: totalPoints,
        impactFactor: ifVal,
        balanceAfter: syncedPoints.availablePoints,
      })
    }

    if (action === 'reject') {
      if (paper.upload_status !== 'pending') {
        return NextResponse.json({ error: '这篇文献已经处理过，不能重复审核。' }, { status: 409 })
      }

      const reason = cleanText(rejection_reason)
      if (!reason) {
        return NextResponse.json({ error: '请填写明确的拒绝原因，系统会反馈给提交人。' }, { status: 400 })
      }

      const { error: updErr } = await supabase
        .from('papers')
        .update({
          upload_status: 'rejected',
          status: 'rejected',
          rejection_reason: reason,
          review_notes: reason,
        })
        .eq('id', paperId)

      if (updErr) throw updErr

      return NextResponse.json({ message: '已拒绝' })
    }

    if (action === 'update_if') {
      if (paper.upload_status !== 'verified') {
        return NextResponse.json({ error: '只有已通过文献可以更正 IF。待审核文献请在审核通过时填写 IF。' }, { status: 400 })
      }
      const ifVal = parseFloat(impact_factor) || 0
      if (!ifVal || ifVal < 0.1) {
        return NextResponse.json({ error: '请输入有效的期刊影响因子 IF。' }, { status: 400 })
      }

      const oldPoints = Number(paper.points_awarded || 0)
      const nextPoints = calculateCitationPoints(ifVal)
      if (oldPoints !== nextPoints) {
        return NextResponse.json({
          error: `更正后的 IF 对应积分为 ${nextPoints}，当前已发放 ${oldPoints}。为避免积分流水错误，请先人工核对后再调整。`,
        }, { status: 409 })
      }

      const oldIf = paper.impact_factor
      const note = cleanText(body.if_source) || `管理员更正 IF ${oldIf ?? '未填写'} -> ${ifVal}`
      const { error: updErr } = await supabase
        .from('papers')
        .update({
          impact_factor: ifVal,
          if_source: note,
          review_notes: cleanText(body.review_notes) || paper.review_notes || null,
        })
        .eq('id', paperId)

      if (updErr) throw updErr

      return NextResponse.json({
        message: 'IF 已更正',
        impactFactor: ifVal,
        pointsAwarded: oldPoints,
      })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[admin/citations]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '操作失败' }, { status: 500 })
  }
}
