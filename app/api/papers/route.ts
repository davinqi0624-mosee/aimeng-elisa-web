import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/auth/role'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'verified'
  const myPapers = searchParams.get('mine') === 'true'
  const limit = parseInt(searchParams.get('limit') || '20')

  let query = supabase
    .from('papers')
    .select('*, products(name, target)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status !== 'all') {
    query = query.eq('upload_status', status)
  }

  if (myPapers && user) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ papers: data || [] })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const body = await request.json()
    const { title, authors, journal, doi, link, abstract, productId } = body

    if (!title || !authors || !journal) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('papers')
      .insert({
        user_id: user.id,
        title,
        authors,
        journal,
        doi: doi || null,
        link: link || null,
        abstract: abstract || null,
        product_id: productId || null,
        status: 'pending',
        points_awarded: 0,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ id: data.id, message: '论文提交成功，等待审核' })
  } catch (err: any) {
    console.error('Paper submit error:', err)
    return NextResponse.json({ error: err.message || '提交失败' }, { status: 500 })
  }
}
