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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const categoryLabels = {
  digital: '数码通信',
  computer: '电脑配件',
  office: '文具办公',
  sports_outdoor: '运动户外',
  daily_life: '生活用品',
  food_drink: '食品饮料',
  beauty: '个护美妆',
  home_appliance: '家居家电',
  travel: '旅行用品',
  disposable: '一次性用品',
  research: '实验科研',
  gift_card: '礼品卡券',
  clothing: '服饰配件',
  other: '其他',
}

function classifyItem(item) {
  const text = `${item.name || ''} ${item.description || ''}`.toLowerCase()

  if (/elisa|试剂盒|胎牛血清|生化检测|抗体|实验耗材|科研/.test(text)) return 'research'
  if (/星巴克.*(礼卡|星礼卡)|瑞幸.*(礼卡|储值卡|卡实体)|礼品卡|储值卡/.test(text)) return 'gift_card'
  if (/旅行箱|拉杆箱|旅行包/.test(text)) return 'travel'
  if (/咖啡机|家电|电器/.test(text)) return 'home_appliance'
  if (/iphone|airpods|apple watch|充电宝|手机|相机|大疆|dji|拍立得|稳定器|耳机|casio|电子表/.test(text)) return 'digital'
  if (/羽毛球|篮球|橄榄球|网球拍|乒乓球|滑雪|骑行|护臂|运动|户外|登山|徒步|越野|跑步|睡袋|帐篷|露营|皮划艇|防晒伞|遮阳伞|头灯|腰包|背包|手套|帽子|护腕|发带/.test(text)) {
    return 'sports_outdoor'
  }
  if (/macbook|mac mini|ipad|电脑|键盘|鼠标|显示器|硬盘|usb/.test(text)) return 'computer'
  if (/咖啡杯|咖啡外带杯|保温杯|水杯|擦汗巾|生活用品/.test(text)) return 'daily_life'
  if (/文具|办公|相纸/.test(text)) return 'office'
  if (/食品|饮料|咖啡豆|零食/.test(text)) return 'food_drink'
  if (/化妆|护肤|洗护|美妆/.test(text)) return 'beauty'
  if (/一次性/.test(text)) return 'disposable'
  if (/服饰|衣|裤|鞋|袜/.test(text)) return 'clothing'
  return 'other'
}

let { data: items, error } = await supabase
  .from('shop_items')
  .select('id,name,description,category')
  .order('sort_order', { ascending: true })
if (error?.message?.includes('column shop_items.category does not exist')) {
  const fallback = await supabase
    .from('shop_items')
    .select('id,name,description')
    .order('sort_order', { ascending: true })
  if (fallback.error) throw new Error(`读取商城商品失败：${fallback.error.message}`)
  items = (fallback.data || []).map((item) => ({ ...item, category: null }))
  error = null
  console.warn('提示：shop_items.category 尚未创建，当前仅能预览分类；请先执行 066_shop_item_categories.sql。')
}
if (error) throw new Error(`读取商城商品失败：${error.message}`)

const groups = new Map(Object.keys(categoryLabels).map((category) => [category, []]))
for (const item of items || []) {
  const category = classifyItem(item)
  groups.get(category).push({ ...item, suggestedCategory: category })
}

console.log(`${applyChanges ? '执行' : '预览'}商城商品分类：${items?.length || 0} 个商品`)
for (const [category, group] of groups) {
  if (!group.length) continue
  console.log(`\n${categoryLabels[category]} (${category}) - ${group.length} 个`)
  for (const item of group) {
    const changed = item.category !== item.suggestedCategory ? '更新' : '保持'
    console.log(`- [${changed}] ${item.name}`)
  }
}

if (!applyChanges) {
  console.log('\n预览完成。确认分类结果后执行：node scripts/classify-shop-items.mjs --apply')
  process.exit(0)
}

let updated = 0
for (const item of items || []) {
  const category = classifyItem(item)
  if (item.category === category) continue
  let updateQuery = supabase
    .from('shop_items')
    .update({ category })
    .eq('id', item.id)
  updateQuery = item.category === null
    ? updateQuery.is('category', null)
    : updateQuery.eq('category', item.category)
  const { error: updateError } = await updateQuery
  if (updateError) throw new Error(`${item.name} 更新失败：${updateError.message}`)
  updated += 1
}

console.log(`\n分类写入完成：${updated} 个商品已更新`)
