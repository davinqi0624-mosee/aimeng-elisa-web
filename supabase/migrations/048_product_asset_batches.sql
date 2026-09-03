-- 产品图片批量上传批次：
-- 用于标准曲线图、备用图等文件的预检、确认和撤回。

CREATE TABLE IF NOT EXISTS product_asset_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type TEXT NOT NULL DEFAULT 'standard_curve' CHECK (asset_type IN ('standard_curve', 'additional', 'reserved')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'reviewing', 'confirmed', 'rolled_back', 'archived')),
  total_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  active_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_asset_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES product_asset_batches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL DEFAULT 'standard_curve' CHECK (asset_type IN ('standard_curve', 'additional', 'reserved')),
  image_type TEXT NOT NULL DEFAULT 'standard_curve',
  catalog_number TEXT,
  species TEXT,
  target TEXT,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  file_hash TEXT,
  match_method TEXT NOT NULL DEFAULT 'none' CHECK (match_method IN ('none', 'exact_catalog', 'exact_species_target', 'ambiguous', 'manual')),
  match_score INTEGER NOT NULL DEFAULT 0,
  match_reason TEXT,
  previous_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'active', 'rejected', 'archived', 'rolled_back')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_asset_batches_status
  ON product_asset_batches(asset_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_asset_uploads_batch
  ON product_asset_uploads(batch_id, status);

CREATE INDEX IF NOT EXISTS idx_product_asset_uploads_product
  ON product_asset_uploads(product_id, asset_type);

CREATE INDEX IF NOT EXISTS idx_product_asset_uploads_hash
  ON product_asset_uploads(file_hash);

CREATE OR REPLACE FUNCTION update_product_asset_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_asset_batches_updated_at ON product_asset_batches;
CREATE TRIGGER trg_product_asset_batches_updated_at
  BEFORE UPDATE ON product_asset_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_product_asset_batches_updated_at();

COMMENT ON TABLE product_asset_batches IS '产品图片批量上传批次。先预检匹配，确认后生效，可按批次撤回。';
COMMENT ON TABLE product_asset_uploads IS '产品图片批量上传明细。记录文件、匹配结果、生效状态和撤回所需的旧图片。';
COMMENT ON COLUMN product_asset_uploads.previous_image_url IS '确认生效前该产品同 image_type 的旧图片 URL，用于批次撤回恢复。';

NOTIFY pgrst, 'reload schema';
