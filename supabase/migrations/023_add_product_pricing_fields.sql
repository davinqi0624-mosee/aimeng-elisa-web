-- ============================================================
-- 产品价格与种属字段扩展
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_48t INTEGER DEFAULT 1800;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_96t INTEGER DEFAULT 2400;
ALTER TABLE products ADD COLUMN IF NOT EXISTS species TEXT;
