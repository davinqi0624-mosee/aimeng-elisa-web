import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrSuper } from '@/lib/admin/auth'

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { papers } = body

    if (!Array.isArray(papers) || papers.length === 0) {
      return NextResponse.json({ error: '缺少 papers 数组' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const rows = papers.map((p: any) => ({
      title: p.title,
      authors: p.authors || '',
      journal: p.journal || '',
      doi: p.doi || null,
      product_cat_no: p.product_cat_no || null,
      publication_date: p.publication_date || (p.publication_year ? `${p.publication_year}-01-01` : null),
      impact_factor: p.impact_factor || null,
      url: p.url || (p.doi ? `https://doi.org/${p.doi}` : null),
      abstract: p.abstract || null,
      upload_status: 'verified',
      is_displayed: true,
      citation_type: p.citation_type || 'official_import',
      points_awarded: 0,
      verified_at: new Date().toISOString(),
      verified_by: null,
      verified_admin_id: null,
    }))

    const { data, error } = await supabase.from('papers').insert(rows).select('id')

    if (error) throw error

    return NextResponse.json({
      imported: data?.length || 0,
      message: `成功导入 ${data?.length || 0} 篇文献`,
    })
  } catch (err: any) {
    console.error('[citations/bulk-import]', err)
    return NextResponse.json({ error: err.message || '导入失败' }, { status: 500 })
  }
}
