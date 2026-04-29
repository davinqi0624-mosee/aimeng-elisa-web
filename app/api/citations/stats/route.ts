import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: papers } = await supabase
      .from('papers')
      .select('impact_factor, journal, publication_date, title, doi, product_cat_no, authors')
      .eq('upload_status', 'verified')
      .eq('is_displayed', true)
      .order('publication_date', { ascending: false })

    const total = papers?.length || 0
    const totalIF = papers?.reduce((sum, p) => sum + (p.impact_factor || 0), 0) || 0
    const maxPaper = papers?.reduce((max, p) => ((p.impact_factor || 0) > (max?.impact_factor || 0) ? p : max), papers?.[0])

    // Monthly growth (current month)
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthly = papers?.filter(p => p.publication_date && p.publication_date >= monthStart).length || 0

    // Recent 5 papers
    const recentPapers = (papers || []).slice(0, 5).map(p => ({
      title: p.title,
      journal: p.journal,
      impact_factor: p.impact_factor,
      publication_date: p.publication_date,
      doi: p.doi,
      product_cat_no: p.product_cat_no,
      authors: p.authors,
    }))

    return NextResponse.json({
      total_citations: total,
      total_if: Math.round(totalIF * 10) / 10,
      max_single_if: maxPaper?.impact_factor || 0,
      max_single_journal: maxPaper?.journal || '',
      recent_papers: recentPapers,
      monthly_growth: monthly,
    })
  } catch (err: any) {
    console.error('[citations/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
