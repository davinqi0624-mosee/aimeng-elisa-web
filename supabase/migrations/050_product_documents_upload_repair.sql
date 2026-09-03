-- 产品说明书批量上传修复：
-- 旧索引 idx_product_documents_unique_key 会把已撤回/已隐藏记录也算作重复，
-- 导致管理员重新上传同一货号说明书时被误判为重复，前台仍然没有可下载文件。

DROP INDEX IF EXISTS idx_product_documents_unique_key;

CREATE INDEX IF NOT EXISTS idx_product_documents_key_lookup
  ON product_documents(product_id, document_type, document_key);

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

COMMENT ON INDEX idx_product_documents_key_lookup IS '同货号文档查找索引；不限制已撤回记录，避免旧批次阻塞重新上传。';
COMMENT ON INDEX idx_product_documents_active_datasheet_per_product IS '每个商品前台只允许一份当前生效说明书。';

NOTIFY pgrst, 'reload schema';
