import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FALLBACK_SERVICE = {
  service_name: '爱萌优宁官方客服',
  phone: '400-888-0123',
  email: 'service@animaluni.com',
  wechat_id: '',
  wechat_qr_url: '',
  work_hours: '周一至周五 9:00 - 18:00',
  address: '上海市浦东新区张江高科技园区科苑路88号',
  note: '添加客服时请备注产品货号或产品名称，方便快速确认库存、报价、货期和资料。',
}

function isMissingSettingsSchema(message?: string) {
  return Boolean(
    message?.includes('customer_service_settings') &&
      (message.includes('schema cache') || message.includes('does not exist') || message.includes('address'))
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customer_service_settings')
    .select('service_name, phone, email, wechat_id, wechat_qr_url, work_hours, address, note')
    .eq('id', 1)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    if (isMissingSettingsSchema(error.message)) {
      return NextResponse.json({ service: FALLBACK_SERVICE, needsSetup: true })
    }
    return NextResponse.json({ error: error.message, service: FALLBACK_SERVICE }, { status: 500 })
  }

  return NextResponse.json({ service: data || FALLBACK_SERVICE })
}
