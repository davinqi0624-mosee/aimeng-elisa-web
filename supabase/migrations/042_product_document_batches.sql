-- 产品文档批次中心：追踪批量上传、自动匹配、人工复核和批量确认。

CREATE TABLE IF NOT EXISTS product_document_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL CHECK (document_type IN ('datasheet', 'coa')),
  status TEXT NOT NULL DEFAULT 'reviewing' CHECK (status IN ('uploading', 'reviewing', 'completed', 'archived')),
  created_by UUID,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_documents
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_document_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_method TEXT DEFAULT 'none' CHECK (match_method IN ('none', 'exact_catalog', 'name_similarity', 'manual')),
  ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE INDEX IF NOT EXISTS idx_product_documents_batch_id
  ON product_documents(batch_id, status, document_type);

CREATE INDEX IF NOT EXISTS idx_product_documents_match_method
  ON product_documents(batch_id, match_method, status)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_document_batches_created_at
  ON product_document_batches(created_at DESC);

CREATE OR REPLACE FUNCTION update_product_document_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_document_batches_updated_at ON product_document_batches;
CREATE TRIGGER trg_product_document_batches_updated_at
  BEFORE UPDATE ON product_document_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_product_document_batches_updated_at();

ALTER TABLE product_document_batches ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE product_document_batches IS '产品资料批量上传批次，用于追踪上传、匹配、复核、批量确认。';
COMMENT ON COLUMN product_documents.batch_id IS '所属批量上传批次。';
COMMENT ON COLUMN product_documents.match_method IS '匹配方法：exact_catalog=货号精确匹配，name_similarity=名称相似匹配，manual=人工指定，none=未匹配。';
COMMENT ON COLUMN product_documents.review_note IS '复核备注，记录异常原因或人工处理说明。';

NOTIFY pgrst, 'reload schema';
