import { createClient } from '@supabase/supabase-js'

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!serviceRoleKey) {
    throw new Error(
      '服务器缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量。本地测试请把 Supabase Project Settings → API → Secret keys → default 填入 .env.local；线上部署时也要添加同名变量。'
    )
  }

  if (serviceRoleKey === anonKey || serviceRoleKey.startsWith('sb_publishable_')) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY 现在填入的不是 service_role/secret key。请使用 Supabase Project Settings → API → Secret keys → default，不要使用 publishable 或 anon key。'
    )
  }

  return serviceRoleKey
}

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('服务器缺少 NEXT_PUBLIC_SUPABASE_URL 环境变量。')
  }

  return createClient(supabaseUrl, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
