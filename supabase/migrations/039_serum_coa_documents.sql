-- 血清 COA 查询：按血清货号 + 批号绑定文件。

CREATE TABLE IF NOT EXISTS serum_coa_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_number TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  product_name TEXT DEFAULT '',
  file_url TEXT NOT NULL,
  file_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (catalog_number, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_serum_coa_documents_lookup
  ON serum_coa_documents (catalog_number, batch_number, status);

CREATE OR REPLACE FUNCTION update_serum_coa_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_serum_coa_documents_updated_at ON serum_coa_documents;
CREATE TRIGGER trg_serum_coa_documents_updated_at
  BEFORE UPDATE ON serum_coa_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_serum_coa_documents_updated_at();

ALTER TABLE serum_coa_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS serum_coa_documents_select_active ON serum_coa_documents;
CREATE POLICY serum_coa_documents_select_active
  ON serum_coa_documents
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

NOTIFY pgrst, 'reload schema';
