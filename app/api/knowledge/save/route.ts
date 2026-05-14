import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, category, tags, summary, publish_date } = body;

    if (!title || !content || !publish_date) {
      return Response.json(
        { error: '缺少必要字段：title, content, publish_date' },
        { status: 400 }
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('knowledge_base')
      .upsert({
        title,
        content,
        category: category || '操作技巧',
        tags: tags || [],
        summary: summary || '',
        publish_date,
        is_published: true,
        view_count: 0,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'publish_date',
      })
      .select()
      .single();

    if (error) {
      return Response.json(
        { error: '数据库保存失败', details: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      article: data,
    });

  } catch (error: any) {
    console.error('Save knowledge error:', error);
    return Response.json(
      { error: '保存失败', message: error.message },
      { status: 500 }
    );
  }
}