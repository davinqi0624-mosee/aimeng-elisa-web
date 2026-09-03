import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlayableHomeMediaUrl, type HomeMediaCategory, type HomeMediaItem } from '@/lib/home-media'

const CATEGORIES = new Set(['elisa', 'cell_culture'])

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function looksLikeFilesystemPath(value: string) {
  return (
    /^file:\/\//i.test(value) ||
    /^[a-zA-Z]:[\\/]/.test(value) ||
    /^\/users?\//i.test(value) ||
    /^\/volumes\//i.test(value)
  )
}

function normalizeDate(value: unknown) {
  const text = clean(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeHomeMediaPayload(body: Record<string, unknown>) {
  const category = clean(body.category)
  return {
    category: (CATEGORIES.has(category) ? category : 'elisa') as HomeMediaCategory,
    title: clean(body.title),
    summary: clean(body.summary),
    platform: clean(body.platform) || '小红书',
    external_url: clean(body.external_url),
    cover_image_url: clean(body.cover_image_url),
    published_at: normalizeDate(body.published_at),
    sort_order: Number(body.sort_order) || 1,
    is_featured: body.is_featured === true,
    is_active: body.is_active !== false,
  }
}

function validateHomeMediaPayload(payload: ReturnType<typeof normalizeHomeMediaPayload>) {
  if (!payload.title) return '请填写视频标题。'
  if (!payload.external_url) return '请上传本地视频，或填写自媒体平台链接。'
  if (payload.platform === '本地视频' && looksLikeFilesystemPath(payload.external_url)) {
    return '本地视频不能填写电脑本地路径。请点击“上传本地视频”，让文件先进入网站存储。'
  }
  if (payload.platform === '本地视频' && !isPlayableHomeMediaUrl(payload.external_url)) {
    return '本地视频必须使用有效的视频文件地址。请点击“上传本地视频”，不要填写 /videos 或普通文字。'
  }
  return ''
}

function parsePublicStorageUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const marker = '/storage/v1/object/public/'
  const markerIndex = value.indexOf(marker)
  if (markerIndex < 0) return null
  const storagePath = value.slice(markerIndex + marker.length)
  const separatorIndex = storagePath.indexOf('/')
  if (separatorIndex <= 0 || separatorIndex === storagePath.length - 1) return null
  return {
    bucket: storagePath.slice(0, separatorIndex),
    path: storagePath.slice(separatorIndex + 1),
  }
}

async function removeReferencedStorageFiles(supabase: SupabaseClient, values: unknown[]) {
  const files = values
    .map(parsePublicStorageUrl)
    .filter((value): value is { bucket: string; path: string } => Boolean(value))
  const uniqueFiles = Array.from(new Map(files.map((file) => [`${file.bucket}/${file.path}`, file])).values())

  await Promise.all(uniqueFiles.map(async ({ bucket, path }) => {
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) {
      console.warn(`[home-media] failed to remove storage file ${bucket}/${path}:`, error.message)
    }
  }))
}

function isMissingHomeMediaTable(message?: string) {
  return Boolean(message?.includes('home_media_items') && (message.includes('schema cache') || message.includes('does not exist')))
}

function setupTableResponse(message?: string) {
  return NextResponse.json(
    {
      error: '数据库还没有创建 home_media_items 自媒体内容表。请先执行 supabase/migrations/053_home_media_items.sql，然后刷新后台页面。',
      detail: message,
      needsSetup: true,
    },
    { status: 500 }
  )
}

function createFallbackId() {
  return `home-media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeStoredItems(value: unknown): HomeMediaItem[] {
  return Array.isArray(value)
    ? value.filter((item): item is HomeMediaItem => Boolean(item && typeof item === 'object' && 'id' in item && 'title' in item && 'external_url' in item))
    : []
}

async function loadFallbackItems(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('site_settings')
    .select('homepage_content')
    .eq('id', 1)
    .maybeSingle()

  if (error) throw error
  const homepageContent = (data?.homepage_content || {}) as Record<string, unknown>
  return {
    homepageContent,
    items: normalizeStoredItems(homepageContent.home_media_items),
  }
}

async function saveFallbackItems(supabase: SupabaseClient, homepageContent: Record<string, unknown>, items: HomeMediaItem[]) {
  const { error } = await supabase
    .from('site_settings')
    .upsert({
      id: 1,
      homepage_content: {
        ...homepageContent,
        home_media_items: items,
      },
    }, { onConflict: 'id' })

  if (error) throw error
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('home_media_items')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) {
    if (isMissingHomeMediaTable(error.message)) {
      try {
        const fallback = await loadFallbackItems(supabase)
        return NextResponse.json({ items: fallback.items, fallback: true })
      } catch (fallbackError) {
        return setupTableResponse(fallbackError instanceof Error ? fallbackError.message : error.message)
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data || [] })
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const payload = normalizeHomeMediaPayload(body)
    const validationError = validateHomeMediaPayload(payload)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('home_media_items')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      if (isMissingHomeMediaTable(error.message)) {
        const fallback = await loadFallbackItems(supabase)
        const item: HomeMediaItem = {
          id: createFallbackId(),
          ...payload,
        }
        await saveFallbackItems(supabase, fallback.homepageContent, [...fallback.items, item])
        return NextResponse.json({ item, fallback: true })
      }
      throw error
    }
    return NextResponse.json({ item: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '创建失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const id = clean(body.id)
    if (!id) return NextResponse.json({ error: '缺少自媒体内容 ID。' }, { status: 400 })

    const payload = normalizeHomeMediaPayload(body)
    const validationError = validateHomeMediaPayload(payload)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('home_media_items')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (isMissingHomeMediaTable(error.message)) {
        const fallback = await loadFallbackItems(supabase)
        const item: HomeMediaItem = { id, ...payload }
        const nextItems = fallback.items.map((existing) => existing.id === id ? item : existing)
        const hasExisting = fallback.items.some((existing) => existing.id === id)
        await saveFallbackItems(supabase, fallback.homepageContent, hasExisting ? nextItems : [...fallback.items, item])
        return NextResponse.json({ item, fallback: true })
      }
      throw error
    }
    return NextResponse.json({ item: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少自媒体内容 ID。' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: existingItem } = await supabase
    .from('home_media_items')
    .select('external_url, cover_image_url')
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase.from('home_media_items').delete().eq('id', id)
  if (error) {
    if (isMissingHomeMediaTable(error.message)) {
      try {
        const fallback = await loadFallbackItems(supabase)
        const itemToDelete = fallback.items.find((item) => item.id === id)
        await saveFallbackItems(
          supabase,
          fallback.homepageContent,
          fallback.items.filter((item) => item.id !== id)
        )
        if (itemToDelete) {
          await removeReferencedStorageFiles(supabase, [itemToDelete.external_url, itemToDelete.cover_image_url])
        }
        return NextResponse.json({ success: true, fallback: true })
      } catch (fallbackError) {
        return setupTableResponse(fallbackError instanceof Error ? fallbackError.message : error.message)
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (existingItem) {
    await removeReferencedStorageFiles(supabase, [existingItem.external_url, existingItem.cover_image_url])
  }
  return NextResponse.json({ success: true })
}
