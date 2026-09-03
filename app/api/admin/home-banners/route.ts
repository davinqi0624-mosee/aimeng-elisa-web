import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBannerPayload(body: any) {
  return {
    title: normalizeText(body.title),
    subtitle: normalizeText(body.subtitle),
    eyebrow: normalizeText(body.eyebrow),
    description: normalizeText(body.description),
    cta_label: normalizeText(body.cta_label),
    cta_href: normalizeText(body.cta_href) || '#',
    secondary_label: normalizeText(body.secondary_label),
    secondary_href: normalizeText(body.secondary_href) || '#',
    image_url: normalizeText(body.image_url),
    theme: ['blue', 'emerald', 'amber', 'rose'].includes(normalizeText(body.theme)) ? normalizeText(body.theme) : 'blue',
    sort_order: Number(body.sort_order) || 1,
    is_active: body.is_active !== false,
  }
}

function isMissingHomeBannersTable(message?: string) {
  return Boolean(message?.includes('home_banners') && (message.includes('schema cache') || message.includes('does not exist')))
}

function setupTableResponse(message?: string) {
  return NextResponse.json(
    {
      error: '数据库还没有创建 home_banners 首页广告位表。请先在 Supabase SQL Editor 执行 supabase/migrations/031_home_banners.sql，然后刷新后台页面。',
      detail: message,
      needsSetup: true,
    },
    { status: 500 }
  )
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('home_banners')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) {
    if (isMissingHomeBannersTable(error.message)) return setupTableResponse(error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ banners: data || [] })
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const payload = normalizeBannerPayload(body)
    if (!payload.title || !payload.subtitle || !payload.description) {
      return NextResponse.json({ error: '请填写主标题、副标题和广告描述。' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('home_banners')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      if (isMissingHomeBannersTable(error.message)) return setupTableResponse(error.message)
      throw error
    }
    return NextResponse.json({ banner: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '创建失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const id = normalizeText(body.id)
    if (!id) return NextResponse.json({ error: '缺少广告位 ID。' }, { status: 400 })

    const payload = normalizeBannerPayload(body)
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('home_banners')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (isMissingHomeBannersTable(error.message)) return setupTableResponse(error.message)
      throw error
    }
    return NextResponse.json({ banner: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少广告位 ID。' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('home_banners').delete().eq('id', id)
  if (error) {
    if (isMissingHomeBannersTable(error.message)) return setupTableResponse(error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
