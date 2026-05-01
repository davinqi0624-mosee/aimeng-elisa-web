import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'

  try {
    const { data, error } = await supabase
      .from('knowledge_candidates')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ candidates: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()

  try {
    const body = await request.json()
    const { id, action, note, edits } = body

    if (!id || !action) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    const { data: candidate } = await supabase
      .from('knowledge_candidates')
      .select('*')
      .eq('id', id)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: '候选不存在' }, { status: 404 })
    }

    if (action === 'approve') {
      // Publish to daily_knowledge
      const { data: published, error: pubErr } = await supabase
        .from('daily_knowledge')
        .insert({
          date: new Date().toISOString().split('T')[0],
          title: edits?.title || candidate.suggested_title,
          summary: candidate.question.slice(0, 200),
          content: edits?.content || candidate.content,
          category: edits?.category || candidate.category,
          tags: edits?.tags || candidate.tags,
          quality_score: candidate.ai_quality_score,
          source_type: 'ai_extracted',
          lifecycle_status: 'active',
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()

      if (pubErr) throw pubErr

      // Update candidate
      await supabase.from('knowledge_candidates').update({
        status: 'approved',
        reviewer_id: admin!.id,
        review_note: note || '一键发布',
        merged_into_id: published.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)

      return NextResponse.json({ message: '已发布', knowledge_id: published.id })
    }

    if (action === 'reject') {
      await supabase.from('knowledge_candidates').update({
        status: 'rejected',
        reviewer_id: admin!.id,
        review_note: note || '不符合要求',
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)

      return NextResponse.json({ message: '已拒绝' })
    }

    if (action === 'merge') {
      // Mark as merge pending - admin needs to specify target knowledge_id
      await supabase.from('knowledge_candidates').update({
        status: 'merge_pending',
        reviewer_id: admin!.id,
        review_note: note || '等待合并',
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)

      return NextResponse.json({ message: '已标记为待合并' })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (err: any) {
    console.error('[admin/knowledge/candidates]', err)
    return NextResponse.json({ error: err.message || '操作失败' }, { status: 500 })
  }
}
