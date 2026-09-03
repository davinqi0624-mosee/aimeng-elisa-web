import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { attachJournalIf, extractCitationFromFiles, getCitationExtractionErrorMessage } from '@/lib/citations/extract'

interface CitationExtractBody {
  files?: unknown
  file_url?: unknown
  file_type?: unknown
  file_name?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  try {
    const body = await request.json() as CitationExtractBody
    const files = Array.isArray(body.files)
      ? body.files.filter(isRecord).map((file) => ({
        fileUrl: typeof file.file_url === 'string' ? file.file_url.trim() : '',
        fileType: typeof file.file_type === 'string' ? file.file_type.trim() : '',
        fileName: typeof file.file_name === 'string' ? file.file_name : undefined,
      }))
      : [{
        fileUrl: typeof body.file_url === 'string' ? body.file_url.trim() : '',
        fileType: typeof body.file_type === 'string' ? body.file_type.trim() : '',
        fileName: typeof body.file_name === 'string' ? body.file_name : undefined,
      }]

    const result = await extractCitationFromFiles({ files })
    const withIf = await attachJournalIf(supabase, result)

    return NextResponse.json({ result: withIf })
  } catch (err: unknown) {
    console.error('[citations/extract]', err)
    return NextResponse.json({ error: getCitationExtractionErrorMessage(err) }, { status: 500 })
  }
}
