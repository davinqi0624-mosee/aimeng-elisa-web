-- 产品文档绑定：支持说明书/COA 分开上传后按文件名自动归位

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

NOTIFY pgrst, 'reload schema';
