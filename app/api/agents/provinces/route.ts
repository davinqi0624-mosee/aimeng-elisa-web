import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: 公开接口，返回有代理商的省份列表
export async function GET() {
  const supabase = await createClient()

  const { data, error: dbError } = await supabase
    .from('agents')
    .select('province, province_code')
    .eq('is_active', true)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // 去重并统计每个省份的代理商数量
  const provinceMap = new Map<string, { province: string; province_code: string | null; count: number }>()

  for (const row of data || []) {
    const key = row.province
    if (provinceMap.has(key)) {
      const existing = provinceMap.get(key)!
      provinceMap.set(key, { ...existing, count: existing.count + 1 })
    } else {
      provinceMap.set(key, {
        province: row.province,
        province_code: row.province_code,
        count: 1,
      })
    }
  }

  return NextResponse.json({ provinces: Array.from(provinceMap.values()) })
}
