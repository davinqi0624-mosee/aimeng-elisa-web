import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/admin/permissions'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'

  let query = supabase
    .from('papers')
    .select('*, profiles(username, full_name), products(name)')
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('upload_status', status)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ papers: data || [] })
}

function calculatePoints(ifValue: number): { verifyPoints: number; totalPoints: number } {
  let verifyPoints = 500
  if (ifValue >= 20) verifyPoints = 1500
  else if (ifValue >= 10) verifyPoints = 1200
  else if (ifValue >= 5) verifyPoints = 800
  return { verifyPoints, totalPoints: verifyPoints + 50 }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ['super', 'level1'])
  if (authError) return authError

  const supabase = await createClient()

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
      const ifVal = parseFloat(impact_factor) || 0
      const { verifyPoints, totalPoints } = calculatePoints(ifVal)

      // Update paper
      const { error: updErr } = await supabase
        .from('papers')
        .update({
          upload_status: 'verified',
          impact_factor: ifVal,
          is_displayed: true,
          points_awarded: totalPoints,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', paperId)

      if (updErr) throw updErr

      // Award verification points to user
      if (paper.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('total_points, available_points')
          .eq('id', paper.user_id)
          .single()

        const currentTotal = profile?.total_points || 0
        const currentAvailable = profile?.available_points || 0

        await supabase.from('point_transactions').insert({
          user_id: paper.user_id,
          amount: verifyPoints,
          balance_after: currentAvailable + verifyPoints,
          type: 'paper_citation_verified',
          source_id: paperId,
          source_table: 'papers',
          description: `文献审核通过奖励 (IF=${ifVal})`,
        })

        await supabase
          .from('profiles')
          .update({
            total_points: currentTotal + verifyPoints,
            available_points: currentAvailable + verifyPoints,
          })
          .eq('id', paper.user_id)
      }

      return NextResponse.json({
        message: '审核通过',
        pointsAwarded: totalPoints,
        impactFactor: ifVal,
      })
    }

    if (action === 'reject') {
      const { error: updErr } = await supabase
        .from('papers')
        .update({
          upload_status: 'rejected',
          rejection_reason: rejection_reason || '不符合要求',
        })
        .eq('id', paperId)

      if (updErr) throw updErr

      return NextResponse.json({ message: '已拒绝' })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (err: any) {
    console.error('[admin/citations]', err)
    return NextResponse.json({ error: err.message || '操作失败' }, { status: 500 })
  }
}
