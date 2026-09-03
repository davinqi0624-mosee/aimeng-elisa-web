import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type BulkImportType = 'products' | 'agents'
type BulkImportStatus = 'completed' | 'rolled_back'

type BulkImportDetails = {
  success?: number
  failed?: number
  skippedImages?: number
  created_ids?: string[]
  rollback_at?: string
  rollback_by?: string
  rollback_result?: { deleted: number; failed: number }
  errors?: string[]
}

type BulkImportBatch = {
  id: string
  type: BulkImportType
  status: BulkImportStatus
  details: BulkImportDetails | null
}

type BulkImportCreateBody = {
  id?: string
  type?: BulkImportType
  product_count?: number
  image_count?: number
  status?: BulkImportStatus
  details?: BulkImportDetails
}

function isMissingBulkImportTable(message?: string) {
  return Boolean(
    message?.includes('bulk_import_batches') &&
      (message.includes('schema cache') || message.includes('does not exist'))
  )
}

function missingTableResponse() {
  return NextResponse.json(
    {
      error: '批量导入记录表尚未初始化，请先执行 supabase/migrations/023_bulk_import_batches.sql。',
      needsSetup: true,
    },
    { status: 503 }
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Server error'
}

export async function POST(req: NextRequest) {
  try {
    const { admin, error: authError } = await requireAdminOrSuper(req)
    if (authError) return authError
    const supabase = createAdminClient()

    const body = (await req.json().catch(() => ({}))) as BulkImportCreateBody
    const { id, type, product_count, image_count, status, details } = body

    if (!id || (type !== 'products' && type !== 'agents')) {
      return NextResponse.json({ error: '缺少批次 ID 或导入类型' }, { status: 400 })
    }

    const { error } = await supabase.from('bulk_import_batches').insert({
      id,
      type,
      product_count: product_count || 0,
      image_count: image_count || 0,
      status: status || 'completed',
      user_id: admin!.id,
      details: details || {},
    })

    if (error) {
      if (isMissingBulkImportTable(error.message)) return missingTableResponse()
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireAdminOrSuper(req)
    if (authError) return authError
    const supabase = createAdminClient()

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')

    let query = supabase
      .from('bulk_import_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      if (isMissingBulkImportTable(error.message)) return missingTableResponse()
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ batches: data || [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { admin, error: authError } = await requireAdminOrSuper(req)
    if (authError) return authError
    const supabase = createAdminClient()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: '缺少批次 ID' }, { status: 400 })
    }

    const { data: batch, error: fetchError } = await supabase
      .from('bulk_import_batches')
      .select('*')
      .eq('id', id)
      .single<BulkImportBatch>()

    if (fetchError || !batch) {
      if (isMissingBulkImportTable(fetchError?.message)) return missingTableResponse()
      return NextResponse.json({ error: '批次不存在' }, { status: 404 })
    }

    if (batch.status === 'rolled_back') {
      return NextResponse.json({ error: '该批次已回滚' }, { status: 400 })
    }

    const details = batch.details || {}
    const createdIds: string[] = details.created_ids || []

    // Rollback: delete created records one by one using the authenticated client
    let deleted = 0
    let failed = 0
    const table = batch.type === 'products' ? 'products' : 'agents'
    for (const recordId of createdIds) {
      try {
        const { error: delError } = await supabase.from(table).delete().eq('id', recordId)
        if (delError) failed++
        else deleted++
      } catch {
        failed++
      }
    }

    // Update batch status
    const { error: updateError } = await supabase
      .from('bulk_import_batches')
      .update({
        status: 'rolled_back',
        details: {
          ...details,
          rollback_at: new Date().toISOString(),
          rollback_by: admin!.id,
          rollback_result: { deleted, failed },
        },
      })
      .eq('id', id)

    if (updateError) {
      if (isMissingBulkImportTable(updateError.message)) return missingTableResponse()
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted, failed })
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 })
  }
}
