-- 生化法试剂盒操作说明书。
-- 独立于 product_documents，避免把生化产品错误绑定到 ELISA products 表。

CREATE TABLE IF NOT EXISTS biochemical_product_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  biochemical_product_id UUID NOT NULL REFERENCES biochemical_products(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_biochemical_product_documents_one_active
  ON biochemical_product_documents(biochemical_product_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_biochemical_product_documents_product
  ON biochemical_product_documents(biochemical_product_id, created_at DESC);

ALTER TABLE biochemical_product_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS biochemical_product_documents_select_active ON biochemical_product_documents;
CREATE POLICY biochemical_product_documents_select_active
  ON biochemical_product_documents
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE OR REPLACE FUNCTION update_biochemical_product_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_biochemical_product_documents_updated_at ON biochemical_product_documents;
CREATE TRIGGER trg_biochemical_product_documents_updated_at
  BEFORE UPDATE ON biochemical_product_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_biochemical_product_documents_updated_at();

COMMENT ON TABLE biochemical_product_documents IS '生化法试剂盒操作说明书，每个产品最多一份前台有效文档。';

NOTIFY pgrst, 'reload schema';
