const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '..', 'data', '爱萌产品目录（已更新4.26）.xlsx');
const SQL_OUTPUT_DIR = path.join(__dirname, 'import-sql-chunks');

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
  let t = name.replace(new RegExp(`^${species}\\s*`, 'i'), '').trim();
  t = t.replace(/ELISA\s*Kit.*$/i, '').trim();
  t = t.replace(/[（(].*?[）)]/g, '').trim();
  t = t.replace(/\s+/g, ' ').trim();
  return t || name;
}

function generateSlug(target, species, catalogNo, usedSlugs) {
  let base = `${target}-${species}-${catalogNo}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  base = base.substring(0, 90);

  let slug = base;
  let counter = 1;
  while (usedSlugs.has(slug)) {
    const suffix = `-${counter}`;
    slug = base.substring(0, 90 - suffix.length) + suffix;
    counter++;
  }
  usedSlugs.add(slug);
  return slug;
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
  const usedSlugs = new Set();

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
      if (!r[catIdx] && !r[nameIdx]) continue;

      const catalogNo = String(r[catIdx] || '').trim();
      const rawName = String(r[nameIdx] || '').trim();
      const size = String(r[sizeIdx] || '96T').trim();
      const sensitivity = String(r[sensIdx] || '').trim();
      const detectionRange = String(r[rangeIdx] || '').trim();
      const sampleText = String(r[sampleIdx] || '').trim();

      if (!catalogNo || !rawName) continue;

      const target = extractTargetFromName(rawName, species);
      const slug = generateSlug(target, species, catalogNo, usedSlugs);
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

      allAliases.push({
        slug,
        alias: target,
        aliasType: 'target',
        language: 'en',
      });
    }
  }

  console.log(`✅ 解析完成：共 ${allProducts.length} 条产品`);

  // Generate chunked SQL files
  console.log('📝 生成 SQL 分片文件...');
  if (!fs.existsSync(SQL_OUTPUT_DIR)) {
    fs.mkdirSync(SQL_OUTPUT_DIR);
  }

  const chunkSize = 2000;
  const totalChunks = Math.ceil(allProducts.length / chunkSize);

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const start = chunkIdx * chunkSize;
    const end = Math.min(start + chunkSize, allProducts.length);
    const batch = allProducts.slice(start, end);
    const aliasBatch = allAliases.slice(start, end);

    let sql = `-- 爱萌产品目录导入 - 分片 ${chunkIdx + 1}/${totalChunks}\n`;
    sql += `-- 产品范围: ${start + 1} ~ ${end}\n`;
    sql += `-- 生成时间: ${new Date().toISOString()}\n\n`;
    sql += `BEGIN;\n\n`;

    // Insert products
    const values = batch.map(p =>
      `('${escapeSqlString(p.name)}', '${escapeSqlString(p.slug)}', '${escapeSqlString(p.target)}', ` +
      `'${escapeSqlString(p.detectionRange)}', '${escapeSqlString(p.sensitivity)}', ${toPgArray(p.sampleType)}, ` +
      `1800, 'CNY', 'active', 'in_stock')`
    ).join(',\n');

    sql += `INSERT INTO products (name, slug, target, detection_range, sensitivity, sample_type, price, currency, status, stock_status)\n`;
    sql += `VALUES ${values}\n`;
    sql += `ON CONFLICT (slug) DO NOTHING;\n\n`;

    // Insert product_species
    const speciesValues = batch.map(p =>
      `('${escapeSqlString(p.slug)}', '${escapeSqlString(p.species)}', '${escapeSqlString(p.speciesZh)}', true)`
    ).join(',\n');

    sql += `INSERT INTO product_species (product_id, species, species_name_zh, is_primary)\n`;
    sql += `SELECT p.id, v.species, v.species_name_zh, v.is_primary\n`;
    sql += `FROM (VALUES ${speciesValues}) AS v(slug, species, species_name_zh, is_primary)\n`;
    sql += `JOIN products p ON p.slug = v.slug\n`;
    sql += `ON CONFLICT (product_id, species) DO NOTHING;\n\n`;

    // Insert product_aliases
    const aliasValues = aliasBatch.map(a =>
      `('${escapeSqlString(a.slug)}', '${escapeSqlString(a.alias)}', '${escapeSqlString(a.aliasType)}', '${escapeSqlString(a.language)}')`
    ).join(',\n');

    sql += `INSERT INTO product_aliases (product_id, alias, alias_type, language)\n`;
    sql += `SELECT p.id, v.alias, v.alias_type, v.language\n`;
    sql += `FROM (VALUES ${aliasValues}) AS v(slug, alias, alias_type, language)\n`;
    sql += `JOIN products p ON p.slug = v.slug\n`;
    sql += `ON CONFLICT DO NOTHING;\n\n`;

    sql += `COMMIT;\n`;

    const chunkPath = path.join(SQL_OUTPUT_DIR, `chunk-${String(chunkIdx + 1).padStart(3, '0')}.sql`);
    fs.writeFileSync(chunkPath, sql);
    console.log(`   分片 ${chunkIdx + 1}/${totalChunks} → ${chunkPath} (${(fs.statSync(chunkPath).size / 1024).toFixed(1)} KB)`);
  }

  console.log(`\n✅ SQL 分片文件已保存到: ${SQL_OUTPUT_DIR}`);

  // Try supabase-js if service role key available
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    console.log('\n🔌 检测到 SERVICE_ROLE_KEY，尝试通过 supabase-js 导入...');
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let inserted = 0;
    let skipped = 0;
    const batchSize = 50;

    for (let i = 0; i < allProducts.length; i += batchSize) {
      const batch = allProducts.slice(i, i + batchSize);

      const { data: insertedProducts, error } = await supabase.from('products').insert(batch.map(p => ({
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
      }))).select('id, slug');

      if (error) {
        console.error(`❌ 第 ${i + 1} 批插入失败：`, error.message);
        if (error.code === '23505') {
          console.log('   检测到 slug 重复，尝试逐条插入...');
          for (const p of batch) {
            const { data: single, error: singleErr } = await supabase.from('products').insert({
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
            }).select('id, slug').single();

            if (singleErr && singleErr.code === '23505') {
              console.warn(`   跳过重复 slug: ${p.slug}`);
              skipped++;
            } else if (singleErr) {
              console.error(`   单条插入失败: ${p.slug}`, singleErr.message);
              skipped++;
            } else {
              inserted++;
            }
          }
          continue;
        }
        break;
      }

      inserted += batch.length;
      if (inserted % 500 === 0 || inserted >= allProducts.length) {
        console.log(`   导入进度：${inserted} / ${allProducts.length}`);
      }
    }

    console.log(`✅ supabase-js 导入完成：${inserted} 条成功，${skipped} 条跳过`);

    // Insert species and aliases for inserted products
    if (inserted > 0) {
      console.log('📝 导入 product_species 和 product_aliases...');

      const { data: allDbProducts } = await supabase.from('products').select('id, slug');
      const slugToId = new Map(allDbProducts?.map(p => [p.slug, p.id]) || []);

      const speciesInserts = [];
      const aliasInserts = [];

      for (const p of allProducts) {
        const productId = slugToId.get(p.slug);
        if (!productId) continue;
        speciesInserts.push({
          product_id: productId,
          species: p.species,
          species_name_zh: p.speciesZh,
          is_primary: true,
        });
        aliasInserts.push({
          product_id: productId,
          alias: p.target,
          alias_type: 'target',
          language: 'en',
        });
      }

      // Batch insert species
      const spBatch = 500;
      for (let i = 0; i < speciesInserts.length; i += spBatch) {
        const { error } = await supabase.from('product_species').insert(speciesInserts.slice(i, i + spBatch));
        if (error) console.error(`species 插入失败:`, error.message);
      }

      // Batch insert aliases
      for (let i = 0; i < aliasInserts.length; i += spBatch) {
        const { error } = await supabase.from('product_aliases').insert(aliasInserts.slice(i, i + spBatch));
        if (error) console.error(`aliases 插入失败:`, error.message);
      }

      console.log(`✅ 关联数据导入完成`);
    }
  } else {
    console.log('\n⚠️  未检测到 SUPABASE_SERVICE_ROLE_KEY 环境变量。');
    console.log(`   已生成 ${totalChunks} 个 SQL 分片文件，请逐个复制到 Supabase SQL Editor 执行。`);
    console.log('   每个文件约 600-700 KB，在 SQL Editor 限制范围内。');
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
