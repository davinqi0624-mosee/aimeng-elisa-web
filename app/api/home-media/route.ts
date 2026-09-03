import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_HOME_MEDIA_ITEMS, hasValidPublicHomeMediaLink, type HomeMediaItem } from '@/lib/home-media'
import { SHORT_PUBLIC_CACHE_HEADERS, getMemoryCached } from '@/lib/server/memory-cache'

export const dynamic = 'force-dynamic'

function isMissingHomeMediaTable(message?: string) {
  return Boolean(message?.includes('home_media_items') && (message.includes('schema cache') || message.includes('does not exist')))
}

function normalizeStoredItems(value: unknown): HomeMediaItem[] {
  return Array.isArray(value)
    ? value.filter((item): item is HomeMediaItem => Boolean(item && typeof item === 'object' && 'title' in item && 'external_url' in item))
    : []
}

export async function GET() {
  try {
    const cached = await getMemoryCached('api:home-media', 60 * 1000, async () => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('home_media_items')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('is_featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false })

      if (error) {
        if (isMissingHomeMediaTable(error.message)) {
          const { data: settings } = await supabase
            .from('site_settings')
            .select('homepage_content')
            .eq('id', 1)
            .maybeSingle()
          const homepageContent = settings?.homepage_content as { home_media_items?: unknown } | null
          const storedItems = normalizeStoredItems(homepageContent?.home_media_items)
            .filter((item) => item.is_active && hasValidPublicHomeMediaLink(item))
          return { items: storedItems.length ? storedItems : DEFAULT_HOME_MEDIA_ITEMS, fallback: true }
        }
        console.warn('[home-media] fallback to defaults:', error.message)
        return { items: DEFAULT_HOME_MEDIA_ITEMS, fallback: true }
      }

      const publicItems = (data || []).filter((item) => hasValidPublicHomeMediaLink(item))
      return { items: publicItems.length ? publicItems : DEFAULT_HOME_MEDIA_ITEMS }
    })

    return NextResponse.json(cached.value, {
      headers: {
        ...SHORT_PUBLIC_CACHE_HEADERS,
        'X-Aimeng-Cache': cached.hit ? 'hit' : 'miss',
      },
    })
  } catch (error) {
    console.warn('[home-media] unavailable, fallback to defaults:', error)
    return NextResponse.json({ items: DEFAULT_HOME_MEDIA_ITEMS, fallback: true }, { headers: SHORT_PUBLIC_CACHE_HEADERS })
  }
}
