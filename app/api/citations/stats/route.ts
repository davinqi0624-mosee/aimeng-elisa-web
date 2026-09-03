import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SHORT_PUBLIC_CACHE_HEADERS, getMemoryCached } from '@/lib/server/memory-cache'

export async function GET() {
  try {
    const cached = await getMemoryCached('api:citations-stats', 2 * 60 * 1000, async () => {
      const supabase = await createClient()
      const { data: papers } = await supabase
        .from('papers')
        .select('impact_factor, journal, publication_date, verified_at, created_at, title, doi, product_cat_no, detected_products, authors, affiliation')
        .eq('upload_status', 'verified')
        .eq('is_displayed', true)
        .order('verified_at', { ascending: false, nullsFirst: false })
        .order('publication_date', { ascending: false })

      const uniquePapers = Array.from(
        new Map((papers || []).map((p) => [p.doi || p.title, p])).values()
      )
      const total = uniquePapers.length
      const totalIF = uniquePapers.reduce((sum, p) => sum + (p.impact_factor || 0), 0) || 0
      const maxPaper = uniquePapers.reduce((max, p) => ((p.impact_factor || 0) > (max?.impact_factor || 0) ? p : max), uniquePapers[0])

      // Monthly growth means newly accepted by the website this month, not the paper publication month.
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const monthly = uniquePapers.filter(p => {
        const acceptedAt = p.verified_at || p.created_at
        return acceptedAt && acceptedAt >= monthStart
      }).length || 0

      // Recent 5 newly accepted papers.
      const recentPapers = uniquePapers.slice(0, 5).map(p => ({
        title: p.title,
        journal: p.journal,
        impact_factor: p.impact_factor,
        publication_date: p.publication_date,
        verified_at: p.verified_at,
        doi: p.doi,
        product_cat_no: Array.isArray(p.detected_products) && p.detected_products.length > 0
          ? p.detected_products.join(', ')
          : p.product_cat_no,
        authors: p.authors,
        affiliation: p.affiliation,
      }))

      return {
        total_citations: total,
        total_if: Math.round(totalIF * 10) / 10,
        max_single_if: maxPaper?.impact_factor || 0,
        max_single_journal: maxPaper?.journal || '',
        recent_papers: recentPapers,
        monthly_growth: monthly,
      }
    })

    return NextResponse.json(cached.value, {
      headers: {
        ...SHORT_PUBLIC_CACHE_HEADERS,
        'X-Aimeng-Cache': cached.hit ? 'hit' : 'miss',
      },
    })
  } catch (err: unknown) {
    console.error('[citations/stats]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '文献统计读取失败' }, { status: 500 })
  }
}
