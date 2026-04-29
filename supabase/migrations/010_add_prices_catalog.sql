-- 添加双规格价格支持
ALTER TABLE products ADD COLUMN IF NOT EXISTS prices JSONB DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_number TEXT DEFAULT NULL;

COMMENT ON COLUMN products.prices IS '双规格价格 {"48T": 900, "96T": 1800}';
COMMENT ON COLUMN products.catalog_number IS '产品货号，如 LV10011M';

-- 更新 search_products 函数，增加 prices 和 catalog_number 返回
DROP FUNCTION IF EXISTS search_products(TEXT, TEXT);

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
  prices JSONB,
  catalog_number TEXT,
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
      p.prices,
      p.catalog_number,
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
      p.prices,
      p.catalog_number,
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

COMMENT ON FUNCTION search_products(TEXT, TEXT) IS
  '按名称/靶标/别名模糊搜索产品，支持种属过滤，返回含 prices 和 catalog_number。';
