import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    const body = await request.json()
    const { knowledge_id, helpful } = body

    if (!knowledge_id || helpful === undefined) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    // Update counts
    const column = helpful ? 'helpful_count' : 'not_helpful_count'
    const { error } = await supabase.rpc('increment_column', {
      table_name: 'daily_knowledge',
      column_name: column,
      row_id: knowledge_id,
      increment_by: 1,
    })

    if (error) {
      // Fallback: direct update if RPC not available
      const { data: item } = await supabase
        .from('daily_knowledge')
        .select('helpful_count, not_helpful_count')
        .eq('id', knowledge_id)
        .single()

      const newValue = helpful
        ? (item?.helpful_count || 0) + 1
        : (item?.not_helpful_count || 0) + 1

      await supabase
        .from('daily_knowledge')
        .update({ [column]: newValue })
        .eq('id', knowledge_id)
    }

    // Also update view count if this is first interaction
    const { data: item } = await supabase
      .from('daily_knowledge')
      .select('helpful_count, not_helpful_count, view_count')
      .eq('id', knowledge_id)
      .single()

    // Recalculate quality score based on feedback
    const totalFeedback = (item?.helpful_count || 0) + (item?.not_helpful_count || 0)
    const helpfulRate = totalFeedback > 0 ? (item?.helpful_count || 0) / totalFeedback : 0.5
    const newScore = Math.min(0.95, 0.50 + helpfulRate * 0.40 + Math.min((item?.view_count || 0) / 1000, 0.10))

    await supabase
      .from('daily_knowledge')
      .update({ quality_score: parseFloat(newScore.toFixed(2)) })
      .eq('id', knowledge_id)

    return NextResponse.json({ success: true, helpful })
  } catch (err: any) {
    console.error('[knowledge/feedback]', err)
    return NextResponse.json({ error: err.message || '提交失败' }, { status: 500 })
  }
}
