import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET_PATH_PREFIXES: Record<string, string[]> = {
  'product-assets': [
    'products/',
    'product-documents/',
    'serum-coa/',
    'serum-products/',
    'shop/',
    'home-banners/',
    'home-media/',
    'customer-service/',
    'product-defaults/',
  ],
  'agent-assets': ['agents/'],
  'page-assets': ['pages/', 'settings/', 'customer-service/'],
  'citation-files': ['citations/'],
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string) || 'product-assets'
    const path = formData.get('path') as string | null
    const oldUrl = formData.get('old_url') as string | null

    if (!file) {
      return NextResponse.json({ error: '缺少文件' }, { status: 400 })
    }
    if (!path) {
      return NextResponse.json({ error: '缺少存储路径' }, { status: 400 })
    }
    if (!['product-assets', 'agent-assets', 'page-assets', 'citation-files'].includes(bucket)) {
      return NextResponse.json({ error: '不允许上传到该存储桶' }, { status: 400 })
    }
    if (path.includes('..') || path.startsWith('/') || path.startsWith('\\')) {
      return NextResponse.json({ error: '存储路径不合法' }, { status: 400 })
    }
    const allowedPrefixes = BUCKET_PATH_PREFIXES[bucket] || []
    if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
      return NextResponse.json({ error: '存储路径不在允许的目录中' }, { status: 400 })
    }
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: '文件不能超过 100MB' }, { status: 400 })
    }
    const allowedTypes = new Set([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-m4v',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
    ])
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'ogg', 'm4v', 'mov', 'pdf', 'xls', 'xlsx', 'doc', 'docx', 'csv'])
    if (!allowedTypes.has(file.type) && !allowedExtensions.has(fileExtension)) {
      return NextResponse.json({ error: '文件格式不支持，请上传图片、PDF、Word 或 Excel 文件' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const isImage = file.type.startsWith('image/')
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: isImage ? '31536000' : '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

    if (error) {
      console.error('[admin/upload] Storage upload error (full):', JSON.stringify(error))
      const msg = error.message || ''
      const lowerMsg = msg.toLowerCase()
      // Only show bucket-not-found for very specific error patterns
      if (
        lowerMsg.includes('bucket') &&
        (lowerMsg.includes('does not exist') || lowerMsg.includes('not found') || lowerMsg.includes('不存在'))
      ) {
        return NextResponse.json(
          { error: `Storage bucket "${bucket}" 不存在，请在 Supabase 控制台中创建该存储桶` },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: msg || '上传失败' }, { status: 500 })
    }

    // Delete old file if provided
    if (oldUrl) {
      try {
        const oldPath = oldUrl.split('/storage/v1/object/public/')[1]
        if (oldPath) {
          const bucketName = oldPath.split('/')[0]
          const filePath = oldPath.slice(bucketName.length + 1)
          await supabase.storage.from(bucketName).remove([filePath])
        }
      } catch (delErr) {
        console.error('[admin/upload] Failed to delete old file:', delErr)
      }
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return NextResponse.json({ url: urlData.publicUrl, path: data.path })
  } catch (err: unknown) {
    console.error('[admin/upload] Exception:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message || '上传失败' : '上传失败' }, { status: 500 })
  }
}
