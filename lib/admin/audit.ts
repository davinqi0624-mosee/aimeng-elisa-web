import { createClient } from '@/lib/supabase/server'

interface AuditPayload {
  admin_id: string
  action: string
  target_table?: string
  target_id?: string
  old_value?: any
  new_value?: any
  reason?: string
  ip_address?: string
  user_agent?: string
}

export async function logAudit(payload: AuditPayload) {
  const supabase = await createClient()
  try {
    await supabase.from('admin_audit_logs').insert({
      admin_id: payload.admin_id,
      action: payload.action,
      target_table: payload.target_table || null,
      target_id: payload.target_id || null,
      old_value: payload.old_value || null,
      new_value: payload.new_value || null,
      reason: payload.reason || null,
      ip_address: payload.ip_address || null,
      user_agent: payload.user_agent || null,
    })
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}

// 检查价格变动是否超过阈值（20%）
export function isPriceChangeSignificant(
  oldPrice: number | null,
  newPrice: number | null
): boolean {
  if (!oldPrice || !newPrice || oldPrice === 0) return false
  const change = Math.abs(newPrice - oldPrice) / oldPrice
  return change > 0.2
}

// 检查 level2 当日积分发放是否超限
export async function checkDailyPointsQuota(
  adminId: string,
  pointsToAward: number,
  maxDaily: number = 2000
): Promise<{ allowed: boolean; remaining: number; message?: string }> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('admin_daily_points_quota')
    .select('points_awarded')
    .eq('admin_id', adminId)
    .eq('award_date', today)
    .single()

  const awarded = data?.points_awarded || 0
  const remaining = maxDaily - awarded

  if (pointsToAward > remaining) {
    return {
      allowed: false,
      remaining,
      message: `今日积分发放额度不足，剩余 ${remaining} 分，本次需发放 ${pointsToAward} 分`,
    }
  }

  return { allowed: true, remaining: remaining - pointsToAward }
}

// 增加 level2 当日积分发放记录
export async function incrementDailyPointsQuota(adminId: string, points: number) {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: existing } = await supabase
    .from('admin_daily_points_quota')
    .select('id, points_awarded')
    .eq('admin_id', adminId)
    .eq('award_date', today)
    .single()

  if (existing) {
    await supabase
      .from('admin_daily_points_quota')
      .update({ points_awarded: existing.points_awarded + points })
      .eq('id', existing.id)
  } else {
    await supabase.from('admin_daily_points_quota').insert({
      admin_id: adminId,
      points_awarded: points,
      award_date: today,
    })
  }
}

// 检查导出频率限制（1小时内最多3次）
export async function checkExportLimit(
  adminId: string,
  windowHours: number = 1,
  maxExports: number = 3
): Promise<{ allowed: boolean; count: number; message?: string }> {
  const supabase = await createClient()
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('admin_export_logs')
    .select('id', { count: 'exact' })
    .eq('admin_id', adminId)
    .gte('created_at', since)

  const count = data?.length || 0
  if (count >= maxExports) {
    return {
      allowed: false,
      count,
      message: `导出过于频繁，${windowHours} 小时内最多导出 ${maxExports} 次，已使用 ${count} 次`,
    }
  }

  return { allowed: true, count }
}

// 记录导出日志
export async function logExport(adminId: string, exportType: string, recordCount: number) {
  const supabase = await createClient()
  await supabase.from('admin_export_logs').insert({
    admin_id: adminId,
    export_type: exportType,
    record_count: recordCount,
  })
}

// 数据脱敏
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [name, domain] = email.split('@')
  if (name.length <= 2) return '*@' + domain
  return name.slice(0, 2) + '***@' + domain
}
