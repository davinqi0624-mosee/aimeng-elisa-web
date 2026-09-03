import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatCompletion } from '@/lib/ai/llm'
import { requireSuper } from '@/lib/admin/auth'

export async function POST(request: NextRequest) {
  // 安全加固：知识库清理仅限超级管理员手动触发
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const supabase = await createClient()

  try {
    const report = {
      total_scanned: 0,
      archived_count: 0,
      merged_count: 0,
      ai_updated_count: 0,
      details: [] as any[],
    }

    // 1. Archive expired low-quality articles
    const { data: expired } = await supabase
      .from('daily_knowledge')
      .select('id, title, quality_score, expires_at, lifecycle_status')
      .lt('expires_at', new Date().toISOString())
      .lt('quality_score', 0.30)
      .eq('lifecycle_status', 'active')

    if (expired && expired.length > 0) {
      for (const item of expired) {
        await supabase
          .from('daily_knowledge')
          .update({ lifecycle_status: 'archived' })
          .eq('id', item.id)
        report.archived_count++
        report.details.push({ action: 'archived', id: item.id, title: item.title })
      }
    }

    // 2. Find fragmented content (similar titles, low view count)
    const { data: lowEngagement } = await supabase
      .from('daily_knowledge')
      .select('id, title, content, category, view_count')
      .eq('lifecycle_status', 'active')
      .lt('view_count', 10)
      .lt('quality_score', 0.50)
      .order('created_at', { ascending: false })
      .limit(20)

    report.total_scanned = (expired?.length || 0) + (lowEngagement?.length || 0)

    // 3. Try to merge similar articles
    if (lowEngagement && lowEngagement.length >= 2) {
      for (let i = 0; i < lowEngagement.length; i++) {
        for (let j = i + 1; j < lowEngagement.length; j++) {
          const a = lowEngagement[i]
          const b = lowEngagement[j]
          if (a.category === b.category && !a.title.includes('已合并') && !b.title.includes('已合并')) {
            // Simple title similarity check
            const aWords = a.title.split(/\s+/)
            const bWords = b.title.split(/\s+/)
            const common = aWords.filter((w: string) => bWords.includes(w))
            if (common.length >= 2) {
              // Mark as merged (in production, would actually merge content)
              await supabase.from('daily_knowledge').update({
                lifecycle_status: 'merged',
                title: `${a.title}（已合并）`,
              }).eq('id', a.id)
              report.merged_count++
              report.details.push({ action: 'merged', ids: [a.id, b.id], title: a.title })
              break
            }
          }
        }
      }
    }

    // 4. Log cleanup run
    await supabase.from('knowledge_cleanup_logs').insert({
      total_scanned: report.total_scanned,
      archived_count: report.archived_count,
      merged_count: report.merged_count,
      ai_updated_count: report.ai_updated_count,
      details: report.details,
      report_summary: `本次清理扫描 ${report.total_scanned} 篇，归档 ${report.archived_count} 篇，合并 ${report.merged_count} 篇。`,
    })

    return NextResponse.json({
      message: '清理完成',
      ...report,
    })
  } catch (err: any) {
    console.error('[knowledge/cleanup]', err)
    return NextResponse.json({ error: err.message || '清理失败' }, { status: 500 })
  }
}
