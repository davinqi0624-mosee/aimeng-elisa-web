import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Total sessions
    const { count: totalSessions } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Total messages
    const { count: totalMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user')

    // Mode distribution
    const { data: modeData } = await supabase
      .from('chat_sessions')
      .select('mode')
      .eq('user_id', user.id)

    const modeDistribution: Record<string, number> = {}
    modeData?.forEach((s: any) => {
      modeDistribution[s.mode] = (modeDistribution[s.mode] || 0) + 1
    })

    // Daily stats (last 14 days)
    const { data: dailyData } = await supabase
      .from('chat_sessions')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())

    const dailyStats: Record<string, number> = {}
    dailyData?.forEach((s: any) => {
      const date = s.created_at.split('T')[0]
      dailyStats[date] = (dailyStats[date] || 0) + 1
    })

    return NextResponse.json({
      totalSessions: totalSessions || 0,
      totalMessages: totalMessages || 0,
      modeDistribution,
      dailyStats,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
