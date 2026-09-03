import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { requireSuper } from '@/lib/admin/auth'

interface StorageItem {
  name: string
  id: string
}

type OrphanFile = {
  bucket: string
  path: string
  publicUrl: string
  fileName: string
  riskLevel: 'low' | 'medium'
  recommendation: 'delete' | 'review'
  confidence: number
  actionLabel: string
  reason: string
}

const CHECKED_REFERENCE_SOURCES = [
  'products: product_image, standard_curve_image, validation_image, additional_image, datasheet_pdf',
  'product_images: image_url',
  'product_documents: file_url',
  'serum_products: image_url',
  'serum_coa_documents: file_url',
  'purchase_point_claim_photos: file_url, file_path',
  'agents: wechat_qr, wechat_qr_code',
  'customer_service_settings: wechat_qr_url',
  'site_settings: homepage_content.home_media_items.cover_image_url, homepage_content.home_media_items.external_url, product_media.product_ad_image_url, product_media.method_image_url, lab_assets.elisa_analysis_template_url, lab_assets.elisa_testing_service_form_url',
  'shop_items: image_url',
  'home_banners: image_url',
  'home_media_items: cover_image_url, external_url',
  'pages: image_url',
]

function classifyOrphan(bucket: string, path: string): Pick<OrphanFile, 'fileName' | 'riskLevel' | 'recommendation' | 'confidence' | 'actionLabel' | 'reason'> {
  const fileName = path.split('/').pop() || path
  const lowerPath = path.toLowerCase()

  if (lowerPath.includes('tmp') || lowerPath.includes('temp') || lowerPath.includes('backup')) {
    return {
      fileName,
      riskLevel: 'low',
      recommendation: 'delete',
      confidence: 85,
      actionLabel: '建议删除',
      reason: '文件路径像临时文件/备份文件，且未在已检查的数据表中被引用，系统判断清理风险较低。',
    }
  }

  if (bucket === 'product-assets' && lowerPath.startsWith('product-documents/')) {
    return {
      fileName,
      riskLevel: 'medium',
      recommendation: 'review',
      confidence: 55,
      actionLabel: '人工确认',
      reason: '文件位于产品文档目录，但未被 product_documents 或产品表引用。删除前建议确认是否是尚未绑定的说明书/COA。',
    }
  }

  if (bucket === 'product-assets' && lowerPath.startsWith('product-defaults/')) {
    return {
      fileName,
      riskLevel: 'medium',
      recommendation: 'review',
      confidence: 60,
      actionLabel: '人工确认',
      reason: '文件位于产品固定图片目录，可能是第 1 或第 3 图片位的历史图。未找到结构化引用时，建议人工确认后再处理。',
    }
  }

  if (bucket === 'agent-assets') {
    return {
      fileName,
      riskLevel: 'medium',
      recommendation: 'review',
      confidence: 60,
      actionLabel: '人工确认',
      reason: '文件位于代理商/客服素材目录，可能是二维码或沟通资料。系统未找到数据库引用，但建议人工确认后再处理。',
    }
  }

  if (bucket === 'page-assets') {
    return {
      fileName,
      riskLevel: 'medium',
      recommendation: 'review',
      confidence: 60,
      actionLabel: '人工确认',
      reason: '文件位于页面素材目录，可能被页面内容或外部宣传链接使用。系统未找到结构化字段引用，建议人工确认。',
    }
  }

  return {
    fileName,
    riskLevel: 'medium',
    recommendation: 'review',
    confidence: 50,
    actionLabel: '人工确认',
    reason: '未在当前系统已检查的数据表中找到引用。若该文件通过手工写死链接、外部页面或未纳入检查的新功能使用，系统无法自动识别。',
  }
}

function normalizeReference(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function addReference(references: Set<string>, value: unknown) {
  const text = normalizeReference(value)
  if (!text) return
  references.add(text)
  try {
    references.add(decodeURI(text))
  } catch {
    // Ignore malformed URL encodings.
  }
}

function isFileReferenced(references: Set<string>, publicUrl: string, bucket: string, path: string) {
  const encodedUrl = encodeURI(publicUrl)
  const encodedPath = encodeURI(path)
  const storagePath = `${bucket}/${path}`
  const encodedStoragePath = `${bucket}/${encodedPath}`

  if (
    references.has(publicUrl) ||
    references.has(encodedUrl) ||
    references.has(path) ||
    references.has(encodedPath) ||
    references.has(storagePath) ||
    references.has(encodedStoragePath)
  ) {
    return true
  }

  for (const ref of references) {
    if (
      ref.includes(publicUrl) ||
      ref.includes(encodedUrl) ||
      ref.includes(storagePath) ||
      ref.includes(encodedStoragePath)
    ) {
      return true
    }
  }

  return false
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
    const body = (await request.json().catch(() => ({}))) as {
      confirmDelete?: boolean
      deleteScope?: 'recommended' | 'all'
    }
    const confirmDelete = body.confirmDelete === true
    const deleteScope = body.deleteScope === 'all' ? 'all' : 'recommended'
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
          addReference(referencedPaths, url)
        }
      }
    }

    const { data: productImages } = await supabase.from('product_images').select('image_url')
    if (productImages) {
      for (const image of productImages) {
        addReference(referencedPaths, image.image_url)
      }
    }

    // Agents table (check both columns for safety)
    const { data: agents } = await supabase.from('agents').select('wechat_qr, wechat_qr_code')
    if (agents) {
      for (const a of agents) {
        addReference(referencedPaths, a.wechat_qr)
        addReference(referencedPaths, a.wechat_qr_code)
      }
    }

    // Shop items table
    const { data: shopItems } = await supabase.from('shop_items').select('image_url')
    if (shopItems) {
      for (const s of shopItems) {
        addReference(referencedPaths, s.image_url)
      }
    }

    // Home banners table
    const { data: homeBanners } = await supabase.from('home_banners').select('image_url')
    if (homeBanners) {
      for (const banner of homeBanners) {
        addReference(referencedPaths, banner.image_url)
      }
    }

    const { data: homeMediaItems } = await supabase.from('home_media_items').select('cover_image_url, external_url')
    if (homeMediaItems) {
      for (const item of homeMediaItems) {
        addReference(referencedPaths, item.cover_image_url)
        addReference(referencedPaths, item.external_url)
      }
    }

    // Official customer service QR is separate from regional agent QR codes.
    const { data: customerServiceSettings } = await supabase
      .from('customer_service_settings')
      .select('wechat_qr_url')
    if (customerServiceSettings) {
      for (const settings of customerServiceSettings) {
        addReference(referencedPaths, settings.wechat_qr_url)
      }
    }

    let siteSettings: Array<{
      homepage_content?: unknown
      product_media?: unknown
      lab_assets?: unknown
    }> | null = null
    const { data: siteSettingsWithLabAssets, error: siteSettingsWithLabAssetsError } = await supabase
      .from('site_settings')
      .select('homepage_content, product_media, lab_assets')
    if (siteSettingsWithLabAssetsError?.message.includes('lab_assets')) {
      const { data: fallbackSiteSettings } = await supabase
        .from('site_settings')
        .select('homepage_content, product_media')
      siteSettings = fallbackSiteSettings
    } else {
      siteSettings = siteSettingsWithLabAssets
    }

    if (siteSettings) {
      for (const settings of siteSettings) {
        const productMedia = settings.product_media as {
          product_ad_image_url?: string
          method_image_url?: string
        } | null
        const labAssets = settings.lab_assets as {
          elisa_analysis_template_url?: string
          elisa_testing_service_form_url?: string
        } | null
        const homepageContent = settings.homepage_content as {
          home_media_items?: Array<{ cover_image_url?: string; external_url?: string }>
        } | null
        for (const item of homepageContent?.home_media_items || []) {
          addReference(referencedPaths, item.cover_image_url)
          addReference(referencedPaths, item.external_url)
        }
        addReference(referencedPaths, productMedia?.product_ad_image_url)
        addReference(referencedPaths, productMedia?.method_image_url)
        addReference(referencedPaths, labAssets?.elisa_analysis_template_url)
        addReference(referencedPaths, labAssets?.elisa_testing_service_form_url)
      }
    }

    // Serum products and COA documents added after the original cleanup tool.
    const { data: serumProducts } = await supabase.from('serum_products').select('image_url')
    if (serumProducts) {
      for (const product of serumProducts) {
        addReference(referencedPaths, product.image_url)
      }
    }

    const { data: serumCoaDocuments } = await supabase.from('serum_coa_documents').select('file_url')
    if (serumCoaDocuments) {
      for (const document of serumCoaDocuments) {
        addReference(referencedPaths, document.file_url)
      }
    }

    const { data: productDocuments } = await supabase.from('product_documents').select('file_url')
    if (productDocuments) {
      for (const document of productDocuments) {
        addReference(referencedPaths, document.file_url)
      }
    }

    const { data: purchasePointClaimPhotos } = await supabase
      .from('purchase_point_claim_photos')
      .select('file_url, file_path')
    if (purchasePointClaimPhotos) {
      for (const photo of purchasePointClaimPhotos) {
        addReference(referencedPaths, photo.file_url)
        addReference(referencedPaths, photo.file_path)
      }
    }

    // Pages table
    const { data: pages } = await supabase.from('pages').select('image_url')
    if (pages) {
      for (const p of pages) {
        addReference(referencedPaths, p.image_url)
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
    const orphans: OrphanFile[] = []
    for (const file of allFiles) {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${file.bucket}/${file.path}`
      if (!isFileReferenced(referencedPaths, publicUrl, file.bucket, file.path)) {
        const classification = classifyOrphan(file.bucket, file.path)
        orphans.push({
          bucket: file.bucket,
          path: file.path,
          publicUrl,
          ...classification,
        })
      }
    }

    // 4. Delete orphaned files only after an explicit second-step confirmation.
    const deletedByBucket: Record<string, number> = {}
    const deleteTargets = deleteScope === 'all'
      ? orphans
      : orphans.filter((orphan) => orphan.recommendation === 'delete')

    if (confirmDelete) {
      for (const bucket of buckets) {
        const bucketOrphans = deleteTargets.filter((o) => o.bucket === bucket)
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
    }

    const totalDeleted = Object.values(deletedByBucket).reduce((a, b) => a + b, 0)
    const deletedTargetKeys = new Set(deleteTargets.map((file) => `${file.bucket}/${file.path}`))
    const visibleOrphans = confirmDelete
      ? orphans.filter((file) => !deletedTargetKeys.has(`${file.bucket}/${file.path}`))
      : orphans
    const recommendationSummary = visibleOrphans.reduce<Record<OrphanFile['recommendation'], number>>(
      (summary, orphan) => {
        summary[orphan.recommendation] += 1
        return summary
      },
      { delete: 0, review: 0 }
    )

    return NextResponse.json({
      success: true,
      mode: confirmDelete ? 'delete' : 'preview',
      deleteScope,
      totalFiles: allFiles.length,
      referencedFiles: referencedPaths.size,
      orphanedFiles: visibleOrphans.length,
      recommendedDeleteFiles: recommendationSummary.delete,
      reviewRequiredFiles: recommendationSummary.review,
      deletedFiles: totalDeleted,
      deletedByBucket,
      orphanFiles: visibleOrphans.slice(0, 80),
      orphanPreviewLimit: 80,
      checkedReferenceSources: CHECKED_REFERENCE_SOURCES,
      warning: confirmDelete
        ? deleteScope === 'all'
          ? '已按本次扫描结果删除全部未引用文件。'
          : '已删除系统建议可删除的低风险未引用文件；需人工确认的文件已保留。'
        : '当前仅为扫描预览，未删除任何文件。系统会给出建议处理方式，默认只允许删除低风险建议删除文件。',
    })
  } catch (err: unknown) {
    console.error('[storage-cleanup] Exception:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message || '清理失败' : '清理失败' }, { status: 500 })
  }
}
