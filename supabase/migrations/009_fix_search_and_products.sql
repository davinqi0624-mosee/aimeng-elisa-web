-- ============================================================
-- 修复导入数据 + 创建 search_products 搜索函数
-- 执行方式：复制到 Supabase SQL Editor → New query → Run
-- ============================================================

-- 1. 修复所有产品的 status 和 stock_status（如有缺失）
UPDATE products
SET status = 'active',
    stock_status = 'in_stock'
WHERE status IS NULL
   OR status = '';

-- 2. 修复缺失 slug 的产品（从 name 提取生成）
UPDATE products
SET slug = lower(
    regexp_replace(
      regexp_replace(
        coalesce(target, regexp_replace(name, '^[^\\s]+\\s+', '')),
        '[^a-z0-9α-ωΑ-Ω-]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  ) || '-' || gen_random_uuid()::text
WHERE slug IS NULL OR slug = '';

-- 3. 创建 search_products 函数（支持名称/靶标/别名模糊搜索 + 种属过滤）
CREATE OR REPLACE FUNCTION search_products(
  search_query TEXT DEFAULT NULL,
  species_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  target TEXT,
  price DECIMAL,
  detection_range TEXT,
  stock_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF search_query IS NULL OR trim(search_query) = '' THEN
    RETURN QUERY
    SELECT DISTINCT ON (p.id)
      p.id,
      p.name,
      p.slug,
      p.target,
      p.price,
      p.detection_range,
      p.stock_status
    FROM products p
    LEFT JOIN product_species ps ON ps.product_id = p.id
    WHERE p.status = 'active'
      AND (species_filter IS NULL OR ps.species = species_filter)
    ORDER BY p.id, p.name;
  ELSE
    RETURN QUERY
    SELECT DISTINCT ON (p.id)
      p.id,
      p.name,
      p.slug,
      p.target,
      p.price,
      p.detection_range,
      p.stock_status
    FROM products p
    LEFT JOIN product_aliases pa ON pa.product_id = p.id
    LEFT JOIN product_species ps ON ps.product_id = p.id
    WHERE p.status = 'active'
      AND (
        p.name ILIKE '%' || search_query || '%'
        OR p.target ILIKE '%' || search_query || '%'
        OR pa.alias ILIKE '%' || search_query || '%'
      )
      AND (species_filter IS NULL OR ps.species = species_filter)
    ORDER BY p.id, p.name;
  END IF;
END;
$$;

-- 4. 为 search_products 添加注释
COMMENT ON FUNCTION search_products(TEXT, TEXT) IS
  '按名称/靶标/别名模糊搜索产品，支持种属过滤。空查询返回所有 active 产品。';

-- 5. 确保 product_aliases 上关联产品有 target 别名（用于搜索）
-- 注意：如果已经存在则跳过
INSERT INTO product_aliases (product_id, alias, alias_type, language)
SELECT
  p.id,
  p.target,
  'target',
  'en'
FROM products p
WHERE p.target IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_aliases pa
    WHERE pa.product_id = p.id AND pa.alias = p.target
  );

-- 6. 统计确认
SELECT
  'products 总数' as metric,
  count(*)::text as value
FROM products
UNION ALL
SELECT
  'active 产品数',
  count(*)::text
FROM products WHERE status = 'active'
UNION ALL
SELECT
  '无 slug 产品数',
  count(*)::text
FROM products WHERE slug IS NULL OR slug = '';
