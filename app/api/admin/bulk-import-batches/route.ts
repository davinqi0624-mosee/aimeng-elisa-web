import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await req.json()
    const { id, type, product_count, image_count, status, details } = body

    const { error } = await supabase.from('bulk_import_batches').insert({
      id,
      type,
      product_count: product_count || 0,
      image_count: image_count || 0,
      status: status || 'completed',
      user_id: user.id,
      details: details || {},
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ batches: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: '缺少批次 ID' }, { status: 400 })
    }

    const { data: batch, error: fetchError } = await supabase
      .from('bulk_import_batches')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !batch) {
      return NextResponse.json({ error: '批次不存在' }, { status: 404 })
    }

    if (batch.status === 'rolled_back') {
      return NextResponse.json({ error: '该批次已回滚' }, { status: 400 })
    }

    const createdIds: string[] = batch.details?.created_ids || []

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
          ...batch.details,
          rollback_at: new Date().toISOString(),
          rollback_by: user.id,
          rollback_result: { deleted, failed },
        },
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted, failed })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
