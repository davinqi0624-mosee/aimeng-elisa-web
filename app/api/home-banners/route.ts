import { NextResponse } from 'next/server'
import { DEFAULT_HOME_BANNERS, getHomeBanners } from '@/lib/home-banners'
import { SHORT_PUBLIC_CACHE_HEADERS, getMemoryCached } from '@/lib/server/memory-cache'

export async function GET() {
  try {
    const cached = await getMemoryCached('api:home-banners', 60 * 1000, async () => ({
      banners: await getHomeBanners(),
    }))
    return NextResponse.json(cached.value, {
      headers: {
        ...SHORT_PUBLIC_CACHE_HEADERS,
        'X-Aimeng-Cache': cached.hit ? 'hit' : 'miss',
      },
    })
  } catch {
    return NextResponse.json({ banners: DEFAULT_HOME_BANNERS }, { headers: SHORT_PUBLIC_CACHE_HEADERS })
  }
}
