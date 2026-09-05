import { getCurrentUser } from '@/lib/user-auth'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withUser } from '@/lib/db/pg'

type PaperRow = Record<string, unknown> & {
  id: string
  user_id: string
  upload_status: string
  created_at: Date | string
}

// 已登录：withUser 直连（RLS own + public 策略在 DB 层过滤）
// 未登录：anon 客户端（仅 papers_select_public 公开已验证文献）
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'verified'
  const myPapers = searchParams.get('mine') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 100)

  try {
    if (!user) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('papers')
        .select('*, products(name, target)')
        .eq('upload_status', status === 'all' ? 'verified' : status)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return NextResponse.json({ papers: data || [] })
    }

    const papers = await withUser(user.id, async (tx) => {
      if (myPapers && status !== 'all') {
        return tx<PaperRow[]>`
          SELECT p.*, row_to_json(prod.*) AS product
          FROM papers p LEFT JOIN products prod ON prod.id = p.product_id
          WHERE upload_status = ${status} AND user_id = app_uid()
          ORDER BY p.created_at DESC LIMIT ${limit}
        `
      }
      if (myPapers) {
        return tx<PaperRow[]>`
          SELECT p.*, row_to_json(prod.*) AS product
          FROM papers p LEFT JOIN products prod ON prod.id = p.product_id
          WHERE user_id = app_uid()
          ORDER BY p.created_at DESC LIMIT ${limit}
        `
      }
      if (status !== 'all') {
        return tx<PaperRow[]>`
          SELECT p.*, row_to_json(prod.*) AS product
          FROM papers p LEFT JOIN products prod ON prod.id = p.product_id
          WHERE upload_status = ${status}
          ORDER BY p.created_at DESC LIMIT ${limit}
        `
      }
      return tx<PaperRow[]>`
        SELECT p.*, row_to_json(prod.*) AS product
        FROM papers p LEFT JOIN products prod ON prod.id = p.product_id
        ORDER BY p.created_at DESC LIMIT ${limit}
      `
    })
    return NextResponse.json({ papers })
  } catch (error) {
    console.error('[papers GET]', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: '旧论文投稿接口已停用，请使用“文献引用提交”页面上传 PDF 或截图。' },
    { status: 410 }
  )
}
