import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'

const POINTS_PER_PAPER = 100

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
    if (authError) return authError

    const supabase = await createClient()
    const body = await request.json()
    const { paperId, action, note } = body
    if (!paperId || !['verify', 'reject'].includes(action)) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 })
    }

    if (action === 'verify') {
      const { data: paper } = await supabase
        .from('papers')
        .select('user_id, status, title')
        .eq('id', paperId)
        .single()

      if (!paper) return NextResponse.json({ error: '论文不存在' }, { status: 404 })
      if (paper.status === 'verified') {
        return NextResponse.json({ error: '已审核通过' }, { status: 400 })
      }

      const { error: updateError } = await supabase
        .from('papers')
        .update({ status: 'verified', points_awarded: POINTS_PER_PAPER, reviewer_note: note || null })
        .eq('id', paperId)

      if (updateError) throw updateError

      const { error: txError } = await supabase.from('point_transactions').insert({
        user_id: paper.user_id,
        amount: POINTS_PER_PAPER,
        type: 'earn',
        source: 'paper',
        source_id: paperId,
        description: `论文审核通过奖励: ${note || '通过'}`,
      })

      if (txError) throw txError

      await logAudit({
        admin_id: user.id,
        action: 'award_points',
        target_table: 'papers',
        target_id: paperId,
        new_value: { points: POINTS_PER_PAPER, status: 'verified', title: paper.title },
        reason: note || '论文审核通过',
        ip_address: getClientIP(request),
      })

      return NextResponse.json({ message: '审核通过，积分已发放', points: POINTS_PER_PAPER })
    } else {
      const { data: paper } = await supabase
        .from('papers')
        .select('title')
        .eq('id', paperId)
        .single()

      const { error } = await supabase
        .from('papers')
        .update({ status: 'rejected', reviewer_note: note || null })
        .eq('id', paperId)

      if (error) throw error

      await logAudit({
        admin_id: user.id,
        action: 'update',
        target_table: 'papers',
        target_id: paperId,
        new_value: { status: 'rejected', title: paper?.title },
        reason: note || '论文审核拒绝',
        ip_address: getClientIP(request),
      })

      return NextResponse.json({ message: '已拒绝' })
    }
  } catch (err: any) {
    console.error('Verify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
