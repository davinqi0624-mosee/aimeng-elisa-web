import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

function safeFileName(name: string) {
  const cleaned = name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(-120)
  return cleaned || 'citation-file'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '请先选择要上传的 PDF 或截图。' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: '仅支持 PDF、PNG、JPG、WebP 文件。' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '文件不能超过 20MB。' }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex')
    const admin = createAdminClient()
    const path = `${user.id}/${Date.now()}-${safeFileName(file.name)}`
    const { data, error } = await admin.storage.from('citation-files').upload(path, fileBuffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

    if (error) throw error

    const { data: urlData } = admin.storage.from('citation-files').getPublicUrl(data.path)
    return NextResponse.json({
      url: urlData.publicUrl,
      path: data.path,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      fileHash,
    })
  } catch (err: unknown) {
    console.error('[citations/upload]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message || '上传失败' : '上传失败' }, { status: 500 })
  }
}
