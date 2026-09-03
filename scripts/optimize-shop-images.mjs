import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const root = process.cwd()
const applyChanges = process.argv.includes('--apply')
const force = process.argv.includes('--force')

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
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function isAlreadyOptimized(url) {
  return url.includes('/shop/optimized/') && /\.webp(?:\?|$)/i.test(url)
}

async function optimizeItem(item) {
  const response = await fetch(item.image_url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}`)

  const source = Buffer.from(await response.arrayBuffer())
  const optimized = await sharp(source)
    .rotate()
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 85, effort: 5, smartSubsample: true })
    .toBuffer()

  if (!applyChanges) {
    return { sourceBytes: source.length, optimizedBytes: optimized.length, updated: false }
  }

  const digest = createHash('sha256').update(optimized).digest('hex').slice(0, 12)
  const path = `shop/optimized/${item.id}/${digest}.webp`
  const { error: uploadError } = await supabase.storage.from('product-assets').upload(path, optimized, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  })
  if (uploadError) throw new Error(`上传失败：${uploadError.message}`)

  const { data: publicUrlData } = supabase.storage.from('product-assets').getPublicUrl(path)
  const newUrl = publicUrlData.publicUrl
  const { error: updateError } = await supabase
    .from('shop_items')
    .update({ image_url: newUrl })
    .eq('id', item.id)
    .eq('image_url', item.image_url)

  if (updateError) {
    await supabase.storage.from('product-assets').remove([path])
    throw new Error(`数据库更新失败：${updateError.message}`)
  }

  return { sourceBytes: source.length, optimizedBytes: optimized.length, updated: true, newUrl }
}

const { data: items, error } = await supabase
  .from('shop_items')
  .select('id,name,image_url,status')
  .not('image_url', 'is', null)
  .order('sort_order', { ascending: true })

if (error) throw new Error(`读取商城商品失败：${error.message}`)

const candidates = (items || []).filter((item) => item.image_url && (force || !isAlreadyOptimized(item.image_url)))
let sourceTotal = 0
let optimizedTotal = 0
let successCount = 0
const failures = []
let nextIndex = 0

console.log(`${applyChanges ? '执行' : '预览'}商城图片优化：${candidates.length}/${items?.length || 0} 张待处理`)

async function worker() {
  while (nextIndex < candidates.length) {
    const index = nextIndex
    nextIndex += 1
    const item = candidates[index]

    try {
      const result = await optimizeItem(item)
      sourceTotal += result.sourceBytes
      optimizedTotal += result.optimizedBytes
      successCount += 1
      console.log(`[${index + 1}/${candidates.length}] ${item.name}: ${formatBytes(result.sourceBytes)} -> ${formatBytes(result.optimizedBytes)}`)
    } catch (itemError) {
      const message = itemError instanceof Error ? itemError.message : String(itemError)
      failures.push(`${item.name}: ${message}`)
      console.error(`[${index + 1}/${candidates.length}] ${item.name}: ${message}`)
    }
  }
}

await Promise.all(Array.from({ length: Math.min(5, candidates.length) }, () => worker()))

const savedBytes = Math.max(0, sourceTotal - optimizedTotal)
console.log(`\n完成：成功 ${successCount}，失败 ${failures.length}`)
console.log(`体积：${formatBytes(sourceTotal)} -> ${formatBytes(optimizedTotal)}，减少 ${formatBytes(savedBytes)}`)
if (!applyChanges) console.log('当前为预览模式；确认后使用 --apply 更新 Storage 和数据库链接。')
if (failures.length) {
  console.error('\n失败清单：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
}
