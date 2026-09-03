-- 产品说明书/COA 上传流程结构化状态：
-- 让后台不再依赖 review_note 文案推断状态，按上传、识别、匹配、上架、存储分别记录。

ALTER TABLE product_documents
  ADD COLUMN IF NOT EXISTS upload_status TEXT DEFAULT 'uploaded'
    CHECK (upload_status IN ('uploaded', 'failed')),
  ADD COLUMN IF NOT EXISTS parse_status TEXT DEFAULT 'parsed'
    CHECK (parse_status IN ('parsed', 'failed')),
  ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'unmatched'
    CHECK (match_status IN ('unmatched', 'matched', 'failed', 'duplicate')),
  ADD COLUMN IF NOT EXISTS publish_status TEXT DEFAULT 'draft'
    CHECK (publish_status IN ('draft', 'ready', 'active', 'archived')),
  ADD COLUMN IF NOT EXISTS storage_status TEXT DEFAULT 'active'
    CHECK (storage_status IN ('active', 'deleted', 'missing')),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS workflow_updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE product_documents
SET
  upload_status = COALESCE(upload_status, 'uploaded'),
  parse_status = CASE
    WHEN COALESCE(catalog_number, document_key, '') <> '' THEN 'parsed'
    WHEN COALESCE(review_note, match_reason, '') ILIKE '%文件名%' THEN 'failed'
    ELSE COALESCE(parse_status, 'parsed')
  END,
  match_status = CASE
    WHEN COALESCE(review_note, match_reason, '') ILIKE '%前台已有可用%' THEN 'duplicate'
    WHEN COALESCE(review_note, match_reason, '') ILIKE '%重复%' THEN 'duplicate'
    WHEN product_id IS NOT NULL THEN 'matched'
    WHEN COALESCE(review_note, match_reason, '') ILIKE '%未找到货号%' THEN 'failed'
    ELSE COALESCE(match_status, 'unmatched')
  END,
  publish_status = CASE
    WHEN status = 'active' THEN 'active'
    WHEN status = 'archived' THEN 'archived'
    WHEN status = 'pending' AND product_id IS NOT NULL THEN 'ready'
    ELSE COALESCE(publish_status, 'draft')
  END,
  storage_status = CASE
    WHEN COALESCE(review_note, match_reason, '') ILIKE '%存储删除%' THEN 'deleted'
    WHEN COALESCE(review_note, match_reason, '') ILIKE '%删除存储文件%' THEN 'deleted'
    WHEN COALESCE(review_note, match_reason, '') ILIKE '%文件已从存储删除%' THEN 'deleted'
    WHEN COALESCE(review_note, match_reason, '') ILIKE '%不能上架或恢复%' THEN 'deleted'
    ELSE COALESCE(storage_status, 'active')
  END,
  failure_reason = CASE
    WHEN COALESCE(failure_reason, '') <> '' THEN failure_reason
    WHEN status <> 'active' AND COALESCE(review_note, match_reason, '') <> '' THEN COALESCE(review_note, match_reason)
    ELSE failure_reason
  END,
  workflow_updated_at = COALESCE(workflow_updated_at, updated_at, created_at, NOW());

CREATE INDEX IF NOT EXISTS idx_product_documents_workflow_batch
  ON product_documents(batch_id, upload_status, parse_status, match_status, publish_status, storage_status)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_documents_publish_status
  ON product_documents(publish_status, storage_status, document_type);

COMMENT ON COLUMN product_documents.upload_status IS '上传模块状态：uploaded/failed。失败文件通常不保留 product_documents 记录，批次 note 仍保留失败清单。';
COMMENT ON COLUMN product_documents.parse_status IS '文件名识别模块状态：parsed/failed。';
COMMENT ON COLUMN product_documents.match_status IS '货号匹配模块状态：unmatched/matched/failed/duplicate。';
COMMENT ON COLUMN product_documents.publish_status IS '上架模块状态：draft/ready/active/archived。';
COMMENT ON COLUMN product_documents.storage_status IS '存储模块状态：active/deleted/missing。';
COMMENT ON COLUMN product_documents.failure_reason IS '结构化失败原因，供后台直接展示和筛选。';

NOTIFY pgrst, 'reload schema';
