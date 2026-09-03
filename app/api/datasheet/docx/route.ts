import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPreferredDatasheetTemplate } from '@/lib/datasheet/templates'
import { renderDatasheetDocx } from '@/lib/datasheet/docx'

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '生成 Word 文件失败。')
}

export async function GET(request: NextRequest) {
  try {
    const { admin, error: authError } = await requireAdminOrSuper(request)
    if (authError) return authError

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: '缺少说明书 ID。' }, { status: 400 })
    }

    const template = await getPreferredDatasheetTemplate()
    if (!template) {
      return NextResponse.json({ error: '未检测到 Word 模板。' }, { status: 404 })
    }
    if (!template.hasPlaceholders) {
      return NextResponse.json(
        {
          error: '当前 Word 模板尚未设置 {{field_name}} 占位符，无法生成正式 DOCX。请先按占位符规范改造模板。',
        },
        { status: 409 }
      )
    }

    const supabase = createAdminClient()
    let query = supabase
      .from('auto_datasheets')
      .select('id,title,target,species,method,catalog_number,size,content,admin_id')
      .eq('id', id)

    if (admin!.role !== 'super') {
      query = query.eq('admin_id', admin!.id)
    }

    const { data, error } = await query.single()
    if (error || !data) {
      return NextResponse.json({ error: '说明书不存在，或当前账号无权下载。' }, { status: 404 })
    }

    const bytes = await renderDatasheetDocx(template, {
      title: data.title,
      target: data.target,
      species: data.species,
      method: data.method,
      catalog_number: data.catalog_number,
      size: data.size,
      content: data.content || {},
    })

    const fileName = safeFileName(`${data.catalog_number || data.id} ${data.target || 'datasheet'}.docx`)
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
