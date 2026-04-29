import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { product_cat_no, title, doi, journal, publication_year, authors, abstract } = body

    if (!product_cat_no || !title || !journal) {
      return NextResponse.json({ error: '缺少必填字段（货号、标题、期刊）' }, { status: 400 })
    }

    // Insert paper
    const { data: paper, error: paperErr } = await supabase
      .from('papers')
      .insert({
        user_id: user.id,
        product_cat_no,
        title,
        doi: doi || null,
        journal,
        publication_date: publication_year ? `${publication_year}-01-01` : null,
        authors: authors || null,
        abstract: abstract || null,
        upload_status: 'pending',
        citation_type: 'user_submitted',
        points_awarded: 0,
      })
      .select('id')
      .single()

    if (paperErr) throw paperErr

    // Award 50 points for submission
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_points, available_points')
      .eq('id', user.id)
      .single()

    const currentTotal = profile?.total_points || 0
    const currentAvailable = profile?.available_points || 0

    await supabase.from('point_transactions').insert({
      user_id: user.id,
      amount: 50,
      balance_after: currentAvailable + 50,
      type: 'paper_citation_submitted',
      source_id: paper.id,
      source_table: 'papers',
      description: '文献投稿奖励',
    })

    await supabase
      .from('profiles')
      .update({
        total_points: currentTotal + 50,
        available_points: currentAvailable + 50,
      })
      .eq('id', user.id)

    return NextResponse.json({
      id: paper.id,
      message: '文献提交成功，等待管理员审核',
      pointsAwarded: 50,
    })
  } catch (err: any) {
    console.error('[citations/submit]', err)
    return NextResponse.json({ error: err.message || '提交失败' }, { status: 500 })
  }
}
