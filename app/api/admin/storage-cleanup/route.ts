import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { requireSuper } from '@/lib/admin/auth'

interface StorageItem {
  name: string
  id: string
}

async function listAllFiles(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string = ''
): Promise<StorageItem[]> {
  const files: StorageItem[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
    })

    if (error) {
      console.error(`[storage-cleanup] List error in ${bucket}/${prefix}:`, error)
      break
    }

    if (!data || data.length === 0) break

    for (const item of data) {
      if (!item.id) {
        // It's a folder
        const subPrefix = prefix ? `${prefix}/${item.name}` : item.name
        const subFiles = await listAllFiles(supabase, bucket, subPrefix)
        files.push(...subFiles)
      } else {
        files.push({
          name: prefix ? `${prefix}/${item.name}` : item.name,
          id: item.id,
        })
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return files
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Collect all referenced URLs from database tables
    const referencedPaths = new Set<string>()

    // Products table
    const { data: products } = await supabase
      .from('products')
      .select('product_image, standard_curve_image, validation_image, additional_image, datasheet_pdf')

    if (products) {
      for (const p of products) {
        for (const url of [
          p.product_image,
          p.standard_curve_image,
          p.validation_image,
          p.additional_image,
          p.datasheet_pdf,
        ]) {
          if (url) referencedPaths.add(url)
        }
      }
    }

    // Agents table (check both columns for safety)
    const { data: agents } = await supabase.from('agents').select('wechat_qr, wechat_qr_code')
    if (agents) {
      for (const a of agents) {
        if (a.wechat_qr) referencedPaths.add(a.wechat_qr)
        if (a.wechat_qr_code) referencedPaths.add(a.wechat_qr_code)
      }
    }

    // Shop items table
    const { data: shopItems } = await supabase.from('shop_items').select('image_url')
    if (shopItems) {
      for (const s of shopItems) {
        if (s.image_url) referencedPaths.add(s.image_url)
      }
    }

    // Pages table
    const { data: pages } = await supabase.from('pages').select('image_url')
    if (pages) {
      for (const p of pages) {
        if (p.image_url) referencedPaths.add(p.image_url)
      }
    }

    // 2. List all files in storage buckets
    const buckets = ['product-assets', 'agent-assets', 'page-assets']
    const allFiles: { bucket: string; path: string; id: string }[] = []

    for (const bucket of buckets) {
      const files = await listAllFiles(supabase, bucket)
      for (const f of files) {
        allFiles.push({ bucket, path: f.name, id: f.id })
      }
    }

    // 3. Find orphaned files
    const orphans: { bucket: string; path: string }[] = []
    for (const file of allFiles) {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${file.bucket}/${file.path}`
      if (!referencedPaths.has(publicUrl)) {
        orphans.push({ bucket: file.bucket, path: file.path })
      }
    }

    // 4. Delete orphaned files (grouped by bucket)
    const deletedByBucket: Record<string, number> = {}
    for (const bucket of buckets) {
      const bucketOrphans = orphans.filter((o) => o.bucket === bucket)
      if (bucketOrphans.length > 0) {
        const paths = bucketOrphans.map((o) => o.path)
        // Supabase remove accepts max ~100 items at a time
        for (let i = 0; i < paths.length; i += 100) {
          const batch = paths.slice(i, i + 100)
          const { error } = await supabase.storage.from(bucket).remove(batch)
          if (error) {
            console.error(`[storage-cleanup] Delete error in ${bucket}:`, error)
          }
        }
        deletedByBucket[bucket] = bucketOrphans.length
      }
    }

    const totalDeleted = Object.values(deletedByBucket).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      totalFiles: allFiles.length,
      referencedFiles: referencedPaths.size,
      orphanedFiles: orphans.length,
      deletedFiles: totalDeleted,
      deletedByBucket,
    })
  } catch (err: any) {
    console.error('[storage-cleanup] Exception:', err)
    return NextResponse.json({ error: err.message || '清理失败' }, { status: 500 })
  }
}
