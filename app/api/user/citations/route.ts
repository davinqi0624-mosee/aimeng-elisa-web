import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  try {
    const { data: papers, error } = await supabase
      .from('papers')
      .select('*, products(name, target)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ papers: papers || [] })
  } catch (err: unknown) {
    console.error('[user/citations]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '读取文献投稿失败' }, { status: 500 })
  }
}
