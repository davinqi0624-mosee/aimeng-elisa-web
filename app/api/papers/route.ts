import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  return NextResponse.json(
    { error: '旧论文投稿接口已停用，请使用“文献引用提交”页面上传 PDF 或截图。' },
    { status: 410 }
  )
}
