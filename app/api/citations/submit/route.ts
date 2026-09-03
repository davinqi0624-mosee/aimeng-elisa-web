import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { attachJournalIf } from '@/lib/citations/extract'
import {
  cleanText,
  extractBrandKeywords,
  extractCatalogNumbers,
  normalizeCatalogNumbers,
  normalizeDoi,
} from '@/lib/citations/rules'

interface CitationStoredFile {
  file_url: string
  file_name: string
  file_type: string
  file_hash: string
  file_path: string
  file_size: number
}

interface CitationSubmitBody {
  files?: unknown
  extraction_result?: unknown
  product_cat_no?: unknown
  title?: unknown
  doi?: unknown
  journal?: unknown
  publication_year?: unknown
  authors?: unknown
  affiliation?: unknown
  abstract?: unknown
  file_url?: unknown
  file_name?: unknown
  file_type?: unknown
  file_hash?: unknown
  file_path?: unknown
  file_size?: unknown
  evidence_text?: unknown
}

interface PaperHashSource {
  id?: string
  file_hash?: unknown
  extraction_result?: {
    files?: Array<{ file_hash?: unknown }>
  } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeCitationFiles(body: CitationSubmitBody): CitationStoredFile[] {
  if (!Array.isArray(body.files)) return []
  return body.files
    .filter(isRecord)
    .map((file) => ({
      file_url: cleanText(file.file_url),
      file_name: cleanText(file.file_name),
      file_type: cleanText(file.file_type),
      file_hash: cleanText(file.file_hash),
      file_path: cleanText(file.file_path),
      file_size: Number(file.file_size || 0) || 0,
    }))
    .filter((file: CitationStoredFile) => file.file_url)
}

function getStoredFileHashes(paper: PaperHashSource) {
  const files = Array.isArray(paper?.extraction_result?.files) ? paper.extraction_result.files : []
  return Array.from(new Set([
    cleanText(paper?.file_hash),
    ...files.map((file) => cleanText(file?.file_hash)),
  ].filter(Boolean)))
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  try {
    const body = await request.json() as CitationSubmitBody
    const rawExtractionResult = isRecord(body.extraction_result) ? body.extraction_result : {}
    const product_cat_no = cleanText(body.product_cat_no)
    const title = cleanText(body.title)
    const doi = cleanText(body.doi)
    const journal = cleanText(body.journal)
    const publication_year = cleanText(body.publication_year)
    const authors = cleanText(body.authors)
    const affiliation = cleanText(body.affiliation) || cleanText(rawExtractionResult.affiliation)
    const abstract = cleanText(body.abstract)
    const file_url = cleanText(body.file_url)
    const file_name = cleanText(body.file_name)
    const file_type = cleanText(body.file_type)
    const file_hash = cleanText(body.file_hash)
    const file_path = cleanText(body.file_path)
    const file_size = Number(body.file_size || 0) || null
    const evidence_text = cleanText(body.evidence_text)
    const submittedFiles = normalizeCitationFiles(body)
    const extractionResult: Record<string, unknown> = Object.keys(rawExtractionResult).length > 0
      ? {
        ...rawExtractionResult,
        files: submittedFiles.length > 0 ? submittedFiles : rawExtractionResult.files,
      }
      : (submittedFiles.length > 0 ? { files: submittedFiles } : {})
    const extractionStatus = cleanText(extractionResult.extraction_status)
    const normalizedDoi = normalizeDoi(doi)

    if (!file_url && !product_cat_no) {
      return NextResponse.json({ error: '请至少上传文献 PDF/截图，或填写产品货号。' }, { status: 400 })
    }

    const submittedHashes = Array.from(new Set([
      file_hash,
      ...submittedFiles.map((file) => file.file_hash),
    ].filter(Boolean)))

    if (submittedHashes.length > 0) {
      const { data: existingPapers } = await supabase
        .from('papers')
        .select('id, title, upload_status, created_at, file_hash, extraction_result')
        .eq('user_id', user.id)
        .neq('upload_status', 'rejected')
        .order('created_at', { ascending: false })

      const duplicateFile = ((existingPapers || []) as PaperHashSource[]).find((paper) => (
        getStoredFileHashes(paper).some((hash) => submittedHashes.includes(hash))
      ))
      if (duplicateFile) {
        return NextResponse.json({
          error: '这份文件已经提交过，请不要重复提交。您可以在“我的文献投稿”中查看审核状态。',
          duplicateOf: duplicateFile.id,
        }, { status: 409 })
      }
    }

    if (normalizedDoi) {
      const { data: duplicateDoi } = await supabase
        .from('papers')
        .select('id, title, upload_status, created_at')
        .eq('user_id', user.id)
        .ilike('doi', normalizedDoi)
        .neq('upload_status', 'rejected')
        .maybeSingle()

      if (duplicateDoi) {
        return NextResponse.json({
          error: '这个 DOI 已经提交过，请不要重复提交。您可以在“我的文献投稿”中查看审核状态。',
          duplicateOf: duplicateDoi.id,
        }, { status: 409 })
      }
    }

    const combinedEvidence = `${title} ${journal} ${authors} ${affiliation} ${abstract} ${evidence_text} ${JSON.stringify(extractionResult)}`
    const detectedProducts = Array.from(new Set([
      ...normalizeCatalogNumbers(product_cat_no),
      ...extractCatalogNumbers(combinedEvidence),
    ]))
    const detectedBrands = extractBrandKeywords(combinedEvidence)
    const ifMatch = await attachJournalIf(supabase, { journal })
    const matchedIf = ifMatch.matched_if == null ? null : ifMatch.matched_if

    // Insert paper
    const { data: paper, error: paperErr } = await supabase
      .from('papers')
      .insert({
        user_id: user.id,
        product_cat_no,
        title: title || '待管理员审核：客户上传文献',
        doi: doi || null,
        journal: journal || '待管理员审核',
        publication_date: publication_year ? `${publication_year}-01-01` : null,
        authors: authors || '待管理员审核',
        affiliation: affiliation || null,
        abstract: abstract || null,
        file_url: file_url || null,
        file_name: file_name || null,
        file_type: file_type || null,
        file_hash: file_hash || null,
        file_path: file_path || null,
        file_size,
        detected_products: detectedProducts,
        detected_brands: detectedBrands,
        evidence_text: evidence_text || null,
        extraction_result: extractionResult,
        extraction_status: extractionStatus || (file_url ? 'manual_required' : 'pending'),
        impact_factor: matchedIf,
        if_source: matchedIf == null ? null : `期刊 IF 数据表${ifMatch.matched_if_year ? ` ${ifMatch.matched_if_year}` : ''}`,
        upload_status: 'pending',
        status: 'pending',
        citation_type: 'user_submitted',
        source_type: file_url ? 'customer_upload' : 'manual_form',
        discovery_status: 'manual',
        points_awarded: 0,
      })
      .select('id')
      .single()

    if (paperErr) throw paperErr

    return NextResponse.json({
      id: paper.id,
      message: '文献提交成功，等待管理员审核。审核通过后将按期刊 IF 发放积分。',
      pointsAwarded: 0,
      matchedImpactFactor: matchedIf,
    })
  } catch (err: unknown) {
    console.error('[citations/submit]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message || '提交失败' : '提交失败' }, { status: 500 })
  }
}
