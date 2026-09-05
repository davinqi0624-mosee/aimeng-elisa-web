-- 074: 安全固化（cutover 窗口应用）
-- 1) match_knowledge / search_products 固定 search_path（消除函数劫持面）
-- 2) 2026-09-03 只做在活库上的加固固化进迁移文件（admin 表 RLS 等）
-- 3) analysis_reports 正式化入迁移文件（活库版本为运行时创建，此处幂等固化，策略用 app_uid()）
-- 4) 防御性 DROP exec_sql（活库已确认不存在）

-- ===== 1) search_path 固化 =====
-- match_knowledge：活库从未创建（026 未应用），knowledge_chunks 亦为空表，
-- 线上 chat 走降级关键词检索。待知识块向量化补数后再按 026 定义建立（届时务必 SET search_path）。
DROP FUNCTION IF EXISTS match_knowledge(vector(1536), FLOAT, INT);

DROP FUNCTION IF EXISTS search_products(TEXT, TEXT);
CREATE FUNCTION search_products(
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
SET search_path = public
AS $$
BEGIN
  IF search_query IS NULL OR trim(search_query) = '' THEN
    RETURN QUERY
    SELECT DISTINCT ON (p.id)
      p.id, p.name, p.slug, p.target, p.price, p.prices, p.catalog_number,
      p.detection_range, p.stock_status
    FROM products p
    LEFT JOIN product_species ps ON ps.product_id = p.id
    WHERE p.status = 'active'
      AND (species_filter IS NULL OR ps.species = species_filter)
    ORDER BY p.id, p.name;
  ELSE
    RETURN QUERY
    SELECT DISTINCT ON (p.id)
      p.id, p.name, p.slug, p.target, p.price, p.prices, p.catalog_number,
      p.detection_range, p.stock_status
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

COMMENT ON FUNCTION search_products(TEXT, TEXT) IS '按名称/靶标/别名模糊搜索产品，支持种属过滤，返回含 prices 和 catalog_number。';

GRANT EXECUTE ON FUNCTION search_products(TEXT, TEXT) TO anon, authenticated, app_user;

-- ===== 2) 手工加固固化（2026-09-03 直改活库，此处入文件） =====
ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_accounts FROM anon, authenticated;
REVOKE ALL ON admin_permissions FROM anon, authenticated;

ALTER TABLE admin_login_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_security_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_login_security FROM anon, authenticated;
REVOKE ALL ON registration_security_usage FROM anon, authenticated;

-- ===== 3) analysis_reports 正式化（与活库等价，幂等；策略换用 app_uid()） =====
CREATE TABLE IF NOT EXISTS analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
  raw_data JSONB,
  processed_data JSONB,
  standard_curve JSONB,
  report_config JSONB DEFAULT '{}'::jsonb,
  file_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP POLICY IF EXISTS "Users can view own reports" ON analysis_reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON analysis_reports;
CREATE POLICY "Users can view own reports" ON analysis_reports FOR SELECT
  USING (user_id = app_uid());
CREATE POLICY "Users can insert own reports" ON analysis_reports FOR INSERT
  WITH CHECK (user_id = app_uid());

GRANT SELECT, INSERT, UPDATE ON analysis_reports TO app_user;

-- ===== 4) 防御性清理 =====
DROP FUNCTION IF EXISTS exec_sql(TEXT);
