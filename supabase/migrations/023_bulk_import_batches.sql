CREATE TABLE IF NOT EXISTS bulk_import_batches (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('products', 'agents')),
  created_at TIMESTAMPTZ DEFAULT now(),
  product_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'rolled_back')),
  user_id TEXT,
  details JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_bulk_import_batches_type_created_at
  ON bulk_import_batches(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_import_batches_status
  ON bulk_import_batches(status);

COMMENT ON TABLE bulk_import_batches IS '商品/代理商批量导入批次记录，用于查看导入结果和执行回滚。';
COMMENT ON COLUMN bulk_import_batches.details IS '导入详情：成功数、失败数、错误摘要、创建记录 ID、回滚结果等。';

NOTIFY pgrst, 'reload schema';
