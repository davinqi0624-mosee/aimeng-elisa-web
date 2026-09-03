import { createReadStream, existsSync } from 'fs'
import { Readable } from 'node:stream'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { DATASHEET_TEMPLATE_DIR } from '@/lib/datasheet/templates'

export async function GET(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError
  if (admin!.role !== 'super') {
    return NextResponse.json({ error: '只有超级管理员可以下载说明书 Word 模板。' }, { status: 403 })
  }

  const file = new URL(request.url).searchParams.get('file') || ''
  if (!file || file.includes('..') || file.includes('/') || file.includes('\\')) {
    return NextResponse.json({ error: '模板文件名无效' }, { status: 400 })
  }

  const fullPath = path.join(DATASHEET_TEMPLATE_DIR, file)
  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: '模板文件不存在' }, { status: 404 })
  }

  const stream = Readable.toWeb(createReadStream(fullPath)) as ReadableStream<Uint8Array>
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file)}`,
    },
  })
}
