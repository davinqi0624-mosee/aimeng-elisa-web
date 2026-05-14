-- ============================================================
-- 产品详情页扩展字段
-- ============================================================

-- 1. 新增产品检测相关字段
ALTER TABLE products ADD COLUMN IF NOT EXISTS detection_method TEXT DEFAULT '双抗夹心法 (Sandwich ELISA)';
ALTER TABLE products ADD COLUMN IF NOT EXISTS assay_time TEXT DEFAULT '4h 30m';
ALTER TABLE products ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'ELISA';

-- 2. 更新现有产品的默认值
UPDATE products SET detection_method = '双抗夹心法 (Sandwich ELISA)' WHERE detection_method IS NULL;
UPDATE products SET assay_time = '4h 30m' WHERE assay_time IS NULL;
UPDATE products SET platform = 'ELISA' WHERE platform IS NULL;
