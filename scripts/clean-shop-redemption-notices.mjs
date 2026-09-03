import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const applyChanges = process.argv.includes('--apply')

function loadEnvFile(fileName) {
  const filePath = join(root, fileName)
  if (!existsSync(filePath)) return

  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const notices = [
  '积分兑换时请留好快递信息，如有变动方便客服人员联系，正常发货时间为兑换后7个工作日，以沟通结果为准，积分兑换商品，兑换后不可退换货，敬请谅解！',
  '积分兑换时请留好联系方式，正常发货时间为积分兑换后7个工作日发货，如有特殊情况请跟客服人员联系，具体事宜以沟通为准',
]

function clean(value) {
  let result = String(value || '').replace(/\r\n/g, '\n')
  for (const notice of notices) result = result.split(notice).join('')
  return result
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const { data: items, error } = await supabase
  .from('shop_items')
  .select('id,name,description')
  .order('created_at', { ascending: true })
if (error) throw new Error(`读取商城商品失败：${error.message}`)

const candidates = (items || []).filter((item) => notices.some((notice) => String(item.description || '').includes(notice)))
console.log(`${applyChanges ? '执行' : '预览'}清理：${candidates.length}/${items?.length || 0} 个商品包含固定兑换提示`)

let updated = 0
for (const item of candidates) {
  const description = clean(item.description)
  if (!applyChanges) {
    console.log(`- ${item.name}`)
    continue
  }

  const { error: updateError } = await supabase
    .from('shop_items')
    .update({ description })
    .eq('id', item.id)
    .eq('description', item.description)
  if (updateError) throw new Error(`${item.name} 更新失败：${updateError.message}`)
  updated += 1
}

console.log(`${applyChanges ? '清理完成' : '预览完成'}：${applyChanges ? updated : candidates.length} 个商品`)
if (!applyChanges) console.log('确认后执行：node scripts/clean-shop-redemption-notices.mjs --apply')
