import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminOrSuper } from '@/lib/admin/auth'

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: '服务器缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量，请联系管理员在 Vercel 后台添加该变量' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
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
  } catch (err: any) {
    console.error('[admin/upload] Exception:', err)
    return NextResponse.json({ error: err.message || '上传失败' }, { status: 500 })
  }
}
