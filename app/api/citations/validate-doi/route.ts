import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const doi = searchParams.get('doi')

  if (!doi) {
    return NextResponse.json({ error: '缺少 DOI 参数' }, { status: 400 })
  }

  try {
    const cleanDoi = doi.trim().replace(/^https?:\/\/doi\.org\//, '')
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
      headers: { 'User-Agent': 'aimeng-elisa-web/1.0 (mailto:admin@aimeng.com)' },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'DOI 未找到或 CrossRef 服务不可用' }, { status: 404 })
    }

    const json = await res.json()
    const work = json.message

    const authors = work.author
      ? work.author.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).join(', ')
      : ''

    const journal = work['container-title']?.[0] || work.publisher || ''
    const pubDate = work['published-print']?.['date-parts']?.[0] ||
                    work['published-online']?.['date-parts']?.[0] ||
                    work['created']?.['date-parts']?.[0]
    const year = pubDate?.[0]

    return NextResponse.json({
      title: work.title?.[0] || '',
      authors,
      journal,
      publication_year: year,
      doi: cleanDoi,
      url: work.URL || `https://doi.org/${cleanDoi}`,
      abstract: work.abstract || '',
    })
  } catch (err: any) {
    console.error('[validate-doi]', err)
    return NextResponse.json({ error: err.message || '验证失败' }, { status: 500 })
  }
}
