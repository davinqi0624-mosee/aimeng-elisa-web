import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAdminOrSuper(req)
    if (authError) return authError

    const body = await req.json();
    const { title, content, category, tags, summary, publish_date } = body;

    if (!title || !content || !publish_date) {
      return NextResponse.json(
        { error: '缺少必要字段：title, content, publish_date' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient()
    const article = {
      date: publish_date,
      title,
      summary: summary || '',
      content,
      tag: category || '操作技巧',
      category: category || '操作技巧',
      tags: tags || ['ELISA', '实验技巧'],
      is_published: true,
      quality_score: 0.75,
      source_type: 'ai_generated',
      lifecycle_status: 'active',
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      is_featured: false,
      updated_at: new Date().toISOString(),
    }

    const { data: existing, error: findError } = await supabase
      .from('daily_knowledge')
      .select('id')
      .eq('date', publish_date)
      .maybeSingle()

    if (findError) {
      return NextResponse.json(
        { error: '查询已有文章失败', details: findError.message },
        { status: 500 }
      )
    }

    const query = existing?.id
      ? supabase.from('daily_knowledge').update(article).eq('id', existing.id)
      : supabase.from('daily_knowledge').insert(article)

    const { data, error } = await query.select().single()

    if (error) {
      return NextResponse.json(
        { error: '数据库保存失败', details: error.message, code: error.code },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      article: data,
      action: existing?.id ? 'updated' : 'inserted',
    });

  } catch (error: unknown) {
    console.error('Save knowledge error:', error);
    return NextResponse.json(
      { error: '保存失败', message: getErrorMessage(error, '未知错误') },
      { status: 500 }
    );
  }
}
