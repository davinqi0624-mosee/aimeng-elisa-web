import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const POINTS_PER_PAPER = 100

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    // 简单的管理员校验：检查 metadata 中是否有 is_admin 标记
    const isAdmin = (user.user_metadata as any)?.is_admin === true
    if (!isAdmin) {
      return NextResponse.json({ error: '无权操作' }, { status: 403 })
    }

    const body = await request.json()
    const { paperId, action, note } = body
    if (!paperId || !['verify', 'reject'].includes(action)) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 })
    }

    if (action === 'verify') {
      // 更新论文状态并发放积分
      const { data: paper } = await supabase
        .from('papers')
        .select('user_id, status')
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

      // 写入积分交易记录
      const { error: txError } = await supabase.from('point_transactions').insert({
        user_id: paper.user_id,
        amount: POINTS_PER_PAPER,
        type: 'earn',
        source: 'paper',
        source_id: paperId,
        description: `论文审核通过奖励: ${note || '通过'}`,
      })

      if (txError) throw txError

      return NextResponse.json({ message: '审核通过，积分已发放', points: POINTS_PER_PAPER })
    } else {
      const { error } = await supabase
        .from('papers')
        .update({ status: 'rejected', reviewer_note: note || null })
        .eq('id', paperId)

      if (error) throw error
      return NextResponse.json({ message: '已拒绝' })
    }
  } catch (err: any) {
    console.error('Verify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
