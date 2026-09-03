import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuper } from '@/lib/admin/auth'

export async function POST(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const body = await request.json()
  const { articles } = body as {
    articles: Array<{
      date: string
      title: string
      summary?: string
      content: string
      category?: string
      tags?: string[]
    }>
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const results: Array<{ date: string; success: boolean; error?: string }> = []

  for (const article of articles) {
    const { error } = await supabase.from('daily_knowledge').insert({
      date: article.date,
      title: article.title,
      summary: article.summary || '',
      content: article.content,
      category: article.category || '操作技巧',
      tags: article.tags || ['ELISA', '实验技巧'],
      quality_score: 0.75,
      source_type: 'ai_generated',
      lifecycle_status: 'active',
      is_published: true,
      is_featured: false,
    })

    results.push({
      date: article.date,
      success: !error,
      error: error?.message,
    })
  }

  return NextResponse.json({ results })
}
