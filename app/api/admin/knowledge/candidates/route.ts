import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
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
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err, '知识候选加载失败') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()

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
      const title = edits?.title || candidate.suggested_title
      const content = edits?.content || candidate.content || candidate.answer
      const category = edits?.category || candidate.category
      const tags = edits?.tags || candidate.tags

      // 收录到 AI 客服检索用知识库。daily_knowledge 的 date 有唯一约束，
      // 不适合作为大量客服反馈候选的主入库位置。
      const { data: published, error: pubErr } = await supabase
        .from('knowledge_base')
        .insert({
          title,
          content,
          category,
          tags,
        })
        .select('id')
        .single()

      if (pubErr) throw pubErr

      const { error: updateError } = await supabase.from('knowledge_candidates').update({
        status: 'approved',
        review_note: note || `收录到 AI 知识库：${admin!.display_name || admin!.username}；knowledge_base_id=${published.id}`,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)

      if (updateError) throw updateError

      return NextResponse.json({ message: '已收录到 AI 知识库', knowledge_id: published.id })
    }

    if (action === 'reject') {
      await supabase.from('knowledge_candidates').update({
        status: 'rejected',
        review_note: note || `不符合要求：${admin!.display_name || admin!.username}`,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)

      return NextResponse.json({ message: '已拒绝' })
    }

    if (action === 'delete') {
      const { error: deleteError } = await supabase
        .from('knowledge_candidates')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      return NextResponse.json({ message: '已删除' })
    }

    if (action === 'merge') {
      // Mark as merge pending - admin needs to specify target knowledge_id
      await supabase.from('knowledge_candidates').update({
        status: 'merge_pending',
        review_note: note || `等待合并：${admin!.display_name || admin!.username}`,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)

      return NextResponse.json({ message: '已标记为待合并' })
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[admin/knowledge/candidates]', err)
    return NextResponse.json({ error: getErrorMessage(err, '操作失败') }, { status: 500 })
  }
}
