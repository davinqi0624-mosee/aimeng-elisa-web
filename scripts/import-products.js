const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '..', 'data', '爱萌产品目录（已更新4.26）.xlsx');
const SQL_OUTPUT = path.join(__dirname, 'import-products.sql');

const SPECIES_MAP = {
  'Human': '人',
  'Mouse': '小鼠',
  'Rat': '大鼠',
  'Rabbit': '兔',
  'Monkey': '猴',
  'Canine': '犬',
  'Dog': '犬',
  'Porcine': '猪',
  'Pig': '猪',
  'Bovine': '牛',
  'Cow': '牛',
  'Chicken': '鸡',
  'Guinea pig': '豚鼠',
  'Guinea Pig': '豚鼠',
  'guinea pig': '豚鼠',
  'Sheep': '绵羊',
  'Zebrafish': '斑马鱼',
  'zebrafish': '斑马鱼',
  'Capra hircus': '山羊',
  '生化一步法': '生化一步法',
};

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

function extractTargetFromName(name, species) {
  // Remove species prefix and suffix like "ELISA Kit"
  let t = name.replace(new RegExp(`^${species}\\s*`, 'i'), '').trim();
  t = t.replace(/ELISA\s*Kit.*$/i, '').trim();
  // Remove trailing parentheses content
  t = t.replace(/[（(].*?[）)]/g, '').trim();
  // Clean up extra spaces
  t = t.replace(/\s+/g, ' ').trim();
  return t || name;
}

function generateSlug(target, species, catalogNo) {
  const base = `${target}-${species}-${catalogNo}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base.substring(0, 100);
}

function parseSampleType(text) {
  if (!text) return ['血清', '血浆', '细胞培养上清', '组织匀浆'];
  const parts = text.split(/[/／,，]/).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : ['血清', '血浆', '细胞培养上清', '组织匀浆'];
}

function escapeSqlString(str) {
  if (str == null) return '';
  return String(str).replace(/'/g, "''").replace(/\\/g, '\\\\');
}

function toPgArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "'{}'";
  const escaped = arr.map(s => escapeSqlString(s));
  return `ARRAY['${escaped.join("','")}']::text[]`;
}

async function main() {
  console.log('📖 读取 Excel 文件...');
  const wb = xlsx.readFile(EXCEL_PATH);
  const allProducts = [];
  const allAliases = [];

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'Sheet3') continue;
    const species = parseSpeciesFromSheetName(sheetName);
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    if (rows.length < 2) continue;

    const headers = rows[0];
    // Find column indexes
    const catIdx = headers.findIndex(h => String(h).includes('货号'));
    const nameIdx = headers.findIndex(h => String(h).includes('产品名称'));
    const sizeIdx = headers.findIndex(h => String(h).includes('规格'));
    const sensIdx = headers.findIndex(h => String(h).includes('灵敏度'));
    const rangeIdx = headers.findIndex(h => String(h).includes('检测范围'));
    const sampleIdx = headers.findIndex(h => String(h).includes('标本类型'));

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[catIdx] && !r[nameIdx]) continue;

      const catalogNo = String(r[catIdx] || '').trim();
      const rawName = String(r[nameIdx] || '').trim();
      const size = String(r[sizeIdx] || '96T').trim();
      const sensitivity = String(r[sensIdx] || '').trim();
      const detectionRange = String(r[rangeIdx] || '').trim();
      const sampleText = String(r[sampleIdx] || '').trim();

      if (!catalogNo || !rawName) continue;

      const target = extractTargetFromName(rawName, species);
      const slug = generateSlug(target, species, catalogNo);
      const sampleType = parseSampleType(sampleText);
      const speciesZh = SPECIES_MAP[species] || species;

      allProducts.push({
        name: rawName,
        slug,
        target,
        species,
        speciesZh,
        catalogNo,
        size,
        sensitivity,
        detectionRange,
        sampleType,
      });

      // Alias entry
      allAliases.push({
        slug,
        alias: target,
        aliasType: 'target',
        language: 'en',
      });
    }
  }

  console.log(`✅ 解析完成：共 ${allProducts.length} 条产品`);

  // Generate SQL
  console.log('📝 生成 SQL 文件...');
  let sql = `-- 爱萌产品目录批量导入 SQL\n`;
  sql += `-- 生成时间：${new Date().toISOString()}\n`;
  sql += `-- 产品总数：${allProducts.length}\n\n`;
  sql += `BEGIN;\n\n`;

  // Insert products in batches
  const batchSize = 50;
  for (let i = 0; i < allProducts.length; i += batchSize) {
    const batch = allProducts.slice(i, i + batchSize);
    const values = batch.map(p =>
      `('${escapeSqlString(p.name)}', '${escapeSqlString(p.slug)}', '${escapeSqlString(p.target)}', ` +
      `'${escapeSqlString(p.detectionRange)}', '${escapeSqlString(p.sensitivity)}', ${toPgArray(p.sampleType)}, ` +
      `1800, 'CNY', 'active', 'in_stock')`
    ).join(',\n');

    sql += `INSERT INTO products (name, slug, target, detection_range, sensitivity, sample_type, price, currency, status, stock_status)\n`;
    sql += `VALUES ${values};\n\n`;

    if ((i + batchSize) % 500 === 0 || i + batchSize >= allProducts.length) {
      console.log(`   SQL 进度：${Math.min(i + batchSize, allProducts.length)} / ${allProducts.length}`);
    }
  }

  // Insert product_species
  sql += `-- 导入 product_species\n`;
  for (let i = 0; i < allProducts.length; i += batchSize) {
    const batch = allProducts.slice(i, i + batchSize);
    const slugs = batch.map(p => `'${escapeSqlString(p.slug)}'`).join(',');
    sql += `INSERT INTO product_species (product_id, species, species_name_zh, is_primary)\n`;
    sql += `SELECT id, '${escapeSqlString(batch[0].species)}', '${escapeSqlString(batch[0].speciesZh)}', true\n`;
    sql += `FROM products WHERE slug IN (${slugs})\n`;
    sql += `ON CONFLICT (product_id, species) DO NOTHING;\n\n`;
  }

  // Insert product_aliases
  sql += `-- 导入 product_aliases\n`;
  for (let i = 0; i < allAliases.length; i += batchSize) {
    const batch = allAliases.slice(i, i + batchSize);
    const conditions = batch.map(a => `slug = '${escapeSqlString(a.slug)}'`).join(' OR ');
    sql += `INSERT INTO product_aliases (product_id, alias, alias_type, language)\n`;
    sql += `SELECT id, '${escapeSqlString(batch[0].alias)}', 'target', 'en'\n`;
    sql += `FROM products WHERE ${conditions}\n`;
    sql += `ON CONFLICT DO NOTHING;\n\n`;
  }

  sql += `COMMIT;\n`;

  fs.writeFileSync(SQL_OUTPUT, sql);
  console.log(`✅ SQL 文件已保存：${SQL_OUTPUT}`);
  console.log(`   文件大小：${(fs.statSync(SQL_OUTPUT).size / 1024).toFixed(1)} KB`);

  // Try supabase-js if service role key available
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    console.log('🔌 检测到 SERVICE_ROLE_KEY，尝试通过 supabase-js 导入...');
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let inserted = 0;
    for (let i = 0; i < allProducts.length; i += batchSize) {
      const batch = allProducts.slice(i, i + batchSize);
      const { error } = await supabase.from('products').insert(batch.map(p => ({
        name: p.name,
        slug: p.slug,
        target: p.target,
        detection_range: p.detectionRange,
        sensitivity: p.sensitivity,
        sample_type: p.sampleType,
        price: 1800,
        currency: 'CNY',
        status: 'active',
        stock_status: 'in_stock',
      })));

      if (error) {
        console.error(`❌ 第 ${i + 1} 批插入失败：`, error.message);
        break;
      }

      inserted += batch.length;
      if (inserted % 500 === 0 || inserted >= allProducts.length) {
        console.log(`   导入进度：${inserted} / ${allProducts.length}`);
      }
    }
    console.log(`✅ supabase-js 导入完成：${inserted} 条`);
  } else {
    console.log('\n⚠️  未检测到 SUPABASE_SERVICE_ROLE_KEY 环境变量。');
    console.log('   已生成 SQL 文件，请复制到 Supabase SQL Editor 中执行。');
    console.log('   如需使用 supabase-js 导入，请配置环境变量后重新运行：');
    console.log('   export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
    console.log('   node scripts/import-products.js');
  }

  console.log('\n📊 统计结果：');
  console.log(`   产品总数：${allProducts.length}`);
  const speciesCounts = {};
  allProducts.forEach(p => { speciesCounts[p.species] = (speciesCounts[p.species] || 0) + 1; });
  console.log('   按物种分布：');
  Object.entries(speciesCounts).forEach(([s, c]) => console.log(`     ${s}: ${c}`));
}

main().catch(err => {
  console.error('❌ 导入失败：', err.message);
  process.exit(1);
});
