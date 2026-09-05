import { getCurrentUser } from '@/lib/user-auth'
import { NextResponse } from 'next/server'
import { withUser } from '@/lib/db/pg'

// 我的文献投稿：withUser 直连，RLS（papers_select_own: app_uid() = user_id）在 DB 层强制
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  try {
    const papers = await withUser(user.id, async (tx) => {
      return tx<Record<string, unknown>[]>`
        SELECT p.*, row_to_json(prod.*) AS product
        FROM papers p
        LEFT JOIN products prod ON prod.id = p.product_id
        WHERE p.user_id = app_uid()
        ORDER BY p.created_at DESC
      `
    })
    return NextResponse.json({ papers })
  } catch (err: unknown) {
    console.error('[user/citations]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '读取文献投稿失败' }, { status: 500 })
  }
}
