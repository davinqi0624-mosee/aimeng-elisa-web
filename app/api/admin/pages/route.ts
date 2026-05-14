import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'

// GET: 查询所有内页
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  let query = supabase
    .from('pages')
    .select('*')
    .order('updated_at', { ascending: true })

  if (slug) {
    query = query.eq('slug', slug)
  }

  const { data, error: dbError } = await query
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  return NextResponse.json({ pages: data || [] })
}

// PUT: 更新内页
export async function PUT(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()
  try {
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) {
      return NextResponse.json(
        { error: '缺少页面ID' },
        { status: 400 }
      )
    }

    // Map visual-editor content field to production blocks column
    if ('content' in updates) {
      try {
        updates.blocks = typeof updates.content === 'string'
          ? JSON.parse(updates.content)
          : updates.content
      } catch {
        updates.blocks = updates.content
      }
      delete updates.content
    }

    const { error: dbError } = await supabase
      .from('pages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (dbError) throw dbError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || '更新失败' },
      { status: 500 }
    )
  }
}
