-- 产品文档命名规则固化：
-- ELISA 说明书按“货号”归档；COA 按“货号 + 批次号”归档。

CREATE TABLE IF NOT EXISTS product_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('datasheet', 'coa')),
  document_key TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL,
  file_name TEXT,
  match_reason TEXT,
  match_score NUMERIC(5,2),
  source_type TEXT NOT NULL DEFAULT 'bulk_match',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_documents_unique_key
  ON product_documents(product_id, document_type, document_key);

CREATE INDEX IF NOT EXISTS idx_product_documents_lookup
  ON product_documents(product_id, document_type, status);

CREATE OR REPLACE FUNCTION update_product_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_documents_updated_at ON product_documents;
CREATE TRIGGER trg_product_documents_updated_at
  BEFORE UPDATE ON product_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_product_documents_updated_at();

ALTER TABLE product_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_documents_select_public ON product_documents;
CREATE POLICY product_documents_select_public
  ON product_documents
  FOR SELECT
  TO PUBLIC
  USING (status = 'active');

ALTER TABLE product_documents
  ADD COLUMN IF NOT EXISTS catalog_number TEXT,
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS normalized_file_key TEXT;

UPDATE product_documents
SET
  catalog_number = COALESCE(NULLIF(catalog_number, ''), NULLIF(document_key, '')),
  normalized_file_key = COALESCE(NULLIF(normalized_file_key, ''), NULLIF(document_key, ''))
WHERE document_type = 'datasheet';

UPDATE product_documents
SET normalized_file_key = COALESCE(
  NULLIF(normalized_file_key, ''),
  NULLIF(CONCAT_WS('__', NULLIF(catalog_number, ''), NULLIF(batch_number, '')), ''),
  NULLIF(document_key, '')
);

CREATE INDEX IF NOT EXISTS idx_product_documents_catalog_number
  ON product_documents(catalog_number);

CREATE INDEX IF NOT EXISTS idx_product_documents_batch_number
  ON product_documents(batch_number)
  WHERE batch_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_documents_normalized_file_key
  ON product_documents(document_type, normalized_file_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_documents_active_datasheet_per_product
  ON product_documents(product_id, document_type)
  WHERE document_type = 'datasheet'
    AND status = 'active'
    AND product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_documents_active_coa_per_batch
  ON product_documents(product_id, document_type, batch_number)
  WHERE document_type = 'coa'
    AND status = 'active'
    AND product_id IS NOT NULL
    AND batch_number IS NOT NULL;

COMMENT ON COLUMN product_documents.catalog_number IS '从文件名或人工录入提取的产品货号，是商品文档归位的核心依据。';
COMMENT ON COLUMN product_documents.batch_number IS 'COA 批次号。说明书为空；COA 必填，用于同一货号不同批次追溯。';
COMMENT ON COLUMN product_documents.normalized_file_key IS '规范化文件键：说明书=货号；COA=货号__批次号。';

NOTIFY pgrst, 'reload schema';
