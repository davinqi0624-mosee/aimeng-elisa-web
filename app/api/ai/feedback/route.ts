import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { conversationId, feedback } = body

  if (!conversationId || !feedback || !['upvote', 'downvote'].includes(feedback)) {
    return NextResponse.json({ error: '缺少参数或无效反馈类型' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: '服务器缺少 SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { error } = await supabase
      .from('ai_conversations')
      .update({ feedback })
      .eq('id', conversationId)

    if (error) {
      console.error('[ai/feedback] update error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversationId, feedback })
  } catch (err: any) {
    console.error('[ai/feedback] exception:', err)
    return NextResponse.json({ error: err.message || '提交失败' }, { status: 500 })
  }
}
