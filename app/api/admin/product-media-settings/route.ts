import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type ProductMediaSettings = {
  product_ad_image_url?: string
  method_image_url?: string
}

const DEFAULT_SETTINGS = {
  id: 1,
  product_media: {
    product_ad_image_url: '/images/elisa/elisa_sandwich_lego.jpg',
    method_image_url: '/images/elisa/elisa_sandwich_sketch.jpg',
  },
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isMissingTable(message?: string) {
  return Boolean(
    message?.includes('site_settings') &&
      (message.includes('schema cache') || message.includes('does not exist'))
  )
}

function normalizeSettings(value: unknown): ProductMediaSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS.product_media
  const settings = value as ProductMediaSettings
  return {
    product_ad_image_url: clean(settings.product_ad_image_url) || DEFAULT_SETTINGS.product_media.product_ad_image_url,
    method_image_url: clean(settings.method_image_url) || DEFAULT_SETTINGS.product_media.method_image_url,
  }
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('id, product_media')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({
        settings: DEFAULT_SETTINGS.product_media,
        needsSetup: true,
        error: '全站产品图片配置表尚未初始化，请先执行 supabase/migrations/049_product_media_settings_and_catalog_reset.sql。',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: normalizeSettings(data?.product_media) })
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const body = (await request.json().catch(() => ({}))) as ProductMediaSettings
  const payload = {
    id: 1,
    product_media: {
      product_ad_image_url: clean(body.product_ad_image_url) || DEFAULT_SETTINGS.product_media.product_ad_image_url,
      method_image_url: clean(body.method_image_url) || DEFAULT_SETTINGS.product_media.method_image_url,
    },
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('site_settings')
    .upsert(payload, { onConflict: 'id' })
    .select('product_media')
    .single()

  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json(
        { error: '全站产品图片配置表尚未初始化，请先执行 supabase/migrations/049_product_media_settings_and_catalog_reset.sql。' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    settings: normalizeSettings(data?.product_media),
    message: '固定产品图片已保存',
  })
}
