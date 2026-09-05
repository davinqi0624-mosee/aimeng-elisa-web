import { getCurrentUser } from '@/lib/user-auth'
import { NextRequest, NextResponse } from 'next/server'
import { withUser } from '@/lib/db/pg'

// 我的说明书（auto_datasheets）：withUser 直连，own 策略（app_uid() = user_id）在 DB 层强制
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  try {
    if (id) {
      const rows = await withUser(user.id, async (tx) => {
        return tx<Record<string, unknown>[]>`
          SELECT d.*,
                 row_to_json(t.*) AS datasheet_template,
                 row_to_json(ab.*) AS antibody
          FROM auto_datasheets d
          LEFT JOIN datasheet_templates t ON t.id = d.template_id
          LEFT JOIN antibody_catalog ab ON ab.id = d.antibody_id
          WHERE d.id = ${id} AND d.user_id = app_uid()
          LIMIT 1
        `
      })
      if (!rows[0]) {
        return NextResponse.json({ error: '说明书不存在' }, { status: 404 })
      }
      return NextResponse.json({ datasheet: rows[0] })
    }

    const datasheets = await withUser(user.id, async (tx) => {
      return tx<Record<string, unknown>[]>`
        SELECT id, title, target, species, method, status, created_at, updated_at
        FROM auto_datasheets
        WHERE user_id = app_uid()
        ORDER BY created_at DESC
      `
    })
    return NextResponse.json({ datasheets })
  } catch (error) {
    console.error('[datasheet GET]', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const body = await request.json()
    const { id, title, content, status } = body
    if (!id) return NextResponse.json({ error: '缺少说明书ID' }, { status: 400 })

    const rows = await withUser(user.id, async (tx) => {
      return tx<{ id: string }[]>`
        UPDATE auto_datasheets
        SET updated_at = now(),
            title = COALESCE(${title ?? null}, title),
            content = COALESCE(${content ?? null}, content),
            status = COALESCE(${status ?? null}, status)
        WHERE id = ${id} AND user_id = app_uid()
        RETURNING id
      `
    })

    if (!rows[0]) {
      return NextResponse.json({ error: '说明书不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, id: rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: '缺少说明书ID' }, { status: 400 })

    const rows = await withUser(user.id, async (tx) => {
      return tx<{ id: string }[]>`
        DELETE FROM auto_datasheets
        WHERE id = ${id} AND user_id = app_uid()
        RETURNING id
      `
    })

    if (!rows[0]) {
      return NextResponse.json({ error: '说明书不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
