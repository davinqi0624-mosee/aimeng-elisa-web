import { NextRequest, NextResponse } from 'next/server'
import { requireSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type CustomerServiceSettings = {
  service_name?: string
  phone?: string
  email?: string
  wechat_id?: string
  wechat_qr_url?: string
  work_hours?: string
  address?: string
  note?: string
  is_active?: boolean
}

const DEFAULT_SETTINGS = {
  id: 1,
  service_name: '爱萌优宁官方客服',
  phone: '400-888-0123',
  email: 'service@animaluni.com',
  wechat_id: '',
  wechat_qr_url: '',
  work_hours: '周一至周五 9:00 - 18:00',
  address: '上海市浦东新区张江高科技园区科苑路88号',
  note: '添加客服时请备注产品货号或产品名称，方便快速确认库存、报价、货期和资料。',
  is_active: true,
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isMissingSettingsSchema(message?: string) {
  return Boolean(
    message?.includes('customer_service_settings') &&
      (message.includes('schema cache') || message.includes('does not exist') || message.includes('address'))
  )
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('customer_service_settings')
    .select('id, service_name, phone, email, wechat_id, wechat_qr_url, work_hours, address, note, is_active, updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    if (isMissingSettingsSchema(error.message)) {
      return NextResponse.json({
        settings: DEFAULT_SETTINGS,
        needsSetup: true,
        error: '官方客服地址字段尚未初始化，请先执行 supabase/migrations/060_customer_service_address.sql。',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data || DEFAULT_SETTINGS })
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const body = (await request.json().catch(() => ({}))) as CustomerServiceSettings
  const supabase = createAdminClient()
  const payload = {
    id: 1,
    service_name: clean(body.service_name) || DEFAULT_SETTINGS.service_name,
    phone: clean(body.phone),
    email: clean(body.email),
    wechat_id: clean(body.wechat_id),
    wechat_qr_url: clean(body.wechat_qr_url),
    work_hours: clean(body.work_hours) || DEFAULT_SETTINGS.work_hours,
    address: clean(body.address) || DEFAULT_SETTINGS.address,
    note: clean(body.note) || DEFAULT_SETTINGS.note,
    is_active: body.is_active !== false,
  }

  const { data, error } = await supabase
    .from('customer_service_settings')
    .upsert(payload, { onConflict: 'id' })
    .select('id, service_name, phone, email, wechat_id, wechat_qr_url, work_hours, address, note, is_active, updated_at')
    .single()

  if (error) {
    if (isMissingSettingsSchema(error.message)) {
      return NextResponse.json(
        { error: '官方客服地址字段尚未初始化，请先执行 supabase/migrations/060_customer_service_address.sql。' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data, message: '官方客服配置已保存' })
}
