import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type CoaDocument = {
  id: string
  catalog_number: string
  batch_number: string
  product_name?: string | null
  file_url: string
  file_name?: string | null
  created_at?: string | null
  source_table?: 'product_documents' | 'serum_coa_documents'
}

type ProductDocumentRow = {
  id: string
  product_id: string | null
  catalog_number: string | null
  batch_number: string | null
  file_url: string
  file_name: string | null
  created_at: string | null
}

type SerumCoaRow = {
  id: string
  catalog_number: string
  batch_number: string
  product_name: string | null
  file_url: string
  file_name: string | null
  created_at: string | null
}

function clean(value: string | null) {
  return (value || '').trim()
}

function isMissingTable(message: string | undefined, tableName: string) {
  return Boolean(
    message?.includes(tableName) &&
      (message.includes('schema cache') || message.includes('does not exist'))
  )
}

async function findProductDocumentCoa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogNumber: string,
  batchNumber: string
): Promise<{ document: CoaDocument | null; error?: string; missingTable?: boolean }> {
  const { data, error } = await supabase
    .from('product_documents')
    .select('id, product_id, catalog_number, batch_number, file_url, file_name, created_at')
    .eq('document_type', 'coa')
    .eq('status', 'active')
    .ilike('catalog_number', catalogNumber)
    .ilike('batch_number', batchNumber)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    if (isMissingTable(error.message, 'product_documents')) {
      return { document: null, missingTable: true }
    }
    return { document: null, error: error.message }
  }

  const row = (data?.[0] || null) as ProductDocumentRow | null
  if (!row) return { document: null }

  let productName: string | null = null
  if (row.product_id) {
    const { data: product } = await supabase
      .from('products')
      .select('name')
      .eq('id', row.product_id)
      .maybeSingle()
    productName = product?.name || null
  }

  return {
    document: {
      id: row.id,
      catalog_number: row.catalog_number || catalogNumber,
      batch_number: row.batch_number || batchNumber,
      product_name: productName,
      file_url: row.file_url,
      file_name: row.file_name,
      created_at: row.created_at,
      source_table: 'product_documents',
    },
  }
}

async function findLegacySerumCoa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogNumber: string,
  batchNumber: string
): Promise<{ document: CoaDocument | null; error?: string; missingTable?: boolean }> {
  const { data, error } = await supabase
    .from('serum_coa_documents')
    .select('id, catalog_number, batch_number, product_name, file_url, file_name, created_at')
    .eq('status', 'active')
    .ilike('catalog_number', catalogNumber)
    .ilike('batch_number', batchNumber)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error.message, 'serum_coa_documents')) {
      return { document: null, missingTable: true }
    }
    return { document: null, error: error.message }
  }

  const row = data as SerumCoaRow | null
  if (!row) return { document: null }

  return {
    document: {
      ...row,
      source_table: 'serum_coa_documents',
    },
  }
}

export async function GET(request: NextRequest) {
  const catalogNumber = clean(
    request.nextUrl.searchParams.get('catalog_number') ||
      request.nextUrl.searchParams.get('catalog')
  )
  const batchNumber = clean(
    request.nextUrl.searchParams.get('batch_number') ||
      request.nextUrl.searchParams.get('batch')
  )

  if (!catalogNumber || !batchNumber) {
    return NextResponse.json(
      { error: '请输入血清货号和批号' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const productDocumentResult = await findProductDocumentCoa(supabase, catalogNumber, batchNumber)
  if (productDocumentResult.error) {
    return NextResponse.json({ error: productDocumentResult.error }, { status: 500 })
  }
  if (productDocumentResult.document) {
    return NextResponse.json({ document: productDocumentResult.document })
  }

  const legacyResult = await findLegacySerumCoa(supabase, catalogNumber, batchNumber)
  if (legacyResult.error) {
    return NextResponse.json({ error: legacyResult.error }, { status: 500 })
  }
  if (legacyResult.document) {
    return NextResponse.json({ document: legacyResult.document })
  }

  if (productDocumentResult.missingTable && legacyResult.missingTable) {
    return NextResponse.json(
      {
        error: 'COA 数据表尚未初始化，请先执行产品文档和血清 COA 相关迁移。',
        needsSetup: true,
      },
      { status: 503 }
    )
  }

  return NextResponse.json({ document: null })
}
