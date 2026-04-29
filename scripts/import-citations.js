// ============================================================
// 批量导入文献引用数据到 papers 表
// 用法: cd ~/aimeng-elisa-web && node scripts/import-citations.js
// 需要设置 SUPABASE_SERVICE_ROLE_KEY 环境变量
// ============================================================

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '你的_supabase_url'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('错误: 请设置 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ============================================================
// 在这里填入要导入的文献数据
// ============================================================
const CITATIONS = [
  // 示例格式:
  // {
  //   title: '论文标题',
  //   authors: '作者1, 作者2, 作者3',
  //   journal: 'Nature',
  //   doi: '10.1038/s41586-024-xxxxx-x',
  //   impact_factor: 64.8,
  //   publication_date: '2024-06-15',
  //   product_cat_no: 'ERK-001',  // 产品货号，必须对应 products.cat_no
  // },
]

async function importCitations() {
  if (CITATIONS.length === 0) {
    console.log('请先编辑 CITATIONS 数组，填入要导入的文献数据')
    process.exit(0)
  }

  console.log(`准备导入 ${CITATIONS.length} 篇文献...`)

  // 验证产品货号是否存在
  const catNos = [...new Set(CITATIONS.map(c => c.product_cat_no).filter(Boolean))]
  const { data: products } = await supabase
    .from('products')
    .select('cat_no')
    .in('cat_no', catNos)

  const validCatNos = new Set((products || []).map(p => p.cat_no))
  console.log(`数据库中找到 ${validCatNos.size} 个匹配的产品货号`)

  let inserted = 0
  let skipped = 0

  for (const citation of CITATIONS) {
    // 如果指定了货号但数据库中不存在，跳过
    if (citation.product_cat_no && !validCatNos.has(citation.product_cat_no)) {
      console.warn(`跳过: 货号 ${citation.product_cat_no} 不存在于 products 表`)
      skipped++
      continue
    }

    const { error } = await supabase.from('papers').insert({
      user_id: '00000000-0000-0000-0000-000000000000', // 系统导入
      title: citation.title,
      authors: citation.authors,
      journal: citation.journal,
      doi: citation.doi || null,
      impact_factor: citation.impact_factor || null,
      publication_date: citation.publication_date || null,
      product_cat_no: citation.product_cat_no || null,
      upload_status: 'verified',
      is_displayed: true,
      citation_type: 'bulk_imported',
      points_awarded: 0,
      verified_at: new Date().toISOString(),
    })

    if (error) {
      console.error(`导入失败: ${citation.title}`, error.message)
      skipped++
    } else {
      inserted++
      console.log(`✓ ${citation.title.substring(0, 50)}...`)
    }
  }

  console.log(`\n导入完成: ${inserted} 篇成功, ${skipped} 篇跳过/失败`)
  console.log('触发器会自动更新 products.citation_count')
}

importCitations().catch(console.error)
