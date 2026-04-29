-- ============================================================
-- 文献引用管理系统 - 完整数据库扩展
-- ============================================================

-- 1. products 表扩展
ALTER TABLE products ADD COLUMN IF NOT EXISTS cat_no TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS citation_count INTEGER DEFAULT 0;

-- 如果之前有 catalog_number，同步到 cat_no
UPDATE products SET cat_no = catalog_number WHERE cat_no IS NULL AND catalog_number IS NOT NULL;

-- 2. papers 表扩展
ALTER TABLE papers ADD COLUMN IF NOT EXISTS product_cat_no TEXT;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS impact_factor DECIMAL(5,2);
ALTER TABLE papers ADD COLUMN IF NOT EXISTS citation_type TEXT DEFAULT 'user_submitted';
ALTER TABLE papers ADD COLUMN IF NOT EXISTS is_displayed BOOLEAN DEFAULT false;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
ALTER TABLE papers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- points_awarded 已存在，确保有默认值
ALTER TABLE papers ALTER COLUMN points_awarded SET DEFAULT 0;

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_papers_product_cat_no ON papers(product_cat_no) WHERE upload_status = 'verified';
CREATE INDEX IF NOT EXISTS idx_papers_is_displayed ON papers(is_displayed);
CREATE INDEX IF NOT EXISTS idx_papers_upload_status ON papers(upload_status);
CREATE INDEX IF NOT EXISTS idx_products_cat_no ON products(cat_no);

-- 4. product_citations 视图
CREATE OR REPLACE VIEW product_citations AS
SELECT
  p.id as product_id,
  p.cat_no,
  p.name as product_name,
  p.citation_count,
  pa.id as paper_id,
  pa.title,
  pa.authors,
  pa.journal,
  pa.impact_factor,
  pa.doi,
  pa.publication_date,
  pa.url,
  pa.verified_at,
  pa.user_id as submitter_id
FROM products p
LEFT JOIN papers pa ON pa.product_cat_no = p.cat_no
  AND pa.upload_status = 'verified'
  AND pa.is_displayed = true;

-- 5. 触发器：自动更新 products.citation_count
CREATE OR REPLACE FUNCTION update_product_citation_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.upload_status = 'verified' AND NEW.is_displayed = true THEN
    UPDATE products SET citation_count = citation_count + 1 WHERE cat_no = NEW.product_cat_no;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.upload_status != 'verified' AND NEW.upload_status = 'verified' AND NEW.is_displayed = true THEN
      UPDATE products SET citation_count = citation_count + 1 WHERE cat_no = NEW.product_cat_no;
    ELSIF OLD.upload_status = 'verified' AND NEW.upload_status != 'verified' THEN
      UPDATE products SET citation_count = GREATEST(citation_count - 1, 0) WHERE cat_no = NEW.product_cat_no;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.upload_status = 'verified' AND OLD.is_displayed = true THEN
    UPDATE products SET citation_count = GREATEST(citation_count - 1, 0) WHERE cat_no = OLD.product_cat_no;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_papers_citation_count ON papers;
CREATE TRIGGER trg_papers_citation_count
  AFTER INSERT OR UPDATE OR DELETE ON papers
  FOR EACH ROW EXECUTE FUNCTION update_product_citation_count();

-- 6. 积分奖励规则扩展（文献引用相关）
INSERT INTO point_rewards (rule_code, name, description, points_amount, limit_type, limit_count, is_active)
VALUES
  ('CITATION_SUBMIT', '文献投稿奖励', '提交使用本公司产品的SCI文献', 50, 'once_per_user', null, true),
  ('CITATION_VERIFY_LOW', '文献审核通过-低IF', 'IF < 5 的文献审核通过', 500, 'none', null, true),
  ('CITATION_VERIFY_MID', '文献审核通过-中IF', '5 ≤ IF < 10 的文献审核通过', 800, 'none', null, true),
  ('CITATION_VERIFY_HIGH', '文献审核通过-高IF', '10 ≤ IF < 20 的文献审核通过', 1200, 'none', null, true),
  ('CITATION_VERIFY_TOP', '文献审核通过-顶刊', 'IF ≥ 20 的文献审核通过', 1500, 'none', null, true)
ON CONFLICT (rule_code) DO NOTHING;
