const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '..', 'data', '爱萌产品目录（已更新4.26）.xlsx');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('请设置环境变量: NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function extractTargetFromName(name, species) {
  let t = name.replace(new RegExp(`^${species}\\s*`, 'i'), '').trim();
  t = t.replace(/ELISA\s*Kit.*$/i, '').trim();
  t = t.replace(/[（(].*?[）)]/g, '').trim();
  t = t.replace(/\s+/g, ' ').trim();
  return t || name;
}

function generateSlug(target, species, catalogNo) {
  const base = `${target}-${species}-${catalogNo}`
    .toLowerCase()
    .replace(/[^a-z0-9α-ωΑ-Ω-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base.substring(0, 100);
}

function parseSpeciesFromSheetName(sheetName) {
  const s = sheetName.trim();
  if (s.startsWith('Human')) return 'Human';
  if (s.startsWith('Mouse')) return 'Mouse';
  if (s.startsWith('Rat')) return 'Rat';
  if (s.startsWith('Monkey')) return 'Monkey';
  if (s.startsWith('Canine') || s.startsWith('Dog')) return 'Canine';
  if (s.startsWith('Porcine') || s.startsWith('Pig')) return 'Porcine';
  if (s.startsWith('Bovine') || s.startsWith('Cow')) return 'Bovine';
  if (s.startsWith('Chicken')) return 'Chicken';
  if (s.toLowerCase().includes('guinea pig')) return 'Guinea pig';
  if (s.startsWith('Sheep')) return 'Sheep';
  if (s.toLowerCase().includes('zebrafish')) return 'Zebrafish';
  if (s.startsWith('rabbit') || s.startsWith('Rabbit')) return 'Rabbit';
  if (s.startsWith('Capra')) return 'Capra hircus';
  if (s.includes('生化一步法')) return '生化一步法';
  return 'Human';
}

// 配置价格规则：48T = 1800, 96T = 2400
function getPrices() {
  return { '48T': 1800, '96T': 2400 };
}

async function main() {
  console.log('📖 读取 Excel...');
  const wb = xlsx.readFile(EXCEL_PATH);

  // 收集 Excel 数据：catalog -> {name, target, species, size, detectionRange, sensitivity, sampleType}
  const excelMap = new Map();

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'Sheet3') continue;
    const species = parseSpeciesFromSheetName(sheetName);
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    if (rows.length < 2) continue;

    const headers = rows[0];
    const catIdx = headers.findIndex(h => String(h).includes('货号'));
    const nameIdx = headers.findIndex(h => String(h).includes('产品名称'));
    const sizeIdx = headers.findIndex(h => String(h).includes('规格'));
    const sensIdx = headers.findIndex(h => String(h).includes('灵敏度'));
    const rangeIdx = headers.findIndex(h => String(h).includes('检测范围'));
    const sampleIdx = headers.findIndex(h => String(h).includes('标本类型'));

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const catalogNo = String(r[catIdx] || '').trim();
      const rawName = String(r[nameIdx] || '').trim();
      const size = String(r[sizeIdx] || '96T').trim();
      const sensitivity = String(r[sensIdx] || '').trim();
      const detectionRange = String(r[rangeIdx] || '').trim();
      const sampleText = String(r[sampleIdx] || '').trim();

      if (!catalogNo || !rawName) continue;

      const target = extractTargetFromName(rawName, species);
      const slug = generateSlug(target, species, catalogNo);

      excelMap.set(slug, {
        name: rawName,
        slug,
        target,
        species,
        catalogNo,
        size,
        sensitivity,
        detectionRange,
        sampleText,
      });
    }
  }

  console.log(`✅ Excel 解析完成：${excelMap.size} 条记录`);

  // 查询现有产品
  console.log('🔍 查询数据库现有产品...');
  const { data: allProducts, error } = await supabase
    .from('products')
    .select('id, name, slug, price, target, species, detection_range, sensitivity, sample_type');

  if (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }

  console.log(`   数据库现有 ${allProducts.length} 条产品`);

  // 按名称分组（同名 = 同一产品的不同规格）
  const nameGroups = new Map();
  for (const p of allProducts) {
    const list = nameGroups.get(p.name) || [];
    list.push(p);
    nameGroups.set(p.name, list);
  }

  let updated = 0;
  let deleted = 0;
  let single = 0;

  for (const [name, group] of nameGroups) {
    if (group.length === 2) {
      // 双规格产品：确定哪个是 48T，哪个是 96T
      const p1 = group[0];
      const p2 = group[1];

      const e1 = excelMap.get(p1.slug);
      const e2 = excelMap.get(p2.slug);

      let product48, product96, excel48, excel96;

      if (e1 && e1.size === '48T') {
        product48 = p1; product96 = p2; excel48 = e1; excel96 = e2 || e1;
      } else if (e2 && e2.size === '48T') {
        product48 = p2; product96 = p1; excel48 = e2; excel96 = e1 || e2;
      } else {
        // 无法从 Excel 确认，用 slug 尾字母推断
        if (p1.slug.endsWith('s')) {
          product48 = p1; product96 = p2;
        } else {
          product48 = p2; product96 = p1;
        }
        excel48 = e1 || e2;
        excel96 = e1 || e2;
      }

      const prices = getPrices();
      const catalogNo = excel96?.catalogNo || product96.slug.split('-').pop()?.toUpperCase();

      // 更新 96T 产品为主产品
      const { error: updErr } = await supabase
        .from('products')
        .update({
          prices,
          catalog_number: catalogNo,
          price: prices['96T'],
        })
        .eq('id', product96.id);

      if (updErr) {
        console.error(`更新失败 ${name}:`, updErr.message);
        continue;
      }

      // 删除 48T 重复产品
      const { error: delErr } = await supabase
        .from('products')
        .delete()
        .eq('id', product48.id);

      if (delErr) {
        console.error(`删除失败 ${name}:`, delErr.message);
      } else {
        updated++;
        deleted++;
      }
    } else if (group.length === 1) {
      // 单规格产品
      const p = group[0];
      const excel = excelMap.get(p.slug);
      const prices = getPrices();
      const catalogNo = excel?.catalogNo || p.slug.split('-').pop()?.toUpperCase();

      const { error: updErr } = await supabase
        .from('products')
        .update({ prices, catalog_number: catalogNo, price: prices['96T'] })
        .eq('id', p.id);

      if (!updErr) single++;
    } else {
      // 3+ 个同名产品，不处理，打印警告
      console.warn(`警告："${name}" 有 ${group.length} 个产品，跳过`);
    }
  }

  console.log('\n✅ 迁移完成');
  console.log(`   合并双规格：${updated} 个（删除 ${deleted} 个重复）`);
  console.log(`   单规格更新：${single} 个`);
  console.log(`   预计最终产品数：${updated + single}`);
}

main().catch(err => {
  console.error('❌ 迁移失败：', err.message);
  process.exit(1);
});
